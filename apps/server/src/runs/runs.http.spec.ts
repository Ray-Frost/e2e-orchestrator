import assert from 'node:assert/strict';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
  mkdir,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import {
  ARTIFACTS_ROOT_PATH,
  resolveRunArtifactPaths,
} from './artifact-persistence/artifact-paths';
import { PrismaService } from '../prisma/prisma.service';
import { SmokeRunConfigService } from './smoke-run-config';

interface SuiteSummaryResponse {
  id: number;
  suite_name: string;
  command: string;
  sut_base_url: string;
}

interface RunSummaryResponse {
  id: number;
  suite_id: number;
  suite_name: string;
  status: string;
  reason: string | null;
  exit_code: number | null;
  created_at: string;
  start_time: string | null;
  end_time: string | null;
  duration_ms: number | null;
}

interface RunDetailResponse extends RunSummaryResponse {
  command: string;
  cwd: string;
  sut_base_url: string;
  probe_url: string;
  artifacts: {
    stdout_log: boolean;
    stderr_log: boolean;
    results_json: boolean;
    report_dir: boolean;
  };
  result_summary: {
    total_count: number;
    passed_count: number;
    failed_count: number;
    skipped_count: number;
  } | null;
}

interface RunListItemResponse extends RunSummaryResponse {
  suite_name: string;
}

function createHttpRequest(app: INestApplication) {
  const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  return request(httpServer);
}

function readJsonBody<T>(response: request.Response): T {
  return response.body as T;
}

async function initializeTestDatabaseSchema(prismaClient: PrismaClient) {
  const serverRoot = path.resolve(__dirname, '../../');
  const migrationRootPath = path.join(serverRoot, 'prisma/migrations');
  const migrationDirectoryEntries = await readdir(migrationRootPath, {
    withFileTypes: true,
  });
  const migrationDirectoryNames = migrationDirectoryEntries
    .filter((directoryEntry) => directoryEntry.isDirectory())
    .map((directoryEntry) => directoryEntry.name)
    .sort();

  for (const migrationDirectoryName of migrationDirectoryNames) {
    const migrationSql = await readFile(
      path.join(migrationRootPath, migrationDirectoryName, 'migration.sql'),
      'utf8',
    );
    const migrationStatements = migrationSql
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const migrationStatement of migrationStatements) {
      await prismaClient.$executeRawUnsafe(`${migrationStatement};`);
    }
  }
}

async function createProbeServer(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();

  if (
    address === null ||
    typeof address === 'string' ||
    typeof address.port !== 'number'
  ) {
    throw new Error('Failed to bind the probe server.');
  }

  return {
    server,
    url: `http://127.0.0.1:${address.port}/`,
  };
}

