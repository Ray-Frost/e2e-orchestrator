import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRunArtifactMetaSnapshot } from './meta-snapshot';

void test('buildRunArtifactMetaSnapshot serializes the v1 contract', () => {
  const snapshot = buildRunArtifactMetaSnapshot({
    runId: 7,
    suiteId: 3,
    suiteNameSnapshot: 'smoke',
    command: 'npm run test:smoke',
    cwd: '/tmp/demo-test-lib',
    sutBaseUrl: 'http://localhost:3000',
    probeUrl: 'http://localhost:3000/',
    status: 'running',
    reason: null,
    exitCode: null,
    timeoutMinutes: 10,
    createdAt: '2026-03-17T01:00:00.000Z',
    startTime: '2026-03-17T01:01:00.000Z',
    endTime: null,
    durationMs: null,
    runnerPgid: 456,
    startedAt: '2026-03-17T01:01:00.000Z',
    platformPid: 789,
  });

  assert.deepEqual(snapshot, {
    meta_schema_version: 1,
    identity: {
      run: {
        id: 7,
      },
      suite: {
        id: 3,
        suite_name_snapshot: 'smoke',
      },
    },
    execution: {
      command: 'npm run test:smoke',
      cwd: '/tmp/demo-test-lib',
    },
    config: {
      sut_base_url: 'http://localhost:3000',
      probe_url: 'http://localhost:3000/',
    },
    result: {
      status: 'running',
      reason: null,
      exit_code: null,
      timeout_minutes: 10,
    },
    timing: {
      created_at: '2026-03-17T01:00:00.000Z',
      start_time: '2026-03-17T01:01:00.000Z',
      end_time: null,
      duration_ms: null,
    },
    process: {
      runner_pgid: 456,
      started_at: '2026-03-17T01:01:00.000Z',
      platform_pid: 789,
    },
  });
});

void test('buildRunArtifactMetaSnapshot rejects invalid timestamp values', () => {
  assert.throws(
    () =>
      buildRunArtifactMetaSnapshot({
        runId: 7,
        suiteId: 3,
        suiteNameSnapshot: 'smoke',
        command: 'npm run test:smoke',
        cwd: '/tmp/demo-test-lib',
        sutBaseUrl: 'http://localhost:3000',
        probeUrl: 'http://localhost:3000/',
        status: 'running',
        createdAt: 'not-a-date',
      }),
    /Invalid date value: not-a-date/,
  );
});
