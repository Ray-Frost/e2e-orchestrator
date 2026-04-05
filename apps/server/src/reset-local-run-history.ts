import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

type ResetSnapshot = {
  suiteCount: number;
  runCount: number;
  caseResultCount: number;
  activeRunCount: number;
  failureStatisticRowCount: number;
  artifactDirectories: string[];
};

const activeRunStatuses = ['pending', 'running'] as const;
const expectedLocalDatabaseFileName = 'dev.sqlite';

function resolveLocalDatabasePath(databaseUrl: string): string {
  if (!databaseUrl.startsWith('file:')) {
    throw new Error(
      `Refusing to reset run history because DATABASE_URL is not a local file URL: ${databaseUrl}`,
    );
  }

  const databasePath = databaseUrl.slice('file:'.length);
  const resolvedDatabasePath = path.resolve(process.cwd(), databasePath);

  if (path.basename(resolvedDatabasePath) !== expectedLocalDatabaseFileName) {
    throw new Error(
      `Refusing to reset run history because DATABASE_URL does not point to ${expectedLocalDatabaseFileName}: ${resolvedDatabasePath}`,
    );
  }

  return resolvedDatabasePath;
}

async function listRunArtifactDirectories(
  artifactsRoot: string,
): Promise<string[]> {
  const directoryEntries = await readdir(artifactsRoot, {
    withFileTypes: true,
  });

  return directoryEntries
    .filter(
      (directoryEntry) =>
        directoryEntry.isDirectory() && /^run-\d+$/.test(directoryEntry.name),
    )
    .map((directoryEntry) => directoryEntry.name)
    .sort((leftDirectoryName, rightDirectoryName) =>
      leftDirectoryName.localeCompare(rightDirectoryName, undefined, {
        numeric: true,
      }),
    );
}

async function loadSnapshot(
  prismaClient: PrismaClient,
  artifactsRoot: string,
): Promise<ResetSnapshot> {
  const [
    suiteCount,
    runCount,
    caseResultCount,
    activeRunCount,
    failedCaseRows,
    artifactDirectories,
  ] = await Promise.all([
    prismaClient.suite.count(),
    prismaClient.run.count(),
    prismaClient.caseResult.count(),
    prismaClient.run.count({
      where: {
        status: {
          in: [...activeRunStatuses],
        },
      },
    }),
    prismaClient.caseResult.findMany({
      where: {
        status: 'fail',
        failed_at: {
          not: null,
        },
      },
      select: {
        test_lib_case_code: true,
      },
    }),
    listRunArtifactDirectories(artifactsRoot),
  ]);

  const failureStatisticCaseCodes = new Set(
    failedCaseRows.map((failedCaseRow) => failedCaseRow.test_lib_case_code),
  );

  return {
    suiteCount,
    runCount,
    caseResultCount,
    activeRunCount,
    failureStatisticRowCount: failureStatisticCaseCodes.size,
    artifactDirectories,
  };
}

function formatSnapshot(label: string, snapshot: ResetSnapshot): string {
  const artifactDirectoryLabel =
    snapshot.artifactDirectories.length === 0
      ? 'none'
      : snapshot.artifactDirectories.join(', ');

  return [
    `${label}:`,
    `  suites: ${snapshot.suiteCount}`,
    `  runs: ${snapshot.runCount}`,
    `  case_results: ${snapshot.caseResultCount}`,
    `  active_runs: ${snapshot.activeRunCount}`,
    `  failure_statistics_rows: ${snapshot.failureStatisticRowCount}`,
    `  artifact_directories: ${artifactDirectoryLabel}`,
  ].join('\n');
}

async function resetLocalRunHistory() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required.');
  }

  const resolvedDatabasePath = resolveLocalDatabasePath(databaseUrl);
  const artifactsRoot = path.resolve(process.cwd(), 'artifacts');
  const prismaClient = new PrismaClient();

  try {
    const beforeSnapshot = await loadSnapshot(prismaClient, artifactsRoot);

    if (beforeSnapshot.activeRunCount > 0) {
      throw new Error(
        `Refusing to reset run history while ${beforeSnapshot.activeRunCount} active run(s) still exist.`,
      );
    }

    await prismaClient.run.deleteMany();

    for (const artifactDirectory of beforeSnapshot.artifactDirectories) {
      await rm(path.join(artifactsRoot, artifactDirectory), {
        force: true,
        recursive: true,
      });
    }

    const afterSnapshot = await loadSnapshot(prismaClient, artifactsRoot);

    console.log(`Local database: ${resolvedDatabasePath}`);
    console.log(`Artifacts root: ${artifactsRoot}`);
    console.log(formatSnapshot('Before reset', beforeSnapshot));
    console.log(formatSnapshot('After reset', afterSnapshot));
  } finally {
    await prismaClient.$disconnect();
  }
}

void resetLocalRunHistory().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Unknown reset failure.';

  console.error(`Failed to reset local run history: ${message}`);
  process.exitCode = 1;
});