async function createFakeRunnerWorkspace(workspaceRoot: string) {
  const cwd = path.join(workspaceRoot, 'demo-test-lib');
  await mkdir(cwd, { recursive: true });

  const fakeRunnerScriptPath = path.join(cwd, 'fake-runner.mjs');
  const fakeRunnerChildScriptPath = path.join(cwd, 'fake-runner-child.mjs');
  await writeFile(
    path.join(cwd, 'package.json'),
    JSON.stringify(
      {
        name: 'demo-test-lib',
        private: true,
        scripts: {
          'test:smoke:platform': 'node fake-runner.mjs',
          'test:smoke:platform:with-30-second-case': 'node fake-runner.mjs',
          'test:smoke:platform:with-failure': 'node fake-runner.mjs',
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    fakeRunnerChildScriptPath,
    `
      import { writeFile } from 'node:fs/promises';

      const readyPath = process.env.FAKE_CHILD_READY_PATH;
      const markerPath = process.env.FAKE_CHILD_MARKER_PATH;
      const markerDelayMs = Number(process.env.FAKE_CHILD_MARKER_DELAY_MS ?? '750');

      if (readyPath) {
        await writeFile(readyPath, 'ready', 'utf8');
      }

      await new Promise((resolve) => setTimeout(resolve, markerDelayMs));

      if (markerPath) {
        await writeFile(markerPath, 'child-survived', 'utf8');
      }

      await new Promise((resolve) => setTimeout(resolve, 5_000));
    `,
    'utf8',
  );

  await writeFile(
    fakeRunnerScriptPath,
    `
      import { spawn } from 'node:child_process';
      import { mkdir, writeFile } from 'node:fs/promises';

      const mode = process.env.FAKE_RUNNER_MODE ?? 'success';
      const resultsJsonPath = process.env.E2E_RESULTS_JSON_PATH;
      const reportDir = process.env.E2E_PLAYWRIGHT_REPORT_DIR;
      const testResultsDir = process.env.E2E_TEST_RESULTS_DIR;
      const delayMs = Number(process.env.FAKE_RUNNER_DELAY_MS ?? '0');
      const childScriptPath = ${JSON.stringify(fakeRunnerChildScriptPath)};

      process.stdout.write((process.env.FAKE_RUNNER_STDOUT_TEXT ?? 'fake runner stdout') + '\\n');
      process.stderr.write((process.env.FAKE_RUNNER_STDERR_TEXT ?? 'fake runner stderr') + '\\n');

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      if (mode === 'slow') {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }

      if (mode === 'child-process') {
        const spawnedChildProcess = spawn(process.execPath, [childScriptPath], {
          env: process.env,
          stdio: 'ignore',
        });
        spawnedChildProcess.unref();
        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }

      if (reportDir) {
        await mkdir(reportDir, { recursive: true });
      }

      if (testResultsDir) {
        await mkdir(testResultsDir, { recursive: true });
      }

      if (mode === 'malformed') {
        if (resultsJsonPath) {
          await writeFile(resultsJsonPath, '{not-json}', 'utf8');
        }

        process.exit(0);
      }

      if (mode === 'nonzero-no-results') {
        process.exit(1);
      }

      const caseCode = mode === 'failing-case'
        ? 'AUTH_LOGIN_INVALID_PASSWORD'
        : 'AUTH_LOGIN_SUCCESS_ADD_ASSET';
      const caseTitle = mode === 'failing-case'
        ? 'Shows an invalid password error'
        : 'User logs in successfully and clicks Add Asset';
      const finalStatus = mode === 'failing-case' ? 'failed' : 'passed';
      const duration = mode === 'failing-case' ? 15 : 5;
      const startTime = new Date(Date.now() - duration).toISOString();
      const testResult = {
        status: finalStatus,
        duration,
        startTime,
        annotations: [
          {
            type: 'test_lib_case_code',
            description: caseCode,
          },
        ],
      };

      const resultsJson = {
        suites: [
          {
            title: 'smoke.spec.ts',
            specs: [
              {
                title: caseTitle,
                tests: [
                  {
                    annotations: [
                      {
                        type: 'test_lib_case_code',
                        description: caseCode,
                      },
                    ],
                    results: [testResult],
                  },
                ],
              },
            ],
          },
        ],
      };

      if (resultsJsonPath) {
        await writeFile(resultsJsonPath, JSON.stringify(resultsJson, null, 2), 'utf8');
      }

      process.exit(mode === 'nonzero' ? 1 : 0);
    `,
    'utf8',
  );

  return cwd;
}

async function createRunsHttpHarness(
  testContext: {
    after: (callback: () => void | Promise<void>) => void;
  },
  options: {
    probeStatus?: number;
    timeoutMs?: number;
    runnerMode?: string;
    runnerDelayMs?: number;
  } = {},
) {
  const sandboxRoot = await mkdtemp(path.join(os.tmpdir(), 'runs-http-'));
  const databasePath = path.join(sandboxRoot, 'runs.sqlite');
  const databaseUrl = `file:${databasePath}`;
  const childReadyPath = path.join(sandboxRoot, 'child-ready.txt');
  const childMarkerPath = path.join(sandboxRoot, 'child-marker.txt');
  const prismaClient = new PrismaService({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  const probeServer = await createProbeServer((_request, response) => {
    response.statusCode = options.probeStatus ?? 204;
    response.end('ok');
  });

  const runnerWorkspaceRoot = path.join(sandboxRoot, 'runner');
  const runnerCwd = await createFakeRunnerWorkspace(runnerWorkspaceRoot);

  const smokeRunConfig = {
    suiteName: 'demo-smoke',
    command: 'npm run test:smoke:platform',
    cwd: runnerCwd,
    sutBaseUrl: 'http://localhost:3000',
    probeUrl: probeServer.url,
    timeoutMinutes: 1,
    timeoutMs: options.timeoutMs ?? 1_000,
  };

  const originalEnv = {
    FAKE_RUNNER_MODE: process.env.FAKE_RUNNER_MODE,
    FAKE_RUNNER_DELAY_MS: process.env.FAKE_RUNNER_DELAY_MS,
    FAKE_RUNNER_STDOUT_TEXT: process.env.FAKE_RUNNER_STDOUT_TEXT,
    FAKE_RUNNER_STDERR_TEXT: process.env.FAKE_RUNNER_STDERR_TEXT,
    FAKE_CHILD_READY_PATH: process.env.FAKE_CHILD_READY_PATH,
    FAKE_CHILD_MARKER_PATH: process.env.FAKE_CHILD_MARKER_PATH,
    FAKE_CHILD_MARKER_DELAY_MS: process.env.FAKE_CHILD_MARKER_DELAY_MS,
  };

  process.env.FAKE_RUNNER_MODE = options.runnerMode ?? 'success';
  process.env.FAKE_RUNNER_DELAY_MS =
    options.runnerDelayMs === undefined
      ? undefined
      : String(options.runnerDelayMs);
  process.env.FAKE_RUNNER_STDOUT_TEXT = 'runner stdout';
  process.env.FAKE_RUNNER_STDERR_TEXT = 'runner stderr';
  process.env.FAKE_CHILD_READY_PATH = childReadyPath;
  process.env.FAKE_CHILD_MARKER_PATH = childMarkerPath;
  process.env.FAKE_CHILD_MARKER_DELAY_MS = '750';

  await rm(ARTIFACTS_ROOT_PATH, { force: true, recursive: true });

  testContext.after(async () => {
    await prismaClient.$disconnect();
    await new Promise<void>((resolve) =>
      probeServer.server.close(() => resolve()),
    );
    await rm(sandboxRoot, { force: true, recursive: true });
    await rm(ARTIFACTS_ROOT_PATH, { force: true, recursive: true });
    process.env.FAKE_RUNNER_MODE = originalEnv.FAKE_RUNNER_MODE;
    process.env.FAKE_RUNNER_DELAY_MS = originalEnv.FAKE_RUNNER_DELAY_MS;
    process.env.FAKE_RUNNER_STDOUT_TEXT = originalEnv.FAKE_RUNNER_STDOUT_TEXT;
    process.env.FAKE_RUNNER_STDERR_TEXT = originalEnv.FAKE_RUNNER_STDERR_TEXT;
    process.env.FAKE_CHILD_READY_PATH = originalEnv.FAKE_CHILD_READY_PATH;
    process.env.FAKE_CHILD_MARKER_PATH = originalEnv.FAKE_CHILD_MARKER_PATH;
    process.env.FAKE_CHILD_MARKER_DELAY_MS =
      originalEnv.FAKE_CHILD_MARKER_DELAY_MS;
  });

  await initializeTestDatabaseSchema(prismaClient);

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prismaClient)
    .overrideProvider(SmokeRunConfigService)
    .useValue({
      getConfig: () => smokeRunConfig,
    })
    .compile();
  const app = moduleRef.createNestApplication<INestApplication>();

  testContext.after(async () => {
    await app.close();
  });

  app.setGlobalPrefix('api');
  await app.init();

  return {
    app,
    childMarkerPath,
    childReadyPath,
    prismaClient,
  };
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function waitForRunToReachTerminalState(
  prismaClient: PrismaClient,
  runId: number,
  timeoutMs: number,
) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const runRecord = await prismaClient.run.findUnique({
      where: {
        id: runId,
      },
    });

    if (
      runRecord !== null &&
      ['success', 'fail', 'timeout', 'cancelled', 'abort'].includes(
        runRecord.status,
      )
    ) {
      return runRecord;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Run ${runId} did not reach a terminal state in time.`);
}

async function waitForRunToReachStatus(
  prismaClient: PrismaClient,
  runId: number,
  expectedStatus: string,
  timeoutMs: number,
) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const runRecord = await prismaClient.run.findUnique({
      where: {
        id: runId,
      },
    });

    if (runRecord !== null && runRecord.status === expectedStatus) {
      return runRecord;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Run ${runId} did not reach ${expectedStatus} in time.`);
}

async function waitForRunToStayPending(
  prismaClient: PrismaClient,
  runId: number,
  timeoutMs: number,
) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const runRecord = await prismaClient.run.findUnique({
      where: {
        id: runId,
      },
    });

    if (runRecord !== null && runRecord.status === 'pending') {
      return runRecord;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Run ${runId} did not stay pending in time.`);
}

async function waitForPathToExist(targetPath: string, timeoutMs: number) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await pathExists(targetPath)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Expected ${targetPath} to exist in time.`);
}

void test('GET /api/suites returns the seeded smoke suite', async (testContext) => {
  const { app } = await createRunsHttpHarness(testContext);

  const response = await createHttpRequest(app).get('/api/suites');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, [
    {
      id: 1,
      suite_name: 'demo-smoke',
      command: 'npm run test:smoke:platform',
      sut_base_url: 'http://localhost:3000',
    },
    {
      id: 2,
      suite_name: 'demo-smoke-30-second-case',
      command: 'npm run test:smoke:platform:with-30-second-case',
      sut_base_url: 'http://localhost:3000',
    },
    {
      id: 3,
      suite_name: 'demo-smoke-with-failure',
      command: 'npm run test:smoke:platform:with-failure',
      sut_base_url: 'http://localhost:3000',
    },
  ]);
});

void test('POST /api/runs executes a successful smoke run and exposes artifact presence flags', async (testContext) => {
  const { app, prismaClient } = await createRunsHttpHarness(testContext, {
    runnerMode: 'success',
    runnerDelayMs: 25,
  });

  const suiteResponse = await createHttpRequest(app).get('/api/suites');
  const suiteRows = readJsonBody<SuiteSummaryResponse[]>(suiteResponse);
  const suiteId = suiteRows[0].id;

  const createResponse = await createHttpRequest(app)
    .post('/api/runs')
    .send({ suite_id: suiteId });

  assert.equal(createResponse.status, 201);
  const createdRun = readJsonBody<RunSummaryResponse>(createResponse);
  assert.equal(createdRun.status, 'pending');

  const terminalRunRecord = await waitForRunToReachTerminalState(
    prismaClient,
    createdRun.id,
    2000,
  );

  assert.equal(terminalRunRecord.status, 'success');
  assert.equal(terminalRunRecord.reason, null);

  await prismaClient.suite.update({
    where: {
      id: suiteId,
    },
    data: {
      suite_name: 'legacy-smoke',
    },
  });

  const runDetailResponse = await createHttpRequest(app).get(
    `/api/runs/${createdRun.id}`,
  );

  const runDetail = readJsonBody<RunDetailResponse>(runDetailResponse);

  assert.equal(runDetailResponse.status, 200);
  assert.equal(runDetail.suite_name, 'demo-smoke');
  assert.deepEqual(runDetail.artifacts, {
    stdout_log: true,
    stderr_log: true,
    results_json: true,
    report_dir: true,
  });
  assert.deepEqual(runDetail.result_summary, {
    total_count: 1,
    passed_count: 1,
    failed_count: 0,
    skipped_count: 0,
  });

  const runCases = await prismaClient.caseResult.findMany({
    where: {
      run_id: createdRun.id,
    },
  });

  assert.equal(runCases.length, 1);
  assert.equal(runCases[0]?.status, 'pass');

  const failureStatisticsResponse = await createHttpRequest(app).get(
    '/api/statistics/failures',
  );

  assert.equal(failureStatisticsResponse.status, 200);
  assert.deepEqual(failureStatisticsResponse.body, []);
});

void test('GET /api/runs/{id} includes skipped case counts in result_summary', async (testContext) => {
  const { app, prismaClient } = await createRunsHttpHarness(testContext);

  const suiteResponse = await createHttpRequest(app).get('/api/suites');
  const suiteRows = readJsonBody<SuiteSummaryResponse[]>(suiteResponse);
  const suiteId = suiteRows[0].id;
  const createdAt = new Date('2026-03-20T12:00:00.000Z');
  const startTime = new Date('2026-03-20T12:00:05.000Z');
  const endTime = new Date('2026-03-20T12:00:17.000Z');

  const createdRun = await prismaClient.run.create({
    data: {
      suite_id: suiteId,
      suite_name_snapshot: 'demo-smoke',
      status: 'fail',
      reason: 'cases_failed',
      exit_code: 0,
      created_at: createdAt,
      start_time: startTime,
      end_time: endTime,
      duration_ms: 12_000,
      command: 'npm run test:smoke:platform',
      cwd: '/tmp/demo-test-lib',
      sut_base_url: 'http://localhost:3000',
      probe_url: 'http://localhost:3000/',
    },
  });

  await prismaClient.caseResult.createMany({
    data: [
      {
        run_id: createdRun.id,
        test_lib_case_code: 'AUTH_LOGIN_SUCCESS_ADD_ASSET',
        case_title: 'User logs in successfully and clicks Add Asset',
        status: 'pass',
        failed_at: null,
        duration_ms: 5,
      },
      {
        run_id: createdRun.id,
        test_lib_case_code: 'AUTH_LOGIN_INVALID_PASSWORD',
        case_title: 'Shows an invalid password error',
        status: 'fail',
        failed_at: endTime,
        duration_ms: 15,
      },
      {
        run_id: createdRun.id,
        test_lib_case_code: 'PROFILE_OPEN_SETTINGS',
        case_title: 'User opens account settings',
        status: 'skip',
        failed_at: null,
        duration_ms: 0,
      },
    ],
  });

  const runDetailResponse = await createHttpRequest(app).get(
    `/api/runs/${createdRun.id}`,
  );
  const runDetail = readJsonBody<RunDetailResponse>(runDetailResponse);

  assert.equal(runDetailResponse.status, 200);
  assert.deepEqual(runDetail.result_summary, {
    total_count: 3,
    passed_count: 1,
    failed_count: 1,
    skipped_count: 1,
  });
});

void test('GET /api/runs returns newest-first summaries for runs with different terminal outcomes', async (testContext) => {
  const { app, prismaClient } = await createRunsHttpHarness(testContext, {
    runnerMode: 'success',
  });

  const suiteResponse = await createHttpRequest(app).get('/api/suites');
  const suiteRows = readJsonBody<SuiteSummaryResponse[]>(suiteResponse);
  const suiteId = suiteRows[0].id;

  const firstCreateResponse = await createHttpRequest(app)
    .post('/api/runs')
    .send({ suite_id: suiteId });
  const firstCreatedRun = readJsonBody<RunSummaryResponse>(firstCreateResponse);

  const firstTerminalRunRecord = await waitForRunToReachTerminalState(
    prismaClient,
    firstCreatedRun.id,
    2000,
  );

  assert.equal(firstTerminalRunRecord.status, 'success');
  assert.equal(firstTerminalRunRecord.reason, null);

  process.env.FAKE_RUNNER_MODE = 'failing-case';

  const secondCreateResponse = await createHttpRequest(app)
    .post('/api/runs')
    .send({ suite_id: suiteId });
  const secondCreatedRun =
    readJsonBody<RunSummaryResponse>(secondCreateResponse);

  await waitForRunToReachTerminalState(prismaClient, secondCreatedRun.id, 2000);

  await prismaClient.suite.update({
    where: {
      id: suiteId,
    },
    data: {
      suite_name: 'legacy-smoke',
    },
  });

  const runListResponse = await createHttpRequest(app).get('/api/runs');
  const runList = readJsonBody<RunListItemResponse[]>(runListResponse);

  assert.equal(runListResponse.status, 200);
  assert.equal(runList.length, 2);
  const newestRun = runList[0];
  const olderRun = runList[1];

  assert.ok(newestRun !== undefined);
  assert.ok(olderRun !== undefined);
  assert.equal(newestRun.id, secondCreatedRun.id);
  assert.equal(olderRun.id, firstCreatedRun.id);
  assert.ok(
    new Date(newestRun.created_at).getTime() >=
      new Date(olderRun.created_at).getTime(),
  );
  assert.deepEqual(newestRun, {
    id: secondCreatedRun.id,
    suite_id: suiteId,
    suite_name: 'demo-smoke',
    status: 'fail',
    reason: 'cases_failed',
    exit_code: 0,
    created_at: newestRun.created_at,
    start_time: newestRun.start_time,
    end_time: newestRun.end_time,
    duration_ms: newestRun.duration_ms,
  });
  assert.deepEqual(olderRun, {
    id: firstCreatedRun.id,
    suite_id: suiteId,
    suite_name: 'demo-smoke',
    status: 'success',
    reason: null,
    exit_code: 0,
    created_at: olderRun.created_at,
    start_time: olderRun.start_time,
    end_time: olderRun.end_time,
    duration_ms: olderRun.duration_ms,
  });
});

void test('POST /api/runs terminalizes malformed results as parse_or_write_error', async (testContext) => {
  const { app, prismaClient } = await createRunsHttpHarness(testContext, {
    runnerMode: 'malformed',
  });

  const suiteResponse = await createHttpRequest(app).get('/api/suites');
  const suiteRows = readJsonBody<SuiteSummaryResponse[]>(suiteResponse);
  const suiteId = suiteRows[0].id;

  const createResponse = await createHttpRequest(app)
    .post('/api/runs')
    .send({ suite_id: suiteId });

  const createdRun = readJsonBody<RunSummaryResponse>(createResponse);

  const terminalRunRecord = await waitForRunToReachTerminalState(
    prismaClient,
    createdRun.id,
    2000,
  );

  assert.equal(terminalRunRecord.status, 'fail');
  assert.equal(terminalRunRecord.reason, 'parse_or_write_error');
});

void test('POST /api/runs rejects a missing request body with the locked 400 error shape', async (testContext) => {
  const { app } = await createRunsHttpHarness(testContext);

  const response = await createHttpRequest(app)
    .post('/api/runs')
    .set('Content-Type', 'application/json');

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: {
      message: 'suite_id must be a positive integer.',
    },
  });
});

