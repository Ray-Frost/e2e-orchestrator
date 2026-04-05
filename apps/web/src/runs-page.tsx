import { startTransition, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { readApiErrorMessage } from './api-error';
import { OperatorNavigation } from './operator-navigation';

const runsApiPath = '/api/runs';
const defaultRunsErrorMessage = 'Failed to load runs.';
const runsPollingIntervalMs = 2_000;
const notRecordedForRunCopy = 'Not recorded for this run.';
const availableAfterTerminalCopy =
  'Available after the run reaches a terminal state.';
const runsPollingNotice =
  'Polling every 2 seconds while at least one run is active.';

type RunStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'abort'
  | 'fail'
  | 'timeout'
  | 'cancelled';

type RunSummary = {
  id: number;
  suite_id: number;
  suite_name: string;
  status: RunStatus;
  reason: string | null;
  exit_code: number | null;
  created_at: string;
  start_time: string | null;
  end_time: string | null;
  duration_ms: number | null;
};

type RunsPageState =
  | {
      status: 'loading';
    }
  | {
      status: 'error';
      message: string;
    }
  | {
      status: 'ready';
      runs: RunSummary[];
    };

function shouldPollRunStatus(status: RunStatus) {
  return status === 'pending' || status === 'running';
}

function shouldPollRuns(runs: RunSummary[]) {
  return runs.some((runSummary) => shouldPollRunStatus(runSummary.status));
}

function formatTimestamp(timestamp: string) {
  const parsedDate = new Date(timestamp);

  if (Number.isNaN(parsedDate.getTime())) {
    return timestamp;
  }

  return parsedDate.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

function formatStartTime(runSummary: RunSummary) {
  if (runSummary.start_time !== null) {
    return formatTimestamp(runSummary.start_time);
  }

  if (runSummary.status === 'pending') {
    return 'Not started yet.';
  }

  if (runSummary.status === 'running') {
    return 'Start time is not recorded yet.';
  }

  return notRecordedForRunCopy;
}

function formatEndTime(runSummary: RunSummary) {
  if (runSummary.end_time === null) {
    return shouldPollRunStatus(runSummary.status)
      ? availableAfterTerminalCopy
      : notRecordedForRunCopy;
  }

  return formatTimestamp(runSummary.end_time);
}

function formatDuration(runSummary: RunSummary) {
  if (runSummary.duration_ms !== null) {
    return `${runSummary.duration_ms.toLocaleString()} ms`;
  }

  if (shouldPollRunStatus(runSummary.status)) {
    return availableAfterTerminalCopy;
  }

  return notRecordedForRunCopy;
}

function formatReason(reason: string | null) {
  return reason ?? 'None';
}

export function RunsPage() {
  const [pageState, setPageState] = useState<RunsPageState>({
    status: 'loading',
  });

  useEffect(() => {
    const abortController = new AbortController();
    let pollingTimeoutId: number | null = null;
    let lastObservedRuns: RunSummary[] | null = null;

    function scheduleNextPoll(loadRuns: () => Promise<void>) {
      if (abortController.signal.aborted) {
        return;
      }

      if (pollingTimeoutId !== null) {
        window.clearTimeout(pollingTimeoutId);
      }

      pollingTimeoutId = window.setTimeout(() => {
        void loadRuns();
      }, runsPollingIntervalMs);
    }

    async function loadRuns() {
      try {
        const response = await fetch(runsApiPath, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(
            await readApiErrorMessage(response, defaultRunsErrorMessage),
          );
        }

        const responseBody = (await response.json()) as RunSummary[];

        if (abortController.signal.aborted) {
          return;
        }

        lastObservedRuns = responseBody;

        startTransition(() => {
          setPageState({
            status: 'ready',
            runs: responseBody,
          });
        });

        if (shouldPollRuns(responseBody)) {
          scheduleNextPoll(loadRuns);
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        if (lastObservedRuns !== null && shouldPollRuns(lastObservedRuns)) {
          scheduleNextPoll(loadRuns);
          return;
        }

        const message =
          error instanceof Error ? error.message : defaultRunsErrorMessage;

        startTransition(() => {
          setPageState({
            status: 'error',
            message,
          });
        });
      }
    }

    void loadRuns();

    return () => {
      abortController.abort();

      if (pollingTimeoutId !== null) {
        window.clearTimeout(pollingTimeoutId);
      }
    };
  }, []);

  const shouldShowPollingNotice =
    pageState.status === 'ready' && shouldPollRuns(pageState.runs);

  return (
    <main className="app-shell">
      <header className="page-header">
        <OperatorNavigation />
        <p className="page-eyebrow">Operations</p>
        <h1>Runs</h1>
        <p className="page-summary">
          Scan recent run history, watch active work settle, and open run detail
          only when you need deeper inspection.
        </p>
      </header>
      {pageState.status === 'loading' ? (
        <section className="status-panel">
          <p>Loading runs...</p>
        </section>
      ) : null}
      {pageState.status === 'error' ? (
        <section className="status-panel status-panel-error">
          <p>{pageState.message}</p>
        </section>
      ) : null}
      {pageState.status === 'ready' && pageState.runs.length === 0 ? (
        <section className="status-panel">
          <p>No runs have been recorded yet.</p>
        </section>
      ) : null}
      {shouldShowPollingNotice ? (
        <section className="status-panel status-panel-info">
          <p>{runsPollingNotice}</p>
        </section>
      ) : null}
      {pageState.status === 'ready' && pageState.runs.length > 0 ? (
        <section className="runs-table-panel">
          <div className="table-scroll-frame">
            <table className="runs-table">
              <thead>
                <tr>
                  <th scope="col">Run</th>
                  <th scope="col">Suite</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Created</th>
                  <th scope="col">Started</th>
                  <th scope="col">Ended</th>
                  <th scope="col">Duration</th>
                </tr>
              </thead>
              <tbody>
                {pageState.runs.map((runSummary) => (
                  <tr key={runSummary.id}>
                    <td>
                      <Link className="run-link" to={`/runs/${runSummary.id}`}>
                        {runSummary.id}
                      </Link>
                    </td>
                    <td>{runSummary.suite_name}</td>
                    <td>
                      <span className="run-status-pill">
                        {runSummary.status}
                      </span>
                    </td>
                    <td>{formatReason(runSummary.reason)}</td>
                    <td>
                      <time dateTime={runSummary.created_at}>
                        {formatTimestamp(runSummary.created_at)}
                      </time>
                    </td>
                    <td>{formatStartTime(runSummary)}</td>
                    <td>{formatEndTime(runSummary)}</td>
                    <td>{formatDuration(runSummary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
