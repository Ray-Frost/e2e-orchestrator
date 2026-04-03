import assert from 'node:assert/strict';
import test from 'node:test';
import { RunSchedulerService } from './run-scheduler.service';

function createSchedulerService(): RunSchedulerService {
  return new RunSchedulerService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      getConfig: () => ({
        timeoutMinutes: 1,
        timeoutMs: 60_000,
      }),
    } as never,
  );
}

async function waitForObservedRunCount(
  observedRunIds: number[],
  expectedCount: number,
  timeoutMs: number,
) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (observedRunIds.length >= expectedCount) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(
    `Expected ${expectedCount} observed runs, but saw ${observedRunIds.length}.`,
  );
}

void test('drainQueue continues after a queued run rejects', async () => {
  const schedulerService = createSchedulerService();
  const observedRunIds: number[] = [];

  (
    schedulerService as unknown as {
      executeRun: (runId: number) => Promise<void>;
    }
  ).executeRun = (runId: number) => {
    observedRunIds.push(runId);

    if (runId === 1) {
      return Promise.reject(new Error('boom'));
    }

    return Promise.resolve();
  };

  schedulerService.enqueueRun(1);
  schedulerService.enqueueRun(2);

  await waitForObservedRunCount(observedRunIds, 2, 500);

  assert.deepEqual(observedRunIds, [1, 2]);
});