void test('POST /api/runs/{id}/cancel rejects invalid path input with the locked 400 error shape', async (testContext) => {
  const { app } = await createRunsHttpHarness(testContext);

  const response = await createHttpRequest(app).post(
    '/api/runs/not-a-number/cancel',
  );

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: {
      message: 'id must be a positive integer.',
    },
  });
});

void test('POST /api/runs/{id}/cancel rejects a non-empty request body', async (testContext) => {
  const { app, prismaClient } = await createRunsHttpHarness(testContext);

  const pendingRun = await prismaClient.run.create({
    data: {
      suite_id: 1,
      suite_name_snapshot: 'demo-smoke',
      status: 'pending',
      command: 'npm run test:smoke:platform',
      cwd: '/tmp/demo-test-lib',
      sut_base_url: 'http://localhost:3000',
      probe_url: 'http://localhost:3000/',
    },
  });

  const response = await createHttpRequest(app)
    .post(`/api/runs/${pendingRun.id}/cancel`)
    .send({ reason: 'user_cancelled' });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: {
      message: 'Request body must be empty.',
    },
  });
});

void test('POST /api/runs/{id}/cancel returns 404 for a missing run', async (testContext) => {
  const { app } = await createRunsHttpHarness(testContext);

  const response = await createHttpRequest(app).post('/api/runs/9999/cancel');

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    error: {
      message: 'Run 9999 was not found.',
    },
  });
});

