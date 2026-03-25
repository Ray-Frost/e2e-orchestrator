export type RunArtifactStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'abort'
  | 'fail'
  | 'timeout'
  | 'cancelled';

export interface RunArtifactMetaSnapshotInput {
  runId: number;
  suiteId: number;
  suiteNameSnapshot: string;
  command: string;
  cwd: string;
  sutBaseUrl: string;
  probeUrl: string;
  status: RunArtifactStatus;
  reason?: string | null;
  exitCode?: number | null;
  timeoutMinutes?: number | null;
  createdAt: Date | string;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  durationMs?: number | null;
  runnerPgid?: number | null;
  startedAt?: Date | string | null;
  platformPid?: number | null;
}

export interface RunArtifactMetaSnapshot {
  meta_schema_version: 1;
  identity: {
    run: {
      id: number;
    };
    suite: {
      id: number;
      suite_name_snapshot: string;
    };
  };
  execution: {
    command: string;
    cwd: string;
  };
  config: {
    sut_base_url: string;
    probe_url: string;
  };
  result: {
    status: RunArtifactStatus;
    reason: string | null;
    exit_code: number | null;
    timeout_minutes: number | null;
  };
  timing: {
    created_at: string;
    start_time: string | null;
    end_time: string | null;
    duration_ms: number | null;
  };
  process: {
    runner_pgid: number | null;
    started_at: string | null;
    platform_pid: number | null;
  };
}

type RunArtifactTimestampInput = Date | string;
type NullableRunArtifactTimestampInput =
  | RunArtifactTimestampInput
  | null
  | undefined;

function serializeSnapshotTimestamp(value: RunArtifactTimestampInput): string;
function serializeSnapshotTimestamp(
  value: NullableRunArtifactTimestampInput,
): string | null;
function serializeSnapshotTimestamp(
  value: NullableRunArtifactTimestampInput,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(normalizedDate.valueOf())) {
    throw new TypeError(`Invalid date value: ${String(value)}`);
  }

  return normalizedDate.toISOString();
}

export function buildRunArtifactMetaSnapshot(
  input: RunArtifactMetaSnapshotInput,
): RunArtifactMetaSnapshot {
  return {
    meta_schema_version: 1,
    identity: {
      run: {
        id: input.runId,
      },
      suite: {
        id: input.suiteId,
        suite_name_snapshot: input.suiteNameSnapshot,
      },
    },
    execution: {
      command: input.command,
      cwd: input.cwd,
    },
    config: {
      sut_base_url: input.sutBaseUrl,
      probe_url: input.probeUrl,
    },
    result: {
      status: input.status,
      reason: input.reason ?? null,
      exit_code: input.exitCode ?? null,
      timeout_minutes: input.timeoutMinutes ?? null,
    },
    timing: {
      created_at: serializeSnapshotTimestamp(input.createdAt),
      start_time: serializeSnapshotTimestamp(input.startTime),
      end_time: serializeSnapshotTimestamp(input.endTime),
      duration_ms: input.durationMs ?? null,
    },
    process: {
      runner_pgid: input.runnerPgid ?? null,
      started_at: serializeSnapshotTimestamp(input.startedAt),
      platform_pid: input.platformPid ?? process.pid,
    },
  };
}
