import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveRunArtifactPaths } from './artifact-persistence/artifact-paths';
import { SmokeRunConfigService } from './smoke-run-config';
import { SmokeSuiteService } from './smoke-suite.service';
import type {
  RunArtifactPresence,
  RunDetail,
  RunExecutionContext,
  RunResultSummary,
  RunSummary,
} from './runs.types';

interface RunSummaryRecord {
  id: number;
  suite_id: number;
  suite_name_snapshot: string;
  status: string;
  reason: string | null;
  exit_code: number | null;
  created_at: Date;
  start_time: Date | null;
  end_time: Date | null;
  duration_ms: number | null;
}

interface RunDetailRecord extends RunSummaryRecord {
  command: string;
  cwd: string;
  sut_base_url: string;
  probe_url: string;
}

function toRunSummary(runRecord: RunSummaryRecord): RunSummary {
  return {
    id: runRecord.id,
    suite_id: runRecord.suite_id,
    suite_name: runRecord.suite_name_snapshot,
    status: runRecord.status as RunSummary['status'],
    reason: runRecord.reason,
    exit_code: runRecord.exit_code,
    created_at: runRecord.created_at,
    start_time: runRecord.start_time,
    end_time: runRecord.end_time,
    duration_ms: runRecord.duration_ms,
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  const { access } = await import('node:fs/promises');

  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getRunArtifactPresence(
  runId: number,
): Promise<RunArtifactPresence> {
  const artifactPaths = resolveRunArtifactPaths(runId);

  return {
    stdout_log: await pathExists(artifactPaths.stdoutLog),
    stderr_log: await pathExists(artifactPaths.stderrLog),
    results_json: await pathExists(artifactPaths.resultsJson),
    report_dir: await pathExists(artifactPaths.reportDir),
  };
}

async function getRunResultSummary(
  prismaService: PrismaService,
  runId: number,
): Promise<RunResultSummary | null> {
  const groupedCounts = await prismaService.caseResult.groupBy({
    by: ['status'],
    where: {
      run_id: runId,
    },
    _count: {
      _all: true,
    },
  });

  if (groupedCounts.length === 0) {
    return null;
  }

  let totalCount = 0;
  let passedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const groupedCount of groupedCounts) {
    totalCount += groupedCount._count._all;

    if (groupedCount.status === 'pass') {
      passedCount = groupedCount._count._all;
      continue;
    }

    if (groupedCount.status === 'fail') {
      failedCount = groupedCount._count._all;
      continue;
    }

    if (groupedCount.status === 'skip') {
      skippedCount = groupedCount._count._all;
    }
  }

  return {
    total_count: totalCount,
    passed_count: passedCount,
    failed_count: failedCount,
    skipped_count: skippedCount,
  };
}

@Injectable()
export class RunsService {
  constructor(
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    @Inject(SmokeRunConfigService)
    private readonly smokeRunConfigService: SmokeRunConfigService,
    @Inject(SmokeSuiteService)
    private readonly smokeSuiteService: SmokeSuiteService,
  ) {}

  async createPendingRun(suiteId: number): Promise<RunSummary> {
    const suiteRecord = await this.smokeSuiteService.getSuiteById(suiteId);

    if (suiteRecord === null) {
      throw new NotFoundException({
        error: {
          message: `Suite ${suiteId} was not found.`,
        },
      });
    }

    const smokeRunConfig = this.smokeRunConfigService.getConfig();
    const createdRun = await this.prismaService.run.create({
      data: {
        suite_id: suiteRecord.id,
        suite_name_snapshot: suiteRecord.suite_name,
        status: 'pending',
        command: suiteRecord.command,
        cwd: smokeRunConfig.cwd,
        sut_base_url: smokeRunConfig.sutBaseUrl,
        probe_url: smokeRunConfig.probeUrl,
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
      },
    });

    return toRunSummary(createdRun as RunSummaryRecord);
  }

  async listRuns(): Promise<RunSummary[]> {
    const runRecords = (await this.prismaService.run.findMany({
      orderBy: {
        created_at: 'desc',
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
      },
    })) as RunSummaryRecord[];

    return runRecords.map(toRunSummary);
  }

  async getRunById(runId: number): Promise<RunDetail | null> {
    const runRecord = (await this.prismaService.run.findUnique({
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
    })) as RunDetailRecord | null;

    if (runRecord === null) {
      return null;
    }

    const [artifactPresence, resultSummary] = await Promise.all([
      getRunArtifactPresence(runRecord.id),
      getRunResultSummary(this.prismaService, runRecord.id),
    ]);

    return {
      ...toRunSummary(runRecord),
      command: runRecord.command,
      cwd: runRecord.cwd,
      sut_base_url: runRecord.sut_base_url,
      probe_url: runRecord.probe_url,
      artifacts: artifactPresence,
      result_summary: resultSummary,
    };
  }

  async loadRunForExecution(
    runId: number,
  ): Promise<RunExecutionContext | null> {
    return (await this.prismaService.run.findUnique({
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
    })) as RunExecutionContext | null;
  }
}