void test('POST /api/runs/{id}/cancel rejects terminal runs with 400', async (testContext) => {
  const { app, prismaClient } = await createRunsHttpHarness(testContext);

  const terminalRun = await prismaClient.run.create({
    data: {
      suite_id: 1,
      suite_name_snapshot: 'demo-smoke',
      status: 'success',
      reason: null,
      exit_code: 0,
      start_time: new Date('2026-03-20T12:00:02.000Z'),
      end_time: new Date('2026-03-20T12:00:07.000Z'),
      duration_ms: 5_000,
      command: 'npm run test:smoke:platform',
      cwd: '/tmp/demo-test-lib',
      sut_base_url: 'http://localhost:3000',
      probe_url: 'http://localhost:3000/',
    },
  });

  const response = await createHttpRequest(app).post(
    `/api/runs/${terminalRun.id}/cancel`,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: {
      message: `Run ${terminalRun.id} can no longer be cancelled.`,
    },
  });
});

void test('POST /api/runs terminalizes probe failures without spawning the runner', async (testContext) => {
  const { app, prismaClient } = await createRunsHttpHarness(testContext, {
    probeStatus: 503,
  });

  const suiteResponse = await createHttpRequest(app).get('/api/suites');
  const suiteRows = readJsonBody<SuiteSummaryResponse[]>(suiteResponse);
  const suiteId = suiteRows[0].id;

  const createResponse = await createHttpRequest(app)
    .post('/api/runs')
    .send({ suite_id: suiteId });

  const createdRun = readJsonBody<RunSummaryResponse>(createResponse);

  const terminalRunRecord = await waitForRunToReachTerminalState(
    prismaClient,
    createdRun.id,
    2000,
  );

  assert.equal(terminalRunRecord.status, 'fail');
  assert.equal(terminalRunRecord.reason, 'probe_failed');

  const runDetailResponse = await createHttpRequest(app).get(
    `/api/runs/${createdRun.id}`,
  );

  const runDetail = readJsonBody<RunDetailResponse>(runDetailResponse);

  assert.deepEqual(runDetail.artifacts, {
    stdout_log: false,
    stderr_log: false,
    results_json: false,
    report_dir: false,
  });
  assert.equal(runDetail.result_summary, null);
});

