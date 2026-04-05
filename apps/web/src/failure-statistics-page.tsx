import { startTransition, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { OperatorNavigation } from './operator-navigation';

const failureStatisticsApiPath = '/api/statistics/failures';
const defaultFailureStatisticsErrorMessage =
  'Failed to load failure statistics.';

type FailureStatisticsRow = {
  test_lib_case_code: string;
  case_title: string;
  fail_count: number;
  last_failed_at: string;
  last_run_id: number;
};

type FailureStatisticsPageState =
  | {
      status: 'loading';
    }
  | {
      status: 'error';
      message: string;
    }
  | {
      status: 'ready';
      rows: FailureStatisticsRow[];
    };

type FailureStatisticsErrorResponse = {
  error: {
    message: string;
  };
};

function formatFailureTimestamp(timestamp: string) {
  const parsedDate = new Date(timestamp);

  if (Number.isNaN(parsedDate.getTime())) {
    return timestamp;
  }

  return parsedDate.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

function isFailureStatisticsErrorResponse(
  value: unknown,
): value is FailureStatisticsErrorResponse {
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

async function readFailureStatisticsErrorMessage(response: Response) {
  try {
    const responseBody = (await response.json()) as unknown;

    if (isFailureStatisticsErrorResponse(responseBody)) {
      return responseBody.error.message;
    }
  } catch {
    return defaultFailureStatisticsErrorMessage;
  }

  return defaultFailureStatisticsErrorMessage;
}

export function FailureStatisticsPage() {
  const [pageState, setPageState] = useState<FailureStatisticsPageState>({
    status: 'loading',
  });

  useEffect(() => {
    const abortController = new AbortController();

    async function loadFailureStatistics() {
      try {
        const response = await fetch(failureStatisticsApiPath, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(await readFailureStatisticsErrorMessage(response));
        }

        const responseBody = (await response.json()) as FailureStatisticsRow[];

        startTransition(() => {
          setPageState({
            status: 'ready',
            rows: responseBody,
          });
        });
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : defaultFailureStatisticsErrorMessage;

        startTransition(() => {
          setPageState({
            status: 'error',
            message,
          });
        });
      }
    }

    void loadFailureStatistics();

    return () => {
      abortController.abort();
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="page-header">
        <OperatorNavigation />
        <p className="page-eyebrow">Statistics</p>
        <h1>Failure statistics</h1>
        <p className="page-summary">
          Latest failed case groups across recorded runs, ordered by the most
          recent failure.
        </p>
      </header>
      {pageState.status === 'loading' ? (
        <section className="status-panel">
          <p>Loading failure statistics...</p>
        </section>
      ) : null}
      {pageState.status === 'error' ? (
        <section className="status-panel status-panel-error">
          <p>{pageState.message}</p>
        </section>
      ) : null}
      {pageState.status === 'ready' && pageState.rows.length === 0 ? (
        <section className="status-panel">
          <p>No failed test cases yet.</p>
        </section>
      ) : null}
      {pageState.status === 'ready' && pageState.rows.length > 0 ? (
        <section className="failures-table-panel">
          <div className="table-scroll-frame">
            <table className="failures-table">
              <thead>
                <tr>
                  <th scope="col">Case code</th>
                  <th scope="col">Title</th>
                  <th scope="col">Failures</th>
                  <th scope="col">Last failed at</th>
                  <th scope="col">Last run</th>
                </tr>
              </thead>
              <tbody>
                {pageState.rows.map((failureRow) => (
                  <tr key={failureRow.test_lib_case_code}>
                    <td className="case-code-cell">
                      <code>{failureRow.test_lib_case_code}</code>
                    </td>
                    <td>{failureRow.case_title}</td>
                    <td>{failureRow.fail_count}</td>
                    <td>
                      <time dateTime={failureRow.last_failed_at}>
                        {formatFailureTimestamp(failureRow.last_failed_at)}
                      </time>
                    </td>
                    <td>
                      <Link
                        className="run-link"
                        to={`/runs/${failureRow.last_run_id}`}
                      >
                        {failureRow.last_run_id}
                      </Link>
                    </td>
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
