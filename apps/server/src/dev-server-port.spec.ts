import assert from 'node:assert/strict';
import test from 'node:test';
import { bindBackendPort } from './dev-server-port';

void test('bindBackendPort uses port 3000 when local dev fallback is enabled and 3000 is free', async () => {
  const attemptedPorts: number[] = [];

  const boundPort = await bindBackendPort({
    bindPort: (port) => {
      attemptedPorts.push(port);
      return Promise.resolve();
    },
    configuredPortValue: undefined,
    shouldEnablePortFallback: true,
  });

  assert.equal(boundPort, 3000);
  assert.deepEqual(attemptedPorts, [3000]);
});

void test('bindBackendPort retries upward on EADDRINUSE when PORT is unset', async () => {
  const attemptedPorts: number[] = [];

  const boundPort = await bindBackendPort({
    bindPort: (port) => {
      attemptedPorts.push(port);

      if (port < 3002) {
        const portInUseError = new Error(
          `Port ${port} is already in use`,
        ) as Error & {
          code: string;
        };
        portInUseError.code = 'EADDRINUSE';
        return Promise.reject(portInUseError);
      }

      return Promise.resolve();
    },
    configuredPortValue: undefined,
    shouldEnablePortFallback: true,
  });

  assert.equal(boundPort, 3002);
  assert.deepEqual(attemptedPorts, [3000, 3001, 3002]);
});

void test('bindBackendPort treats an explicit PORT value as strict even in local dev', async () => {
  const attemptedPorts: number[] = [];

  await assert.rejects(
    () =>
      bindBackendPort({
        bindPort: (port) => {
          attemptedPorts.push(port);

          const portInUseError = new Error(
            `Port ${port} is already in use`,
          ) as Error & {
            code: string;
          };
          portInUseError.code = 'EADDRINUSE';
          return Promise.reject(portInUseError);
        },
        configuredPortValue: '3050',
        shouldEnablePortFallback: true,
      }),
    {
      code: 'EADDRINUSE',
    },
  );

  assert.deepEqual(attemptedPorts, [3050]);
});

void test('bindBackendPort rejects malformed explicit PORT values instead of coercing them', async () => {
  const attemptedPorts: number[] = [];

  await assert.rejects(
    () =>
      bindBackendPort({
        bindPort: (port) => {
          attemptedPorts.push(port);
          return Promise.resolve();
        },
        configuredPortValue: '3000abc',
        shouldEnablePortFallback: true,
      }),
    /PORT must be a positive integer/,
  );

  assert.deepEqual(attemptedPorts, []);
});

void test('bindBackendPort rejects explicit PORT=0 because it does not identify a stable backend port', async () => {
  const attemptedPorts: number[] = [];

  await assert.rejects(
    () =>
      bindBackendPort({
        bindPort: (port) => {
          attemptedPorts.push(port);
          return Promise.resolve();
        },
        configuredPortValue: '0',
        shouldEnablePortFallback: true,
      }),
    /PORT must be a positive integer/,
  );

  assert.deepEqual(attemptedPorts, []);
});