void test('POST /api/runs terminalizes failed cases as cases_failed and keeps failure statistics compatible', async (testContext) => {
  const { app, prismaClient } = await createRunsHttpHarness(testContext, {
    runnerMode: 'failing-case',
  });

  const suiteResponse = await createHttpRequest(app).get('/api/suites');
  const suiteRows = readJsonBody<SuiteSummaryResponse[]>(suiteResponse);
  const suiteId = suiteRows[0].id;

  const createResponse = await createHttpRequest(app)
    .post('/api/runs')
    .send({ suite_id: suiteId });

  const createdRun = readJsonBody<RunSummaryResponse>(createResponse);
  const terminalRunRecord = await waitForRunToReachTerminalState(
    prismaClient,
    createdRun.id,
    2000,
  );
  const failedCaseResult = await prismaClient.caseResult.findFirst({
    where: {
      run_id: createdRun.id,
    },
  });

  assert.equal(terminalRunRecord.status, 'fail');
  assert.equal(terminalRunRecord.reason, 'cases_failed');
  assert.notEqual(failedCaseResult, null);

  const runDetailResponse = await createHttpRequest(app).get(
    `/api/runs/${createdRun.id}`,
  );
  const runDetail = readJsonBody<RunDetailResponse>(runDetailResponse);

  assert.equal(runDetailResponse.status, 200);
  assert.deepEqual(runDetail.result_summary, {
    total_count: 1,
    passed_count: 0,
    failed_count: 1,
    skipped_count: 0,
  });

  const failureStatisticsResponse = await createHttpRequest(app).get(
    '/api/statistics/failures',
  );

  assert.equal(failureStatisticsResponse.status, 200);
  assert.deepEqual(failureStatisticsResponse.body, [
    {
      test_lib_case_code: 'AUTH_LOGIN_INVALID_PASSWORD',
      case_title: 'Shows an invalid password error',
      fail_count: 1,
      last_failed_at: failedCaseResult?.failed_at?.toISOString(),
      last_run_id: createdRun.id,
    },
  ]);
});

