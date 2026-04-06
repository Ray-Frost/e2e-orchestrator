import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { SmokeSuiteService } from '../../runs/smoke-suite.service';

function setOptionalEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function createFailureStatisticsRequest(app: INestApplication) {
  const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  return request(httpServer);
}

async function initializeTestDatabaseSchema(prismaClient: PrismaClient) {
  const serverRoot = path.resolve(__dirname, '../../../');
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

async function createFailureStatisticsHttpHarness(
  testContext: {
    after: (callback: () => void | Promise<void>) => void;
  },
  options: {
    initializeTestDatabaseSchema?: boolean;
  } = {},
) {
  const sandboxRoot = await mkdtemp(
    path.join(os.tmpdir(), 'failure-statistics-http-'),
  );
  const databasePath = path.join(sandboxRoot, 'failure-statistics.sqlite');
  const databaseUrl = `file:${databasePath}`;
  const prismaClient = new PrismaService({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
  const originalEnv = {
    E2E_SMOKE_CWD: process.env.E2E_SMOKE_CWD,
    E2E_SMOKE_COMMAND: process.env.E2E_SMOKE_COMMAND,
    E2E_SMOKE_SUITE_NAME: process.env.E2E_SMOKE_SUITE_NAME,
  };

  process.env.E2E_SMOKE_CWD = sandboxRoot;
  process.env.E2E_SMOKE_COMMAND = 'npm run test:smoke:platform';
  process.env.E2E_SMOKE_SUITE_NAME = 'demo-smoke';

  testContext.after(async () => {
    await prismaClient.$disconnect();
    await rm(sandboxRoot, { force: true, recursive: true });
    setOptionalEnvValue('E2E_SMOKE_CWD', originalEnv.E2E_SMOKE_CWD);
    setOptionalEnvValue('E2E_SMOKE_COMMAND', originalEnv.E2E_SMOKE_COMMAND);
    setOptionalEnvValue(
      'E2E_SMOKE_SUITE_NAME',
      originalEnv.E2E_SMOKE_SUITE_NAME,
    );
  });

  if (options.initializeTestDatabaseSchema !== false) {
    await initializeTestDatabaseSchema(prismaClient);
  }

  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prismaClient);

  if (options.initializeTestDatabaseSchema === false) {
    moduleBuilder.overrideProvider(SmokeSuiteService).useValue({
      getSuiteSummaries: () => [],
      getSuiteById: () => null,
    });
  }

  const moduleRef = await moduleBuilder.compile();
  const app = moduleRef.createNestApplication<INestApplication>();

  testContext.after(async () => {
    await app.close();
  });

  app.setGlobalPrefix('api');
  await app.init();

  return {
    app,
    prismaClient,
  };
}

async function clearSeededRows(prismaClient: PrismaClient) {
  await prismaClient.caseResult.deleteMany();
  await prismaClient.run.deleteMany();
  await prismaClient.suite.deleteMany();
}

async function createSuiteRecord(prismaClient: PrismaClient) {
  return prismaClient.suite.create({
    data: {
      suite_name: 'Smoke suite',
      command: 'npm run test:smoke',
    },
  });
}

async function createFailedRunRecord(
  prismaClient: PrismaClient,
  suiteId: number,
  failedAt: string,
) {
  const failedAtDate = new Date(failedAt);

  return prismaClient.run.create({
    data: {
      suite_id: suiteId,
      suite_name_snapshot: 'Smoke suite',
      status: 'fail',
      command: 'npm run test:smoke',
      cwd: '/tmp/demo-test-lib',
      sut_base_url: 'http://localhost:3000',
      probe_url: 'http://localhost:3000/',
      created_at: failedAtDate,
      start_time: failedAtDate,
      end_time: failedAtDate,
      duration_ms: 0,
    },
  });
}

async function createFailedCaseResult(
  prismaClient: PrismaClient,
  runId: number,
  seedInput: {
    caseCode: string;
    caseTitle: string;
    failedAt: string;
  },
) {
  const failedAtDate = new Date(seedInput.failedAt);

  return prismaClient.caseResult.create({
    data: {
      run_id: runId,
      test_lib_case_code: seedInput.caseCode,
      case_title: seedInput.caseTitle,
      status: 'fail',
      failed_at: failedAtDate,
      duration_ms: 0,
    },
  });
}

async function seedFailedCaseResult(
  prismaClient: PrismaClient,
  suiteId: number,
  seedInput: {
    caseCode: string;
    caseTitle: string;
    failedAt: string;
  },
) {
  const runRecord = await createFailedRunRecord(
    prismaClient,
    suiteId,
    seedInput.failedAt,
  );

  await createFailedCaseResult(prismaClient, runRecord.id, seedInput);

  return runRecord;
}

async function seedPassedCaseResult(
  prismaClient: PrismaClient,
  suiteId: number,
  seedInput: {
    caseCode: string;
    caseTitle: string;
    createdAt: string;
  },
) {
  const createdAtDate = new Date(seedInput.createdAt);
  const runRecord = await prismaClient.run.create({
    data: {
      suite_id: suiteId,
      suite_name_snapshot: 'Smoke suite',
      status: 'success',
      command: 'npm run test:smoke',
      cwd: '/tmp/demo-test-lib',
      sut_base_url: 'http://localhost:3000',
      probe_url: 'http://localhost:3000/',
      created_at: createdAtDate,
      start_time: createdAtDate,
      end_time: createdAtDate,
      duration_ms: 0,
    },
  });

  await prismaClient.caseResult.create({
    data: {
      run_id: runRecord.id,
      test_lib_case_code: seedInput.caseCode,
      case_title: seedInput.caseTitle,
      status: 'pass',
      failed_at: null,
      duration_ms: 0,
    },
  });
}

void test('GET /api/statistics/failures', async (testContext) => {
  const { app, prismaClient } =
    await createFailureStatisticsHttpHarness(testContext);

  await testContext.test(
    'returns an empty list when there are no failed case results',
    async () => {
      await clearSeededRows(prismaClient);

      const response = await createFailureStatisticsRequest(app).get(
        '/api/statistics/failures',
      );

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, []);
    },
  );

  await testContext.test(
    'aggregates failed case results by code using latest-row metadata and deterministic ordering',
    async () => {
      await clearSeededRows(prismaClient);

      const suiteRecord = await createSuiteRecord(prismaClient);

      await seedFailedCaseResult(prismaClient, suiteRecord.id, {
        caseCode: 'AUTH_LOGIN_INVALID_PASSWORD',
        caseTitle: 'Shows an invalid password error',
        failedAt: '2026-03-20T10:00:00.000Z',
      });
      const latestAuthFailureRun = await seedFailedCaseResult(
        prismaClient,
        suiteRecord.id,
        {
          caseCode: 'AUTH_LOGIN_INVALID_PASSWORD',
          caseTitle: 'Shows an invalid password error with guidance',
          failedAt: '2026-03-20T12:00:00.000Z',
        },
      );
      const checkoutFailureRun = await seedFailedCaseResult(
        prismaClient,
        suiteRecord.id,
        {
          caseCode: 'CHECKOUT_SUBMITS_ORDER',
          caseTitle: 'Submits the checkout order',
          failedAt: '2026-03-20T12:00:00.000Z',
        },
      );
      await seedPassedCaseResult(prismaClient, suiteRecord.id, {
        caseCode: 'AUTH_LOGIN_INVALID_PASSWORD',
        caseTitle: 'Passes a later login attempt',
        createdAt: '2026-03-20T13:00:00.000Z',
      });
      await seedFailedCaseResult(prismaClient, suiteRecord.id, {
        caseCode: 'PROFILE_UPDATES_EMAIL',
        caseTitle: 'Stores the initial profile email value',
        failedAt: '2026-03-19T09:00:00.000Z',
      });
      const latestProfileFailureRun = await seedFailedCaseResult(
        prismaClient,
        suiteRecord.id,
        {
          caseCode: 'PROFILE_UPDATES_EMAIL',
          caseTitle: 'Stores the confirmed profile email value',
          failedAt: '2026-03-19T09:00:00.000Z',
        },
      );

      const response = await createFailureStatisticsRequest(app).get(
        '/api/statistics/failures',
      );

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, [
        {
          test_lib_case_code: 'CHECKOUT_SUBMITS_ORDER',
          case_title: 'Submits the checkout order',
          fail_count: 1,
          last_failed_at: '2026-03-20T12:00:00.000Z',
          last_run_id: checkoutFailureRun.id,
        },
        {
          test_lib_case_code: 'AUTH_LOGIN_INVALID_PASSWORD',
          case_title: 'Shows an invalid password error with guidance',
          fail_count: 2,
          last_failed_at: '2026-03-20T12:00:00.000Z',
          last_run_id: latestAuthFailureRun.id,
        },
        {
          test_lib_case_code: 'PROFILE_UPDATES_EMAIL',
          case_title: 'Stores the confirmed profile email value',
          fail_count: 2,
          last_failed_at: '2026-03-19T09:00:00.000Z',
          last_run_id: latestProfileFailureRun.id,
        },
      ]);
    },
  );

  await testContext.test(
    'uses test_lib_case_code as the tertiary response tie-breaker when groups share the same latest run and failed_at',
    async () => {
      await clearSeededRows(prismaClient);

      const suiteRecord = await createSuiteRecord(prismaClient);
      const sharedRunRecord = await createFailedRunRecord(
        prismaClient,
        suiteRecord.id,
        '2026-03-21T12:00:00.000Z',
      );

      await createFailedCaseResult(prismaClient, sharedRunRecord.id, {
        caseCode: 'CHECKOUT_SUBMITS_ORDER',
        caseTitle: 'Submits the checkout order',
        failedAt: '2026-03-21T12:00:00.000Z',
      });
      await createFailedCaseResult(prismaClient, sharedRunRecord.id, {
        caseCode: 'AUTH_LOGIN_INVALID_PASSWORD',
        caseTitle: 'Shows an invalid password error',
        failedAt: '2026-03-21T12:00:00.000Z',
      });

      const response = await createFailureStatisticsRequest(app).get(
        '/api/statistics/failures',
      );

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, [
        {
          test_lib_case_code: 'AUTH_LOGIN_INVALID_PASSWORD',
          case_title: 'Shows an invalid password error',
          fail_count: 1,
          last_failed_at: '2026-03-21T12:00:00.000Z',
          last_run_id: sharedRunRecord.id,
        },
        {
          test_lib_case_code: 'CHECKOUT_SUBMITS_ORDER',
          case_title: 'Submits the checkout order',
          fail_count: 1,
          last_failed_at: '2026-03-21T12:00:00.000Z',
          last_run_id: sharedRunRecord.id,
        },
      ]);
    },
  );

  await testContext.test(
    'uses plain string comparison for the tertiary response tie-breaker when case codes include punctuation',
    async () => {
      await clearSeededRows(prismaClient);

      const suiteRecord = await createSuiteRecord(prismaClient);
      const sharedRunRecord = await createFailedRunRecord(
        prismaClient,
        suiteRecord.id,
        '2026-03-21T13:00:00.000Z',
      );

      await createFailedCaseResult(prismaClient, sharedRunRecord.id, {
        caseCode: 'A_1',
        caseTitle: 'Uses the underscored code',
        failedAt: '2026-03-21T13:00:00.000Z',
      });
      await createFailedCaseResult(prismaClient, sharedRunRecord.id, {
        caseCode: 'A1',
        caseTitle: 'Uses the plain code',
        failedAt: '2026-03-21T13:00:00.000Z',
      });

      const response = await createFailureStatisticsRequest(app).get(
        '/api/statistics/failures',
      );

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, [
        {
          test_lib_case_code: 'A1',
          case_title: 'Uses the plain code',
          fail_count: 1,
          last_failed_at: '2026-03-21T13:00:00.000Z',
          last_run_id: sharedRunRecord.id,
        },
        {
          test_lib_case_code: 'A_1',
          case_title: 'Uses the underscored code',
          fail_count: 1,
          last_failed_at: '2026-03-21T13:00:00.000Z',
          last_run_id: sharedRunRecord.id,
        },
      ]);
    },
  );

  await testContext.test(
    'uses the higher case_results.id when the latest failed row tie occurs within one case code',
    async () => {
      await clearSeededRows(prismaClient);

      const suiteRecord = await createSuiteRecord(prismaClient);
      const sharedRunRecord = await createFailedRunRecord(
        prismaClient,
        suiteRecord.id,
        '2026-03-22T12:00:00.000Z',
      );

      await createFailedCaseResult(prismaClient, sharedRunRecord.id, {
        caseCode: 'AUTH_LOGIN_INVALID_PASSWORD',
        caseTitle: 'Shows the initial invalid password error',
        failedAt: '2026-03-22T12:00:00.000Z',
      });
      await createFailedCaseResult(prismaClient, sharedRunRecord.id, {
        caseCode: 'AUTH_LOGIN_INVALID_PASSWORD',
        caseTitle: 'Shows the newer invalid password guidance',
        failedAt: '2026-03-22T12:00:00.000Z',
      });

      const response = await createFailureStatisticsRequest(app).get(
        '/api/statistics/failures',
      );

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, [
        {
          test_lib_case_code: 'AUTH_LOGIN_INVALID_PASSWORD',
          case_title: 'Shows the newer invalid password guidance',
          fail_count: 2,
          last_failed_at: '2026-03-22T12:00:00.000Z',
          last_run_id: sharedRunRecord.id,
        },
      ]);
    },
  );
});

void test('GET /api/statistics/failures preserves the locked error shape when the query fails', async (testContext) => {
  const { app } = await createFailureStatisticsHttpHarness(testContext, {
    initializeTestDatabaseSchema: false,
  });

  const response = await createFailureStatisticsRequest(app).get(
    '/api/statistics/failures',
  );

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    error: {
      message: 'Failed to load failure statistics.',
    },
  });
});
