import { Inject, Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { resolveRunArtifactPaths } from './artifact-persistence/artifact-paths';
import { RunArtifactsService } from './artifact-persistence/run-artifacts.service';
import { RunProbeService } from './run-probe.service';
import {
  ResultsJsonIngestService,
  type ParsedPlaywrightCaseResult,
} from './results-json-ingest.service';
import { SmokeRunConfigService } from './smoke-run-config';
import { RunsService } from './runs.service';
import type { RunArtifactPaths } from './artifact-persistence/artifact-paths';

interface TerminalRunStateInput {
  status: 'success' | 'fail' | 'timeout';
  reason: string | null;
  exitCode: number | null;
  startTime: Date | null;
  endTime: Date;
  runnerPgid: number | null;
}

function toDurationMs(startTime: Date | null, endTime: Date): number | null {
  if (startTime === null) {
    return null;
  }

  return endTime.getTime() - startTime.getTime();
}

function killProcessGroup(processId: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-processId, signal);
  } catch (error) {
    const maybeErrnoError = error as NodeJS.ErrnoException;

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      maybeErrnoError.code === 'ESRCH'
    ) {
      return;
    }

    throw error;
  }
}

@Injectable()
export class RunSchedulerService {
  private readonly queuedRunIds: number[] = [];
  private isDraining = false;

  constructor(
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    @Inject(RunsService)
    private readonly runsService: RunsService,
    @Inject(RunArtifactsService)
    private readonly runArtifactsService: RunArtifactsService,
    @Inject(RunProbeService)
    private readonly runProbeService: RunProbeService,
    @Inject(ResultsJsonIngestService)
    private readonly resultsJsonIngestService: ResultsJsonIngestService,
    @Inject(SmokeRunConfigService)
    private readonly smokeRunConfigService: SmokeRunConfigService,
  ) {}

  enqueueRun(runId: number): void {
    this.queuedRunIds.push(runId);
    void this.drainQueue();
  }

  private async drainQueue(): Promise<void> {
    if (this.isDraining) {
      return;
    }

    this.isDraining = true;

    try {
      while (this.queuedRunIds.length > 0) {
        const runId = this.queuedRunIds.shift();

        if (runId === undefined) {
          continue;
        }

        try {
          await this.executeRun(runId);
        } catch {
          // Keep draining so one failed run cannot strand later queued work.
        }
      }
    } finally {
      this.isDraining = false;
    }
  }

