import { startTransition, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { failureStatisticsRoute } from './operator-navigation';

export const runDetailRoutePattern = '/runs/:id';

const defaultRunDetailErrorMessage = 'Failed to load run detail.';
const runDetailPollingIntervalMs = 2_000;

type RunStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'abort'
  | 'fail'
  | 'timeout'
  | 'cancelled';

type RunArtifactPresence = {
  stdout_log: boolean;
  stderr_log: boolean;
  results_json: boolean;
  report_dir: boolean;
};

type RunResultSummary = {
  total_count: number;
  passed_count: number;
  failed_count: number;
  skipped_count: number;
};

type RunDetailResponseBody = Omit<RunDetail, 'result_summary'> & {
  result_summary?: RunResultSummary | null;
};

type RunDetail = {
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
  command: string;
  cwd: string;
  sut_base_url: string;
  probe_url: string;
  artifacts: RunArtifactPresence;
  result_summary: RunResultSummary | null;
};

type RunDetailErrorResponse = {
  error: {
    message: string;
  };
};

type RunDetailPageState =
  | {
      status: 'loading';
    }
  | {
      status: 'not_found';
      route_run_id: string;
      message: string;
    }
  | {
      status: 'error';
      route_run_id: string;
      message: string;
    }
  | {
      status: 'ready';
      route_run_id: string;
      runDetail: RunDetail;
    };

type DetailField = {
  label: string;
  value: ReactNode;
  valueClassName?: string;
};

function isRunDetailErrorResponse(
  value: unknown,
): value is RunDetailErrorResponse {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }

  const errorValue = value.error;

  return (
    typeof errorValue === 'object' &&
    errorValue !== null &&
    'message' in errorValue &&
    typeof errorValue.message === 'string'
  );
}

async function readRunDetailErrorMessage(response: Response) {
  try {
    const responseBody = (await response.json()) as unknown;

    if (isRunDetailErrorResponse(responseBody)) {
      return responseBody.error.message;
    }
  } catch {
    return defaultRunDetailErrorMessage;
  }

  return defaultRunDetailErrorMessage;
}

function isPositiveInteger(value: string | undefined): value is string {
  return value !== undefined && /^[1-9][0-9]*$/.test(value);
}

function normalizeRunDetail(responseBody: RunDetailResponseBody): RunDetail {
  return {
    ...responseBody,
    result_summary: responseBody.result_summary ?? null,
  };
}

function shouldPollRunStatus(status: RunStatus) {
  return status === 'pending' || status === 'running';
}

