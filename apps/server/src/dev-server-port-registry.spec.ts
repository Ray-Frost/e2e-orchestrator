import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  removeDevServerPortRegistryIfOwned,
  writeDevServerPortRegistry,
} from './dev-server-port-registry';

void test('writeDevServerPortRegistry writes the locked JSON shape', async () => {
  const registryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'dev-server-registry-'),
  );
  const registryFilePath = path.join(registryRoot, 'dev-server-port.json');

  const registryEntry = {
    port: 3001,
    pid: 12345,
    started_at: '2026-03-28T10:00:00.000Z',
  };

  await writeDevServerPortRegistry(registryEntry, {
    registryFilePath,
  });

  const rawRegistryJson = await readFile(registryFilePath, 'utf8');
  const parsedRegistryJson = JSON.parse(rawRegistryJson) as unknown;

  assert.deepEqual(parsedRegistryJson, registryEntry);
});

void test('removeDevServerPortRegistryIfOwned removes the registry file when it still belongs to the same process instance', async () => {
  const registryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'dev-server-registry-'),
  );
  const registryFilePath = path.join(registryRoot, 'dev-server-port.json');

  const registryEntry = {
    port: 3001,
    pid: 12345,
    started_at: '2026-03-28T10:00:00.000Z',
  };

  await writeDevServerPortRegistry(registryEntry, {
    registryFilePath,
  });

  await removeDevServerPortRegistryIfOwned(registryEntry, {
    registryFilePath,
  });

  await assert.rejects(() => stat(registryFilePath));
});

void test('removeDevServerPortRegistryIfOwned keeps the registry file when another process instance replaced it', async () => {
  const registryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'dev-server-registry-'),
  );
  const registryFilePath = path.join(registryRoot, 'dev-server-port.json');

  const originalRegistryEntry = {
    port: 3001,
    pid: 12345,
    started_at: '2026-03-28T10:00:00.000Z',
  };

  const replacementRegistryEntry = {
    port: 3002,
    pid: 23456,
    started_at: '2026-03-28T10:01:00.000Z',
  };

  await writeDevServerPortRegistry(replacementRegistryEntry, {
    registryFilePath,
  });

  await removeDevServerPortRegistryIfOwned(originalRegistryEntry, {
    registryFilePath,
  });

  const rawRegistryJson = await readFile(registryFilePath, 'utf8');
  const parsedRegistryJson = JSON.parse(rawRegistryJson) as unknown;

  assert.deepEqual(parsedRegistryJson, replacementRegistryEntry);
});

void test('removeDevServerPortRegistryIfOwned keeps the registry file when it changes between the ownership check and delete', async () => {
  const registryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'dev-server-registry-'),
  );
  const registryFilePath = path.join(registryRoot, 'dev-server-port.json');

  const originalRegistryEntry = {
    port: 3001,
    pid: 12345,
    started_at: '2026-03-28T10:00:00.000Z',
  };

  const replacementRegistryEntry = {
    port: 3002,
    pid: 23456,
    started_at: '2026-03-28T10:01:00.000Z',
  };

  await writeDevServerPortRegistry(originalRegistryEntry, {
    registryFilePath,
  });

  await removeDevServerPortRegistryIfOwned(originalRegistryEntry, {
    beforeDelete: async () => {
      await writeFile(
        registryFilePath,
        JSON.stringify(replacementRegistryEntry, null, 2),
      );
    },
    registryFilePath,
  });

  const rawRegistryJson = await readFile(registryFilePath, 'utf8');
  const parsedRegistryJson = JSON.parse(rawRegistryJson) as unknown;

  assert.deepEqual(parsedRegistryJson, replacementRegistryEntry);
});
