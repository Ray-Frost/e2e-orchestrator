import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

function setOptionalEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
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

async function createSmokeSuiteHttpHarness(
  testContext: {
    after: (callback: () => void | Promise<void>) => void;
  },
  options: {
    cwd?: string | undefined;
    timeoutMinutes?: string | undefined;
    beforeAppInit?: (prismaClient: PrismaClient) => Promise<void> | void;
  } = {},
) {
  const sandboxRoot = await mkdtemp(
    path.join(os.tmpdir(), 'smoke-suite-http-'),
  );
  const databasePath = path.join(sandboxRoot, 'smoke-suite.sqlite');
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
    E2E_SMOKE_TIMEOUT_MINUTES: process.env.E2E_SMOKE_TIMEOUT_MINUTES,
  };

  setOptionalEnvValue('E2E_SMOKE_CWD', options.cwd);
  process.env.E2E_SMOKE_COMMAND = 'npm run test:smoke:platform';
  process.env.E2E_SMOKE_SUITE_NAME = 'demo-smoke';
  setOptionalEnvValue('E2E_SMOKE_TIMEOUT_MINUTES', options.timeoutMinutes);

  testContext.after(async () => {
    await prismaClient.$disconnect();
    await rm(sandboxRoot, { force: true, recursive: true });
    setOptionalEnvValue('E2E_SMOKE_CWD', originalEnv.E2E_SMOKE_CWD);
    setOptionalEnvValue('E2E_SMOKE_COMMAND', originalEnv.E2E_SMOKE_COMMAND);
    setOptionalEnvValue(
      'E2E_SMOKE_SUITE_NAME',
      originalEnv.E2E_SMOKE_SUITE_NAME,
    );
    setOptionalEnvValue(
      'E2E_SMOKE_TIMEOUT_MINUTES',
      originalEnv.E2E_SMOKE_TIMEOUT_MINUTES,
    );
  });

  await initializeTestDatabaseSchema(prismaClient);

  if (options.beforeAppInit !== undefined) {
    await options.beforeAppInit(prismaClient);
  }

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prismaClient)
    .compile();
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

void test('startup sync seeds exactly one singleton suite row', async (testContext) => {
  const { prismaClient } = await createSmokeSuiteHttpHarness(testContext, {
    cwd: '/tmp/demo-test-lib',
  });

  const suiteRows = await prismaClient.suite.findMany();

  assert.deepEqual(suiteRows, [
    {
      id: 1,
      suite_name: 'demo-smoke',
      command: 'npm run test:smoke:platform',
    },
  ]);
});

void test('startup sync collapses stale suite rows onto the canonical singleton suite', async (testContext) => {
  const { prismaClient } = await createSmokeSuiteHttpHarness(testContext, {
    cwd: '/tmp/demo-test-lib',
    beforeAppInit: async (prismaClient) => {
      const legacySuite = await prismaClient.suite.create({
        data: {
          suite_name: 'legacy-smoke',
          command: 'npm run legacy:smoke',
        },
      });

      await prismaClient.run.create({
        data: {
          suite_id: legacySuite.id,
          suite_name_snapshot: 'legacy-smoke',
          status: 'success',
          command: 'npm run legacy:smoke',
          cwd: '/tmp/legacy-smoke',
          sut_base_url: 'http://localhost:3000',
          probe_url: 'http://localhost:3000/',
          created_at: new Date('2026-03-29T15:51:53.000Z'),
          start_time: new Date('2026-03-29T15:51:53.000Z'),
          end_time: new Date('2026-03-29T15:51:53.000Z'),
          duration_ms: 0,
        },
      });
    },
  });

  const suiteRows = await prismaClient.suite.findMany({
    orderBy: {
      id: 'asc',
    },
  });
  const canonicalSuite = suiteRows[0];
  const runRows = await prismaClient.run.findMany({
    select: {
      suite_id: true,
      suite_name_snapshot: true,
      suite: {
        select: {
          suite_name: true,
        },
      },
    },
  });

  assert.equal(suiteRows.length, 1);
  assert.deepEqual(canonicalSuite, {
    id: canonicalSuite?.id,
    suite_name: 'demo-smoke',
    command: 'npm run test:smoke:platform',
  });
  assert.deepEqual(runRows, [
    {
      suite_id: canonicalSuite?.id,
      suite_name_snapshot: 'legacy-smoke',
      suite: {
        suite_name: 'demo-smoke',
      },
    },
  ]);
});

void test('startup fails fast when E2E_SMOKE_CWD is missing', async (testContext) => {
  await assert.rejects(
    () => createSmokeSuiteHttpHarness(testContext, { cwd: undefined }),
    /E2E_SMOKE_CWD is required/,
  );
});

void test('startup fails fast when E2E_SMOKE_TIMEOUT_MINUTES is non-positive', async (testContext) => {
  await assert.rejects(
    () =>
      createSmokeSuiteHttpHarness(testContext, {
        cwd: '/tmp/demo-test-lib',
        timeoutMinutes: '0',
      }),
    /E2E_SMOKE_TIMEOUT_MINUTES must be a positive integer/,
  );
});