  private async executeRun(runId: number): Promise<void> {
    const runRecord = await this.runsService.loadRunForExecution(runId);

    if (runRecord === null || runRecord.status !== 'pending') {
      return;
    }

    try {
      await this.runProbeService.probeSmokeRunUrl(runRecord.probe_url, {
        retryCount: 2,
        timeoutMs: 3_000,
      });
    } catch {
      await this.terminalizeRun(runRecord.id, {
        status: 'fail',
        reason: 'probe_failed',
        exitCode: null,
        startTime: null,
        endTime: new Date(),
        runnerPgid: null,
      });
      return;
    }

    const startTime = new Date();
    await this.prismaService.run.update({
      where: {
        id: runRecord.id,
      },
      data: {
        status: 'running',
        start_time: startTime,
      },
    });

    let artifactPaths: RunArtifactPaths;

    try {
      artifactPaths = await this.runArtifactsService.prepareForSpawn({
        runId: runRecord.id,
        suiteId: runRecord.suite_id,
        suiteNameSnapshot: runRecord.suite_name_snapshot,
        command: runRecord.command,
        cwd: runRecord.cwd,
        sutBaseUrl: runRecord.sut_base_url,
        probeUrl: runRecord.probe_url,
        status: 'running',
        reason: null,
        exitCode: null,
        timeoutMinutes: this.smokeRunConfigService.getConfig().timeoutMinutes,
        createdAt: runRecord.created_at,
        startTime,
        endTime: null,
        durationMs: null,
        runnerPgid: null,
        startedAt: startTime,
        platformPid: process.pid,
      });
    } catch {
      await this.terminalizeRun(runRecord.id, {
        status: 'fail',
        reason: 'parse_or_write_error',
        exitCode: null,
        startTime,
        endTime: new Date(),
        runnerPgid: null,
      });
      return;
    }

    const stdoutStream = createWriteStream(artifactPaths.stdoutLog, {
      flags: 'a',
    });
    const stderrStream = createWriteStream(artifactPaths.stderrLog, {
      flags: 'a',
    });

    const childProcess = spawn(runRecord.command, {
      cwd: runRecord.cwd,
      detached: true,
      env: {
        ...process.env,
        E2E_SUT_BASE_URL: runRecord.sut_base_url,
        E2E_RESULTS_JSON_PATH: artifactPaths.resultsJson,
        E2E_PLAYWRIGHT_REPORT_DIR: artifactPaths.reportDir,
        E2E_TEST_RESULTS_DIR: artifactPaths.testResultsDir,
      },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (childProcess.stdout !== null) {
      childProcess.stdout.pipe(stdoutStream);
    }

    if (childProcess.stderr !== null) {
      childProcess.stderr.pipe(stderrStream);
    }

    const timeoutMs = this.smokeRunConfigService.getConfig().timeoutMs;
    let isTimedOut = false;
    let timeoutKillHandle: NodeJS.Timeout | undefined;

    const completionResult = await new Promise<{
      exitCode: number | null;
      signal: NodeJS.Signals | null;
      hadSpawnError: boolean;
    }>((resolve) => {
      let hasSettled = false;

      const settle = (value: {
        exitCode: number | null;
        signal: NodeJS.Signals | null;
        hadSpawnError: boolean;
      }) => {
        if (hasSettled) {
          return;
        }

        hasSettled = true;
        resolve(value);
      };

      const timeoutHandle = setTimeout(() => {
        isTimedOut = true;

        if (childProcess.pid !== undefined) {
          killProcessGroup(childProcess.pid, 'SIGTERM');

          timeoutKillHandle = setTimeout(() => {
            if (childProcess.pid !== undefined) {
              killProcessGroup(childProcess.pid, 'SIGKILL');
            }
          }, 1_000);
        }
      }, timeoutMs);

      childProcess.once('error', () => {
        clearTimeout(timeoutHandle);
        if (timeoutKillHandle !== undefined) {
          clearTimeout(timeoutKillHandle);
        }
        settle({
          exitCode: null,
          signal: null,
          hadSpawnError: true,
        });
      });

      childProcess.once('close', (exitCode, signal) => {
        clearTimeout(timeoutHandle);
        if (timeoutKillHandle !== undefined) {
          clearTimeout(timeoutKillHandle);
        }
        settle({
          exitCode,
          signal,
          hadSpawnError: false,
        });
      });
    });

    const runnerPgid = childProcess.pid ?? null;
    stdoutStream.end();
    stderrStream.end();

    if (
      isTimedOut ||
      completionResult.signal === 'SIGTERM' ||
      completionResult.signal === 'SIGKILL'
    ) {
      await this.terminalizeRun(runRecord.id, {
        status: 'timeout',
        reason: 'timeout_exceeded',
        exitCode: null,
        startTime,
        endTime: new Date(),
        runnerPgid,
      });
      return;
    }

    if (completionResult.hadSpawnError) {
      await this.terminalizeRun(runRecord.id, {
        status: 'fail',
        reason: 'parse_or_write_error',
        exitCode: null,
        startTime,
        endTime: new Date(),
        runnerPgid,
      });
      return;
    }

    const resultsJson = await this.readResultsJson(runRecord.id);

    if (resultsJson === null) {
      await this.terminalizeRun(runRecord.id, {
        status: 'fail',
        reason:
          completionResult.exitCode !== null && completionResult.exitCode !== 0
            ? 'runner_exit_nonzero'
            : 'parse_or_write_error',
        exitCode: completionResult.exitCode,
        startTime,
        endTime: new Date(),
        runnerPgid,
      });
      return;
    }

    let parsedCaseResults: ParsedPlaywrightCaseResult[];

    try {
      parsedCaseResults =
        await this.resultsJsonIngestService.ingestCaseResultsForRun(
          runRecord.id,
          resultsJson,
        );
    } catch {
      await this.terminalizeRun(runRecord.id, {
        status: 'fail',
        reason: 'parse_or_write_error',
        exitCode: completionResult.exitCode,
        startTime,
        endTime: new Date(),
        runnerPgid,
      });
      return;
    }

    const hasFailedCase = parsedCaseResults.some(
      (parsedCaseResult) => parsedCaseResult.status === 'fail',
    );

    await this.terminalizeRun(runRecord.id, {
      status: hasFailedCase ? 'fail' : 'success',
      reason: hasFailedCase ? 'cases_failed' : null,
      exitCode: completionResult.exitCode,
      startTime,
      endTime: new Date(),
      runnerPgid,
    });
  }

  private async readResultsJson(runId: number): Promise<string | null> {
    try {
      return await readFile(resolveRunArtifactPaths(runId).resultsJson, 'utf8');
    } catch {
      return null;
    }
  }

  private async terminalizeRun(
    runId: number,
    terminalRunStateInput: TerminalRunStateInput,
  ): Promise<void> {
    const durationMs = toDurationMs(
      terminalRunStateInput.startTime,
      terminalRunStateInput.endTime,
    );

    const runRecord = await this.prismaService.run.update({
      where: {
        id: runId,
      },
      data: {
        status: terminalRunStateInput.status,
        reason: terminalRunStateInput.reason,
        exit_code: terminalRunStateInput.exitCode,
        end_time: terminalRunStateInput.endTime,
        duration_ms: durationMs,
      },
      select: {
        id: true,
        suite_id: true,
        suite_name_snapshot: true,
        status: true,
        reason: true,
        exit_code: true,
        created_at: true,
        start_time: true,
        end_time: true,
        duration_ms: true,
        command: true,
        cwd: true,
        sut_base_url: true,
        probe_url: true,
      },
    });

    await this.runArtifactsService.writeTerminalSnapshot({
      runId: runRecord.id,
      suiteId: runRecord.suite_id,
      suiteNameSnapshot: runRecord.suite_name_snapshot,
      command: runRecord.command,
      cwd: runRecord.cwd,
      sutBaseUrl: runRecord.sut_base_url,
      probeUrl: runRecord.probe_url,
      status: runRecord.status as 'success' | 'abort' | 'fail' | 'timeout',
      reason: runRecord.reason,
      exitCode: runRecord.exit_code,
      timeoutMinutes: this.smokeRunConfigService.getConfig().timeoutMinutes,
      createdAt: runRecord.created_at,
      startTime: runRecord.start_time,
      endTime: runRecord.end_time,
      durationMs: runRecord.duration_ms,
      runnerPgid: terminalRunStateInput.runnerPgid,
      startedAt: runRecord.start_time,
      platformPid: process.pid,
    });
  }
}