function formatTimestamp(timestamp: string) {
  const parsedDate = new Date(timestamp);

  if (Number.isNaN(parsedDate.getTime())) {
    return timestamp;
  }

  return parsedDate.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

function formatTimestampOrUnavailable(
  timestamp: string | null,
  unavailableCopy: string,
) {
  if (timestamp === null) {
    return unavailableCopy;
  }

  return formatTimestamp(timestamp);
}

function formatDuration(runDetail: RunDetail) {
  if (runDetail.duration_ms !== null) {
    return `${runDetail.duration_ms.toLocaleString()} ms`;
  }

  if (shouldPollRunStatus(runDetail.status)) {
    return 'Available after the run reaches a terminal state.';
  }

  return 'Not recorded for this run.';
}

function formatStartTime(runDetail: RunDetail) {
  if (runDetail.start_time !== null) {
    return formatTimestamp(runDetail.start_time);
  }

  if (runDetail.status === 'pending') {
    return 'Not started yet.';
  }

  if (runDetail.status === 'running') {
    return 'Start time is not recorded yet.';
  }

  return 'Not recorded for this run.';
}

function formatEndTime(runDetail: RunDetail) {
  return formatTimestampOrUnavailable(
    runDetail.end_time,
    shouldPollRunStatus(runDetail.status)
      ? 'Available after the run reaches a terminal state.'
      : 'Not recorded for this run.',
  );
}

function formatExitCode(runDetail: RunDetail) {
  if (runDetail.exit_code !== null) {
    return String(runDetail.exit_code);
  }

  if (shouldPollRunStatus(runDetail.status)) {
    return 'Available after the runner exits.';
  }

  return 'Not recorded for this run.';
}

function formatReason(reason: string | null) {
  return reason ?? 'Not recorded for this run.';
}

function renderDetailFieldList(fields: DetailField[]) {
  return (
    <dl className="detail-list">
      {fields.map((field) => (
        <div className="detail-list-item" key={field.label}>
          <dt>{field.label}</dt>
          <dd className={field.valueClassName}>{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RunDetailSections({ runDetail }: { runDetail: RunDetail }) {
  const overviewFields: DetailField[] = [
    {
      label: 'Suite',
      value: runDetail.suite_name,
    },
    {
      label: 'Status',
      value: <span className="run-status-pill">{runDetail.status}</span>,
      valueClassName: 'detail-value-strong',
    },
    {
      label: 'Reason',
      value: formatReason(runDetail.reason),
    },
    {
      label: 'Exit code',
      value: formatExitCode(runDetail),
    },
    {
      label: 'Created at',
      value: (
        <time dateTime={runDetail.created_at}>
          {formatTimestamp(runDetail.created_at)}
        </time>
      ),
    },
  ];

  const timingFields: DetailField[] = [
    {
      label: 'Start time',
      value:
        runDetail.start_time === null ? (
          formatStartTime(runDetail)
        ) : (
          <time dateTime={runDetail.start_time}>
            {formatStartTime(runDetail)}
          </time>
        ),
    },
    {
      label: 'End time',
      value:
        runDetail.end_time === null ? (
          formatEndTime(runDetail)
        ) : (
          <time dateTime={runDetail.end_time}>{formatEndTime(runDetail)}</time>
        ),
    },
    {
      label: 'Duration',
      value: formatDuration(runDetail),
    },
  ];

  const executionContextFields: DetailField[] = [
    {
      label: 'Command',
      value: <code>{runDetail.command}</code>,
    },
    {
      label: 'Working directory',
      value: <code>{runDetail.cwd}</code>,
    },
    {
      label: 'SUT base URL',
      value: <code>{runDetail.sut_base_url}</code>,
    },
    {
      label: 'Probe URL',
      value: <code>{runDetail.probe_url}</code>,
    },
  ];

  const artifactRows = [
    {
      label: 'stdout log',
      isAvailable: runDetail.artifacts.stdout_log,
    },
    {
      label: 'stderr log',
      isAvailable: runDetail.artifacts.stderr_log,
    },
    {
      label: 'results.json',
      isAvailable: runDetail.artifacts.results_json,
    },
    {
      label: 'Playwright report directory',
      isAvailable: runDetail.artifacts.report_dir,
    },
  ];

  return (
    <>
      {shouldPollRunStatus(runDetail.status) ? (
        <section className="status-panel">
          <p>Auto-refreshing every 2 seconds while this run is active.</p>
        </section>
      ) : null}
      <div className="detail-grid">
        <section className="detail-panel">
          <h2>Overview</h2>
          <p className="section-summary">
            Stable lifecycle metadata for this recorded run.
          </p>
          {renderDetailFieldList(overviewFields)}
        </section>
        <section className="detail-panel">
          <h2>Timing</h2>
          <p className="section-summary">
            Explicit timing fields, including unavailable values.
          </p>
          {renderDetailFieldList(timingFields)}
        </section>
        <section className="detail-panel detail-panel-wide">
          <h2>Execution context</h2>
          <p className="section-summary">
            Snapshot of the command and environment used for this run.
          </p>
          {renderDetailFieldList(executionContextFields)}
        </section>
        <section className="detail-panel">
          <h2>Artifacts</h2>
          <p className="section-summary">
            Availability only in this slice. Logs, report access, and downloads
            stay out of scope here.
          </p>
          <ul className="artifact-list">
            {artifactRows.map((artifactRow) => (
              <li className="artifact-row" key={artifactRow.label}>
                <span>{artifactRow.label}</span>
                <strong
                  className={
                    artifactRow.isAvailable
                      ? 'availability-badge availability-badge-available'
                      : 'availability-badge availability-badge-unavailable'
                  }
                >
                  {artifactRow.isAvailable ? 'Available' : 'Not available'}
                </strong>
              </li>
            ))}
          </ul>
        </section>
        <section className="detail-panel">
          <h2>Result summary</h2>
          <p className="section-summary">
            Parsed case-result coverage at aggregate level only.
          </p>
          {runDetail.result_summary === null ? (
            <p className="empty-detail-copy">
              Structured case summary is not available for this run.
            </p>
          ) : (
            <div className="summary-stats-grid">
              <article className="summary-stat">
                <span>Total</span>
                <strong>{runDetail.result_summary.total_count}</strong>
              </article>
              <article className="summary-stat">
                <span>Passed</span>
                <strong>{runDetail.result_summary.passed_count}</strong>
              </article>
              <article className="summary-stat">
                <span>Failed</span>
                <strong>{runDetail.result_summary.failed_count}</strong>
              </article>
              <article className="summary-stat">
                <span>Skipped</span>
                <strong>{runDetail.result_summary.skipped_count}</strong>
              </article>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export function RunDetailPage() {
  const routeParams = useParams();
  const runId = routeParams.id;
  const routeRunId = runId ?? 'unknown';
  const [pageState, setPageState] = useState<RunDetailPageState>({
    status: 'loading',
  });

  useEffect(() => {
    if (!isPositiveInteger(runId)) {
      startTransition(() => {
        setPageState({
          status: 'error',
          route_run_id: routeRunId,
          message: 'Run id must be a positive integer.',
        });
      });
      return;
    }

    const abortController = new AbortController();
    let pollingTimeoutId: number | null = null;
    let lastObservedRunDetail: RunDetail | null = null;

    startTransition(() => {
      setPageState({
        status: 'loading',
      });
    });

    function scheduleNextPoll(loadRunDetail: () => Promise<void>) {
      if (abortController.signal.aborted) {
        return;
      }

      if (pollingTimeoutId !== null) {
        window.clearTimeout(pollingTimeoutId);
      }

      pollingTimeoutId = window.setTimeout(() => {
        void loadRunDetail();
      }, runDetailPollingIntervalMs);
    }

    async function loadRunDetail() {
      try {
        const response = await fetch(`/api/runs/${runId}`, {
          signal: abortController.signal,
        });

        if (response.status === 404) {
          const message = await readRunDetailErrorMessage(response);

          if (abortController.signal.aborted) {
            return;
          }

          startTransition(() => {
            setPageState({
              status: 'not_found',
              route_run_id: routeRunId,
              message,
            });
          });
          return;
        }

        if (!response.ok) {
          throw new Error(await readRunDetailErrorMessage(response));
        }

        const responseBody = normalizeRunDetail(
          (await response.json()) as RunDetailResponseBody,
        );

        if (abortController.signal.aborted) {
          return;
        }

        lastObservedRunDetail = responseBody;

        startTransition(() => {
          setPageState({
            status: 'ready',
            route_run_id: routeRunId,
            runDetail: responseBody,
          });
        });

        if (shouldPollRunStatus(responseBody.status)) {
          scheduleNextPoll(loadRunDetail);
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        if (
          lastObservedRunDetail !== null &&
          shouldPollRunStatus(lastObservedRunDetail.status)
        ) {
          scheduleNextPoll(loadRunDetail);
          return;
        }

        const message =
          error instanceof Error ? error.message : defaultRunDetailErrorMessage;

        startTransition(() => {
          setPageState({
            status: 'error',
            route_run_id: routeRunId,
            message,
          });
        });
      }
    }

    void loadRunDetail();

    return () => {
      abortController.abort();

      if (pollingTimeoutId !== null) {
        window.clearTimeout(pollingTimeoutId);
      }
    };
  }, [routeRunId, runId]);

  const isCurrentRouteState =
    pageState.status === 'loading' ||
    ('route_run_id' in pageState && pageState.route_run_id === routeRunId);

  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="page-eyebrow">Runs</p>
        <h1>{`Run ${routeRunId}`}</h1>
        <p className="page-summary">
          Read-only detail for one recorded run, focused on observation instead
          of control actions.
        </p>
        <Link className="run-link page-link-inline" to={failureStatisticsRoute}>
          Back to failure statistics
        </Link>
      </header>
      {pageState.status === 'loading' || !isCurrentRouteState ? (
        <section className="status-panel">
          <p>Loading run detail...</p>
        </section>
      ) : null}
      {pageState.status === 'not_found' && isCurrentRouteState ? (
        <section className="status-panel">
          <p>{pageState.message}</p>
        </section>
      ) : null}
      {pageState.status === 'error' && isCurrentRouteState ? (
        <section className="status-panel status-panel-error">
          <p>{pageState.message}</p>
        </section>
      ) : null}
      {pageState.status === 'ready' && isCurrentRouteState ? (
        <RunDetailSections runDetail={pageState.runDetail} />
      ) : null}
    </main>
  );
}
