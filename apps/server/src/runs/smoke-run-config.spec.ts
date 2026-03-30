import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSmokeRunConfig } from './smoke-run-config';

void test('loadSmokeRunConfig applies the smoke-suite defaults', () => {
  const config = loadSmokeRunConfig({
    E2E_SMOKE_CWD: '/tmp/demo-test-lib',
  } as NodeJS.ProcessEnv);

  assert.deepEqual(config, {
    suiteName: 'demo-smoke',
    command: 'npm run test:smoke:platform',
    cwd: '/tmp/demo-test-lib',
    sutBaseUrl: 'http://localhost:3000',
    probeUrl: 'http://localhost:3000/',
    timeoutMinutes: 10,
    timeoutMs: 10 * 60 * 1000,
  });
});

void test('loadSmokeRunConfig requires E2E_SMOKE_CWD', () => {
  assert.throws(
    () => loadSmokeRunConfig({} as NodeJS.ProcessEnv),
    /E2E_SMOKE_CWD is required/,
  );
});

void test('loadSmokeRunConfig rejects non-positive timeout values', () => {
  assert.throws(
    () =>
      loadSmokeRunConfig({
        E2E_SMOKE_CWD: '/tmp/demo-test-lib',
        E2E_SMOKE_TIMEOUT_MINUTES: '0',
      } as NodeJS.ProcessEnv),
    /E2E_SMOKE_TIMEOUT_MINUTES must be a positive integer/,
  );
});
