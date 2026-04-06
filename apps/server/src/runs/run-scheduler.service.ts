import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import type { RunExecutionContext, RunStatus, RunSummary } from './runs.types';

interface TerminalRunStateInput {
  status: 'success' | 'fail' | 'timeout' | 'cancelled';
  reason: string | null;
  exitCode: number | null;
  startTime: Date | null;
  endTime: Date;
  runnerPgid: number | null;
  expectedCurrentStatus: 'pending' | 'running';
}

interface ProcessCompletionResult {
  didTimeOut: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  hadSpawnError: boolean;
}

interface DeferredPromise<Value> {
  promise: Promise<Value>;
  rejectPromise: (error: unknown) => void;
  resolvePromise: (value: Value) => void;
}

interface ActiveRunExecution {
  runId: number;
  childProcess: ReturnType<typeof spawn> | null;
  runnerPgid: number | null;
  cancellationRequested: boolean;
  completionPromise: Promise<RunSummary | null>;
  rejectCompletionPromise: (error: unknown) => void;
  resolveCompletionPromise: (value: RunSummary | null) => void;
  timeoutHandle: NodeJS.Timeout | null;
  timeoutKillHandle: NodeJS.Timeout | null;
}

interface TerminalRunRecord {
  id: number;
  suite_id: number;
  suite_name_snapshot: string;
  status: RunStatus;
  reason: string | null;
  exit_code: number | null;
  created_at: Date;
  start_time: Date | null;
  end_time: Date | null;
  duration_ms: number | null;
  command: string;
  cwd: string;
  sut_base_url: string;
  probe_url: string;
}

function createDeferredPromise<Value>(): DeferredPromise<Value> {
  let resolvePromise!: (value: Value) => void;
  let rejectPromise!: (error: unknown) => void;

  const promise = new Promise<Value>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolvePromise,
    rejectPromise,
  };
}

function toDurationMs(startTime: Date | null, endTime: Date): number | null {
  if (startTime === null) {
    return null;
  }

  return endTime.getTime() - startTime.getTime();
}

function toRunSummary(runRecord: TerminalRunRecord): RunSummary {
  return {
    id: runRecord.id,
    suite_id: runRecord.suite_id,
    suite_name: runRecord.suite_name_snapshot,
    status: runRecord.status,
    reason: runRecord.reason,
    exit_code: runRecord.exit_code,
    created_at: runRecord.created_at,
    start_time: runRecord.start_time,
    end_time: runRecord.end_time,
    duration_ms: runRecord.duration_ms,
  };
}