void test('POST /api/runs terminalizes slow runs as timeout', async (testContext) => {
  const { app, prismaClient } = await createRunsHttpHarness(testContext, {
    runnerMode: 'slow',
    timeoutMs: 50,
  });

  const suiteResponse = await createHttpRequest(app).get('/api/suites');
  const suiteRows = readJsonBody<SuiteSummaryResponse[]>(suiteResponse);
  const suiteId = suiteRows[0].id;

  const createResponse = await createHttpRequest(app)
    .post('/api/runs')
    .send({ suite_id: suiteId });

  const createdRun = readJsonBody<RunSummaryResponse>(createResponse);

  const terminalRunRecord = await waitForRunToReachTerminalState(
    prismaClient,
    createdRun.id,
    5000,
  );

  assert.equal(terminalRunRecord.status, 'timeout');
  assert.equal(terminalRunRecord.reason, 'timeout_exceeded');

  const runDetailResponse = await createHttpRequest(app).get(
    `/api/runs/${createdRun.id}`,
  );

  const runDetail = readJsonBody<RunDetailResponse>(runDetailResponse);

  assert.equal(runDetail.artifacts.stdout_log, true);
  assert.equal(runDetail.artifacts.stderr_log, true);
  assert.equal(runDetail.artifacts.results_json, false);
  assert.equal(runDetail.result_summary, null);
});

