import { Injectable } from '@nestjs/common';

export type SmokeRunProbeFetch = typeof fetch;

export interface ProbeSmokeRunUrlOptions {
  fetchImpl?: SmokeRunProbeFetch;
  timeoutMs?: number;
  retryCount?: number;
}

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 400;
}

function formatProbeFailureReason(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'timed out';
}

export async function probeSmokeRunUrl(
  probeUrl: string,
  options: ProbeSmokeRunUrlOptions = {},
): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 3_000;
  const retryCount = options.retryCount ?? 2;
  let lastError: unknown;

  for (let attemptIndex = 1; attemptIndex <= retryCount; attemptIndex += 1) {
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    try {
      const response = await fetchImpl(probeUrl, {
        signal: abortController.signal,
        redirect: 'manual',
      });

      if (isSuccessStatus(response.status)) {
        return;
      }

      lastError = new Error(`Probe returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  throw new Error(
    `Smoke probe failed for ${probeUrl}: ${formatProbeFailureReason(lastError)}.`,
    {
      cause: lastError,
    },
  );
}

@Injectable()
export class RunProbeService {
  probeSmokeRunUrl(
    probeUrl: string,
    options: ProbeSmokeRunUrlOptions = {},
  ): Promise<void> {
    return probeSmokeRunUrl(probeUrl, options);
  }
}