function isActiveRunStatus(status: RunStatus): boolean {
  return status === 'pending' || status === 'running';
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
  private activeRunExecution: ActiveRunExecution | null = null;

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

  async cancelRun(runId: number): Promise<RunSummary> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const runSummary = await this.runsService.getRunSummaryById(runId);

      if (runSummary === null) {
        throw this.createRunNotFoundException(runId);
      }

      if (runSummary.status === 'pending') {
        this.removeQueuedRun(runId);

        const cancelledRun = await this.runsService.cancelPendingRun(
          runId,
          new Date(),
        );

        if (cancelledRun !== null) {
          return cancelledRun;
        }

        continue;
      }

      if (runSummary.status === 'running') {
        const completedRun = await this.cancelRunningRun(runId);

        if (completedRun === null) {
          continue;
        }

        if (completedRun.status === 'cancelled') {
          return completedRun;
        }

        if (!isActiveRunStatus(completedRun.status)) {
          throw this.createRunNoLongerCancelableException(runId);
        }
      }

      if (!isActiveRunStatus(runSummary.status)) {
        throw this.createRunNoLongerCancelableException(runId);
      }
    }

    throw this.createRunNoLongerCancelableException(runId);
  }

  private async cancelRunningRun(runId: number): Promise<RunSummary | null> {
    const activeRunExecution = this.activeRunExecution;

    if (activeRunExecution === null || activeRunExecution.runId !== runId) {
      return this.runsService.getRunSummaryById(runId);
    }

    activeRunExecution.cancellationRequested = true;
    this.clearRunTimeoutHandles(activeRunExecution);
    this.terminateRunProcessGroup(activeRunExecution);

    return activeRunExecution.completionPromise;
  }

  private removeQueuedRun(runId: number): void {
    const queueIndex = this.queuedRunIds.indexOf(runId);

    if (queueIndex >= 0) {
      this.queuedRunIds.splice(queueIndex, 1);
    }
  }

  private createRunNotFoundException(runId: number): NotFoundException {
    return new NotFoundException({
      error: {
        message: `Run ${runId} was not found.`,
      },
    });
  }

  private createRunNoLongerCancelableException(
    runId: number,
  ): BadRequestException {
    return new BadRequestException({
      error: {
        message: `Run ${runId} can no longer be cancelled.`,
      },
    });
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
        expectedCurrentStatus: 'pending',
      });
      return;
    }

    const startTime = new Date();
    const activeRunExecution = this.createActiveRunExecution(runRecord.id);
    this.activeRunExecution = activeRunExecution;

    try {
      const hasRunBeenMarkedRunning = await this.markRunAsRunning(
        runRecord.id,
        startTime,
      );

      if (!hasRunBeenMarkedRunning) {
        this.finishActiveRunExecution(activeRunExecution, null);
        return;
      }

      const cancelledBeforeSpawn = await this.maybeCancelRunningRun(
        runRecord.id,
        startTime,
        activeRunExecution,
      );

      if (cancelledBeforeSpawn !== null) {
        this.finishActiveRunExecution(activeRunExecution, cancelledBeforeSpawn);
        return;
      }

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
        const failedRun = await this.terminalizeRun(runRecord.id, {
          status: 'fail',
          reason: 'parse_or_write_error',
          exitCode: null,
          startTime,
          endTime: new Date(),
          runnerPgid: null,
          expectedCurrentStatus: 'running',
        });

        this.finishActiveRunExecution(activeRunExecution, failedRun);
        return;
      }

      const cancelledAfterArtifacts = await this.maybeCancelRunningRun(
        runRecord.id,
        startTime,
        activeRunExecution,
      );

      if (cancelledAfterArtifacts !== null) {
        this.finishActiveRunExecution(
          activeRunExecution,
          cancelledAfterArtifacts,
        );
        return;
      }

      const terminalRun = await this.executeSpawnedRun(
        runRecord,
        startTime,
        artifactPaths,
        activeRunExecution,
      );

      this.finishActiveRunExecution(activeRunExecution, terminalRun);
    } catch (error) {
      this.failActiveRunExecution(activeRunExecution, error);
      throw error;
    }
  }

  private createActiveRunExecution(runId: number): ActiveRunExecution {
    const deferredPromise = createDeferredPromise<RunSummary | null>();

    return {
      runId,
      childProcess: null,
      runnerPgid: null,
      cancellationRequested: false,
      completionPromise: deferredPromise.promise,
      resolveCompletionPromise: deferredPromise.resolvePromise,
      rejectCompletionPromise: deferredPromise.rejectPromise,
      timeoutHandle: null,
      timeoutKillHandle: null,
    };
  }

  private finishActiveRunExecution(
    activeRunExecution: ActiveRunExecution,
    runSummary: RunSummary | null,
  ): void {
    this.clearRunTimeoutHandles(activeRunExecution);

    if (this.activeRunExecution === activeRunExecution) {
      this.activeRunExecution = null;
    }

    activeRunExecution.resolveCompletionPromise(runSummary);
  }

  private failActiveRunExecution(
    activeRunExecution: ActiveRunExecution,
    error: unknown,
  ): void {
    this.clearRunTimeoutHandles(activeRunExecution);

    if (this.activeRunExecution === activeRunExecution) {
      this.activeRunExecution = null;
    }

    activeRunExecution.rejectCompletionPromise(error);
  }

  private clearRunTimeoutHandles(activeRunExecution: ActiveRunExecution): void {
    if (activeRunExecution.timeoutHandle !== null) {
      clearTimeout(activeRunExecution.timeoutHandle);
      activeRunExecution.timeoutHandle = null;
    }

    if (activeRunExecution.timeoutKillHandle !== null) {
      clearTimeout(activeRunExecution.timeoutKillHandle);
      activeRunExecution.timeoutKillHandle = null;
    }
  }

  private terminateRunProcessGroup(
    activeRunExecution: ActiveRunExecution,
  ): void {
    const processId = activeRunExecution.childProcess?.pid;

    if (processId === undefined) {
      return;
    }

    killProcessGroup(processId, 'SIGTERM');

    activeRunExecution.timeoutKillHandle = setTimeout(() => {
      const currentProcessId = activeRunExecution.childProcess?.pid;

      if (currentProcessId !== undefined) {
        killProcessGroup(currentProcessId, 'SIGKILL');
      }
    }, 1_000);
  }

  private async markRunAsRunning(
    runId: number,
    startTime: Date,
  ): Promise<boolean> {
    const updatedRunCount = await this.prismaService.run.updateMany({
      where: {
        id: runId,
        status: 'pending',
      },
      data: {
        status: 'running',
        start_time: startTime,
      },
    });

    return updatedRunCount.count > 0;
  }

  private async maybeCancelRunningRun(
    runId: number,
    startTime: Date,
    activeRunExecution: ActiveRunExecution,
  ): Promise<RunSummary | null> {
    if (!activeRunExecution.cancellationRequested) {
      return null;
    }

    return this.terminalizeRun(runId, {
      status: 'cancelled',
      reason: 'user_cancelled',
      exitCode: null,
      startTime,
      endTime: new Date(),
      runnerPgid: activeRunExecution.runnerPgid,
      expectedCurrentStatus: 'running',
    });
  }

  private async executeSpawnedRun(
    runRecord: RunExecutionContext,
    startTime: Date,
    artifactPaths: RunArtifactPaths,
    activeRunExecution: ActiveRunExecution,
  ): Promise<RunSummary | null> {
    const stdoutStream = createWriteStream(artifactPaths.stdoutLog, {
      flags: 'a',
    });
    const stderrStream = createWriteStream(artifactPaths.stderrLog, {
      flags: 'a',
    });

    try {
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

      activeRunExecution.childProcess = childProcess;
      activeRunExecution.runnerPgid = childProcess.pid ?? null;

      if (childProcess.stdout !== null) {
        childProcess.stdout.pipe(stdoutStream);
      }

      if (childProcess.stderr !== null) {
        childProcess.stderr.pipe(stderrStream);
      }

      const completionResult = await this.awaitProcessCompletion(
        childProcess,
        activeRunExecution,
      );

      const cancelledAfterExit = await this.maybeCancelRunningRun(
        runRecord.id,
        startTime,
        activeRunExecution,
      );

      if (cancelledAfterExit !== null) {
        return cancelledAfterExit;
      }

      if (
        completionResult.didTimeOut ||
        completionResult.signal === 'SIGTERM' ||
        completionResult.signal === 'SIGKILL'
      ) {
        return this.terminalizeRun(runRecord.id, {
          status: 'timeout',
          reason: 'timeout_exceeded',
          exitCode: null,
          startTime,
          endTime: new Date(),
          runnerPgid: activeRunExecution.runnerPgid,
          expectedCurrentStatus: 'running',
        });
      }

      if (completionResult.hadSpawnError) {
        return this.terminalizeRun(runRecord.id, {
          status: 'fail',
          reason: 'parse_or_write_error',
          exitCode: null,
          startTime,
          endTime: new Date(),
          runnerPgid: activeRunExecution.runnerPgid,
          expectedCurrentStatus: 'running',
        });
      }

      const resultsJson = await this.readResultsJson(runRecord.id);

      const cancelledAfterRead = await this.maybeCancelRunningRun(
        runRecord.id,
        startTime,
        activeRunExecution,
      );

      if (cancelledAfterRead !== null) {
        return cancelledAfterRead;
      }

      if (resultsJson === null) {
        return this.terminalizeRun(runRecord.id, {
          status: 'fail',
          reason:
            completionResult.exitCode !== null &&
            completionResult.exitCode !== 0
              ? 'runner_exit_nonzero'
              : 'parse_or_write_error',
          exitCode: completionResult.exitCode,
          startTime,
          endTime: new Date(),
          runnerPgid: activeRunExecution.runnerPgid,
          expectedCurrentStatus: 'running',
        });
      }

      let parsedCaseResults: ParsedPlaywrightCaseResult[];

      try {
        parsedCaseResults =
          await this.resultsJsonIngestService.ingestCaseResultsForRun(
            runRecord.id,
            resultsJson,
          );
      } catch {
        return this.terminalizeRun(runRecord.id, {
          status: 'fail',
          reason: 'parse_or_write_error',
          exitCode: completionResult.exitCode,
          startTime,
          endTime: new Date(),
          runnerPgid: activeRunExecution.runnerPgid,
          expectedCurrentStatus: 'running',
        });
      }

      const cancelledAfterIngest = await this.maybeCancelRunningRun(
        runRecord.id,
        startTime,
        activeRunExecution,
      );

      if (cancelledAfterIngest !== null) {
        return cancelledAfterIngest;
      }

      const hasFailedCase = parsedCaseResults.some(
        (parsedCaseResult) => parsedCaseResult.status === 'fail',
      );

      return this.terminalizeRun(runRecord.id, {
        status: hasFailedCase ? 'fail' : 'success',
        reason: hasFailedCase ? 'cases_failed' : null,
        exitCode: completionResult.exitCode,
        startTime,
        endTime: new Date(),
        runnerPgid: activeRunExecution.runnerPgid,
        expectedCurrentStatus: 'running',
      });
    } finally {
      stdoutStream.end();
      stderrStream.end();
    }
  }

  private async awaitProcessCompletion(
    childProcess: ReturnType<typeof spawn>,
    activeRunExecution: ActiveRunExecution,
  ): Promise<ProcessCompletionResult> {
    const timeoutMs = this.smokeRunConfigService.getConfig().timeoutMs;
    let isTimedOut = false;

    return new Promise<ProcessCompletionResult>((resolve) => {
      let hasSettled = false;

      const settle = (value: ProcessCompletionResult) => {
        if (hasSettled) {
          return;
        }

        hasSettled = true;
        this.clearRunTimeoutHandles(activeRunExecution);
        resolve(value);
      };

      activeRunExecution.timeoutHandle = setTimeout(() => {
        isTimedOut = true;
        this.terminateRunProcessGroup(activeRunExecution);
      }, timeoutMs);

      childProcess.once('error', () => {
        settle({
          didTimeOut: isTimedOut,
          exitCode: null,
          signal: null,
          hadSpawnError: true,
        });
      });

      childProcess.once('close', (exitCode, signal) => {
        settle({
          didTimeOut: isTimedOut,
          exitCode,
          signal,
          hadSpawnError: false,
        });
      });
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
  ): Promise<RunSummary | null> {
    const durationMs = toDurationMs(
      terminalRunStateInput.startTime,
      terminalRunStateInput.endTime,
    );

    const runRecord = await this.prismaService.$transaction(
      async (transactionClient) => {
        const updatedRunCount = await transactionClient.run.updateMany({
          where: {
            id: runId,
            status: terminalRunStateInput.expectedCurrentStatus,
          },
          data: {
            status: terminalRunStateInput.status,
            reason: terminalRunStateInput.reason,
            exit_code: terminalRunStateInput.exitCode,
            end_time: terminalRunStateInput.endTime,
            duration_ms: durationMs,
          },
        });

        if (updatedRunCount.count === 0) {
          return null;
        }

        return (await transactionClient.run.findUnique({
          where: {
            id: runId,
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
        })) as TerminalRunRecord | null;
      },
    );

    if (runRecord === null) {
      return this.runsService.getRunSummaryById(runId);
    }

    await this.runArtifactsService.writeTerminalSnapshot({
      runId: runRecord.id,
      suiteId: runRecord.suite_id,
      suiteNameSnapshot: runRecord.suite_name_snapshot,
      command: runRecord.command,
      cwd: runRecord.cwd,
      sutBaseUrl: runRecord.sut_base_url,
      probeUrl: runRecord.probe_url,
      status: runRecord.status,
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

    return toRunSummary(runRecord);
  }
}
