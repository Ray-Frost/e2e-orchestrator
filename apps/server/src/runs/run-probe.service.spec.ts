import assert from 'node:assert/strict';
import test from 'node:test';
import { probeSmokeRunUrl, type SmokeRunProbeFetch } from './run-probe.service';

void test('probeSmokeRunUrl retries once after a failure and accepts 2xx-3xx', async () => {
  let attemptCount = 0;
  const fetchImpl: SmokeRunProbeFetch = () => {
    attemptCount += 1;

    return Promise.resolve({
      status: attemptCount === 1 ? 503 : 204,
    } as Response);
  };

  await probeSmokeRunUrl('http://example.test/', {
    fetchImpl,
    retryCount: 2,
    timeoutMs: 10,
  });

  assert.equal(attemptCount, 2);
});

void test('probeSmokeRunUrl rejects after the configured retry budget', async () => {
  let attemptCount = 0;
  const fetchImpl: SmokeRunProbeFetch = () => {
    attemptCount += 1;

    return Promise.resolve({
      status: 500,
    } as Response);
  };

  await assert.rejects(
    () =>
      probeSmokeRunUrl('http://example.test/', {
        fetchImpl,
        retryCount: 2,
        timeoutMs: 10,
      }),
    /probe failed/i,
  );

  assert.equal(attemptCount, 2);
});

void test('probeSmokeRunUrl aborts a slow request at the configured timeout', async () => {
  let attemptCount = 0;
  const fetchImpl: SmokeRunProbeFetch = async (
    _url,
    requestInit?: RequestInit,
  ) => {
    attemptCount += 1;

    await new Promise<void>((resolve, reject) => {
      requestInit?.signal?.addEventListener('abort', () => {
        reject(new Error('aborted'));
      });
    });

    return {
      status: 204,
    } as Response;
  };

  await assert.rejects(
    () =>
      probeSmokeRunUrl('http://example.test/', {
        fetchImpl,
        retryCount: 1,
        timeoutMs: 10,
      }),
    /aborted|timed out/i,
  );

  assert.equal(attemptCount, 1);
});
