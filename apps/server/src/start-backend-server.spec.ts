import assert from 'node:assert/strict';
import test from 'node:test';
import { startBackendServer } from './start-backend-server';

void test('startBackendServer writes the local dev registry entry and logs the bound URL when local dev registry support is enabled', async () => {
  const logMessages: string[] = [];
  const writtenRegistryEntries: unknown[] = [];
  const registeredCleanupCallbacks: Array<() => Promise<void> | void> = [];

  const result = await startBackendServer({
    app: {
      getUrl: () => Promise.resolve('http://localhost:3001'),
      listen: () => Promise.resolve(),
    },
    configuredPortValue: undefined,
    isLocalDevPortRegistryEnabled: true,
    shouldEnablePortFallback: true,
    logInfo: (message) => {
      logMessages.push(message);
    },
    processId: 43210,
    registerShutdownCleanup: (cleanupCallback) => {
      registeredCleanupCallbacks.push(cleanupCallback);
    },
    startedAt: '2026-03-28T10:00:00.000Z',
    writeRegistry: (registryEntry) => {
      writtenRegistryEntries.push(registryEntry);
      return Promise.resolve();
    },
  });

  assert.equal(result.boundPort, 3000);
  assert.equal(result.boundUrl, 'http://localhost:3001');
  assert.deepEqual(writtenRegistryEntries, [
    {
      port: 3000,
      pid: 43210,
      started_at: '2026-03-28T10:00:00.000Z',
    },
  ]);
  assert.deepEqual(logMessages, ['Backend listening at http://localhost:3001']);
  assert.equal(registeredCleanupCallbacks.length, 1);
});

void test('startBackendServer skips registry writes and cleanup registration outside local dev registry mode', async () => {
  let hasWrittenRegistry = false;
  let cleanupRegistrationCount = 0;

  const result = await startBackendServer({
    app: {
      getUrl: () => Promise.resolve('http://localhost:3000'),
      listen: () => Promise.resolve(),
    },
    configuredPortValue: undefined,
    isLocalDevPortRegistryEnabled: false,
    shouldEnablePortFallback: false,
    logInfo: () => undefined,
    registerShutdownCleanup: () => {
      cleanupRegistrationCount += 1;
    },
    writeRegistry: () => {
      hasWrittenRegistry = true;
      return Promise.resolve();
    },
  });

  assert.equal(result.boundPort, 3000);
  assert.equal(result.boundUrl, 'http://localhost:3000');
  assert.equal(hasWrittenRegistry, false);
  assert.equal(cleanupRegistrationCount, 0);
});