void test('POST /api/runs returns runner_exit_nonzero when the process exits before valid ingest', async (testContext) => {
  const { app, prismaClient } = await createRunsHttpHarness(testContext, {
    runnerMode: 'nonzero-no-results',
  });

  const suiteResponse = await createHttpRequest(app).get('/api/suites');
  const suiteRows = readJsonBody<SuiteSummaryResponse[]>(suiteResponse);
  const suiteId = suiteRows[0].id;

  const createResponse = await createHttpRequest(app)
    .post('/api/runs')
    .send({ suite_id: suiteId });

  const createdRun = readJsonBody<RunSummaryResponse>(createResponse);

  const terminalRunRecord = await waitForRunToReachTerminalState(
    prismaClient,
    createdRun.id,
    2000,
  );

  assert.equal(terminalRunRecord.status, 'fail');
  assert.equal(terminalRunRecord.reason, 'runner_exit_nonzero');
  assert.equal(terminalRunRecord.exit_code, 1);
});

void test('POST /api/runs keeps the FIFO queue behind a single running slot', async (testContext) => {
  const { app, prismaClient } = await createRunsHttpHarness(testContext, {
    runnerMode: 'success',
    runnerDelayMs: 75,
  });

  const suiteResponse = await createHttpRequest(app).get('/api/suites');
  const suiteRows = readJsonBody<SuiteSummaryResponse[]>(suiteResponse);
  const suiteId = suiteRows[0].id;

  const firstCreateResponse = await createHttpRequest(app)
    .post('/api/runs')
    .send({ suite_id: suiteId });
  const secondCreateResponse = await createHttpRequest(app)
    .post('/api/runs')
    .send({ suite_id: suiteId });

  const firstCreatedRun = readJsonBody<RunSummaryResponse>(firstCreateResponse);
  const secondCreatedRun =
    readJsonBody<RunSummaryResponse>(secondCreateResponse);

  await waitForRunToStayPending(prismaClient, secondCreatedRun.id, 150);

  const firstTerminalRunRecord = await waitForRunToReachTerminalState(
    prismaClient,
    firstCreatedRun.id,
    5000,
  );
  const secondTerminalRunRecord = await waitForRunToReachTerminalState(
    prismaClient,
    secondCreatedRun.id,
    5000,
  );

  assert.equal(firstTerminalRunRecord.status, 'success');
  assert.equal(secondTerminalRunRecord.status, 'success');
  assert.ok(
    firstTerminalRunRecord.start_time !== null &&
      secondTerminalRunRecord.start_time !== null &&
      firstTerminalRunRecord.start_time.getTime() <
        secondTerminalRunRecord.start_time.getTime(),
  );
  assert.ok(
    firstTerminalRunRecord.end_time !== null &&
      secondTerminalRunRecord.start_time !== null &&
      firstTerminalRunRecord.end_time.getTime() <=
        secondTerminalRunRecord.start_time.getTime(),
  );
});

