import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface DevServerPortRegistryEntry {
  port: number;
  pid: number;
  started_at: string;
}

interface DevServerPortRegistryOptions {
  beforeDelete?: () => Promise<void>;
  registryFilePath?: string;
}

export const DEV_SERVER_PORT_REGISTRY_PATH = path.resolve(
  __dirname,
  '../../../.runtime/dev-server-port.json',
);

const REGISTRY_LOCK_RETRY_DELAY_MS = 10;
const REGISTRY_LOCK_MAX_ATTEMPTS = 50;

function isExistingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'EEXIST'
  );
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function isDevServerPortRegistryEntry(
  value: unknown,
): value is DevServerPortRegistryEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'port' in value &&
    typeof value.port === 'number' &&
    'pid' in value &&
    typeof value.pid === 'number' &&
    'started_at' in value &&
    typeof value.started_at === 'string'
  );
}

function matchesRegistryEntry(
  value: unknown,
  expectedRegistryEntry: DevServerPortRegistryEntry,
): value is DevServerPortRegistryEntry {
  return (
    isDevServerPortRegistryEntry(value) &&
    value.port === expectedRegistryEntry.port &&
    value.pid === expectedRegistryEntry.pid &&
    value.started_at === expectedRegistryEntry.started_at
  );
}

function getRegistryLockFilePath(registryFilePath: string): string {
  return `${registryFilePath}.lock`;
}

function getTemporaryRegistryFilePath(registryFilePath: string): string {
  return `${registryFilePath}.${process.pid}.${Date.now()}.tmp`;
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function logUnexpectedRegistryReadFailure(
  registryFilePath: string,
  error: unknown,
): void {
  console.warn(
    `Failed to read the dev server port registry at ${registryFilePath}; treating it as unavailable.`,
    error,
  );
}

async function readRegistryEntry(
  registryFilePath: string,
): Promise<unknown> {
  let rawRegistryJson: string;

  try {
    rawRegistryJson = await readFile(registryFilePath, 'utf8');
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }

    logUnexpectedRegistryReadFailure(registryFilePath, error);
    return undefined;
  }

  try {
    return JSON.parse(rawRegistryJson) as unknown;
  } catch (error) {
    logUnexpectedRegistryReadFailure(registryFilePath, error);
    return undefined;
  }
}

async function withDevServerPortRegistryLock<T>(
  registryFilePath: string,
  operation: () => Promise<T>,
): Promise<T> {
  const registryRootPath = path.dirname(registryFilePath);
  const registryLockFilePath = getRegistryLockFilePath(registryFilePath);

  await mkdir(registryRootPath, { recursive: true });

  let attemptCount = 0;

  while (true) {
    try {
      const lockFileHandle = await open(registryLockFilePath, 'wx');

      try {
        return await operation();
      } finally {
        await lockFileHandle.close();
        await rm(registryLockFilePath, { force: true });
      }
    } catch (error) {
      if (!isExistingFileError(error)) {
        throw error;
      }

      if (attemptCount >= REGISTRY_LOCK_MAX_ATTEMPTS) {
        throw new Error(
          `Timed out waiting for the dev server port registry lock at ${registryLockFilePath}`,
        );
      }

      attemptCount += 1;
      await delay(REGISTRY_LOCK_RETRY_DELAY_MS);
    }
  }
}

export async function writeDevServerPortRegistry(
  registryEntry: DevServerPortRegistryEntry,
  options: DevServerPortRegistryOptions = {},
): Promise<void> {
  const registryFilePath =
    options.registryFilePath ?? DEV_SERVER_PORT_REGISTRY_PATH;
  const temporaryRegistryFilePath =
    getTemporaryRegistryFilePath(registryFilePath);

  await withDevServerPortRegistryLock(registryFilePath, async () => {
    try {
      await writeFile(
        temporaryRegistryFilePath,
        JSON.stringify(registryEntry, null, 2),
      );
      await rename(temporaryRegistryFilePath, registryFilePath);
    } finally {
      await rm(temporaryRegistryFilePath, { force: true });
    }
  });
}

export async function removeDevServerPortRegistryIfOwned(
  registryEntry: DevServerPortRegistryEntry,
  options: DevServerPortRegistryOptions = {},
): Promise<void> {
  const registryFilePath =
    options.registryFilePath ?? DEV_SERVER_PORT_REGISTRY_PATH;

  await withDevServerPortRegistryLock(registryFilePath, async () => {
    const registryEntryBeforeDelete = await readRegistryEntry(registryFilePath);

    if (!matchesRegistryEntry(registryEntryBeforeDelete, registryEntry)) {
      return;
    }

    await options.beforeDelete?.();

    const currentRegistryEntry = await readRegistryEntry(registryFilePath);

    if (!matchesRegistryEntry(currentRegistryEntry, registryEntry)) {
      return;
    }

    try {
      await rm(registryFilePath, { force: true });
    } catch {
      // Best-effort cleanup: startup should not fail because registry removal did not.
    }
  });
}