void test('POST /api/runs/{id}/cancel removes a pending run from the FIFO queue without creating artifacts', async (testContext) => {
  const { app, prismaClient } = await createRunsHttpHarness(testContext, {
    runnerMode: 'success',
    runnerDelayMs: 75,
  });

  const suiteResponse = await createHttpRequest(app).get('/api/suites');
  const suiteRows = readJsonBody<SuiteSummaryResponse[]>(suiteResponse);
  const suiteId = suiteRows[0].id;

  const firstCreateResponse = await createHttpRequest(app)
    .post('/api/runs')
    .send({ suite_id: suiteId });
  const secondCreateResponse = await createHttpRequest(app)
    .post('/api/runs')
    .send({ suite_id: suiteId });

  const firstCreatedRun = readJsonBody<RunSummaryResponse>(firstCreateResponse);
  const secondCreatedRun =
    readJsonBody<RunSummaryResponse>(secondCreateResponse);

  await waitForRunToStayPending(prismaClient, secondCreatedRun.id, 150);

  const cancelResponse = await createHttpRequest(app).post(
    `/api/runs/${secondCreatedRun.id}/cancel`,
  );
  const cancelledRun = readJsonBody<RunSummaryResponse>(cancelResponse);

  assert.equal(cancelResponse.status, 200);
  assert.equal(cancelledRun.status, 'cancelled');
  assert.equal(cancelledRun.reason, 'user_cancelled');
  assert.equal(cancelledRun.exit_code, null);
  assert.equal(cancelledRun.start_time, null);
  assert.equal(cancelledRun.duration_ms, null);
  assert.notEqual(cancelledRun.end_time, null);

  await waitForRunToReachTerminalState(prismaClient, firstCreatedRun.id, 5000);

  const cancelledRunRecord = await waitForRunToReachTerminalState(
    prismaClient,
    secondCreatedRun.id,
    1000,
  );

  assert.equal(cancelledRunRecord.status, 'cancelled');
  assert.equal(cancelledRunRecord.reason, 'user_cancelled');
  assert.equal(cancelledRunRecord.start_time, null);
  assert.equal(cancelledRunRecord.duration_ms, null);
  assert.equal(
    await pathExists(resolveRunArtifactPaths(secondCreatedRun.id).runRoot),
    false,
  );
});

void test('POST /api/runs/{id}/cancel stops the running process group and child processes', async (testContext) => {
  const { app, childMarkerPath, childReadyPath, prismaClient } =
    await createRunsHttpHarness(testContext, {
      runnerMode: 'child-process',
      timeoutMs: 5_000,
    });

  const suiteResponse = await createHttpRequest(app).get('/api/suites');
  const suiteRows = readJsonBody<SuiteSummaryResponse[]>(suiteResponse);
  const suiteId = suiteRows[0].id;

  const createResponse = await createHttpRequest(app)
    .post('/api/runs')
    .send({ suite_id: suiteId });
  const createdRun = readJsonBody<RunSummaryResponse>(createResponse);

  await waitForRunToReachStatus(prismaClient, createdRun.id, 'running', 2000);
  await waitForPathToExist(childReadyPath, 2_000);

  const cancelResponse = await createHttpRequest(app).post(
    `/api/runs/${createdRun.id}/cancel`,
  );
  const cancelledRun = readJsonBody<RunSummaryResponse>(cancelResponse);

  assert.equal(cancelResponse.status, 200);
  assert.equal(cancelledRun.status, 'cancelled');
  assert.equal(cancelledRun.reason, 'user_cancelled');
  assert.equal(cancelledRun.exit_code, null);

  const terminalRunRecord = await waitForRunToReachTerminalState(
    prismaClient,
    createdRun.id,
    3_000,
  );

  assert.equal(terminalRunRecord.status, 'cancelled');
  assert.equal(terminalRunRecord.reason, 'user_cancelled');
  assert.notEqual(terminalRunRecord.start_time, null);
  assert.notEqual(terminalRunRecord.end_time, null);
  assert.notEqual(terminalRunRecord.duration_ms, null);

  await new Promise((resolve) => setTimeout(resolve, 900));

  assert.equal(await pathExists(childMarkerPath), false);
});
