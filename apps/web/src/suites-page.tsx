import { startTransition, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { OperatorNavigation } from './operator-navigation';

const suitesApiPath = '/api/suites';
const createRunApiPath = '/api/runs';
const defaultSuitesErrorMessage = 'Failed to load suites.';
const defaultCreateRunErrorMessage = 'Failed to create run.';

type SuiteSummary = {
  id: number;
  suite_name: string;
  command: string;
  sut_base_url: string;
};

type ErrorResponse = {
  error: {
    message: string;
  };
};

type CreateRunResponse = {
  id: number;
};

type SuitesPageState =
  | {
      status: 'loading';
    }
  | {
      status: 'error';
      message: string;
    }
  | {
      status: 'ready';
      suites: SuiteSummary[];
    };

type RunFeedback =
  | {
      status: 'success';
      runId: number;
    }
  | {
      status: 'error';
      message: string;
    };

function isErrorResponse(value: unknown): value is ErrorResponse {
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

async function readErrorMessage(response: Response, fallbackMessage: string) {
  try {
    const responseBody = (await response.json()) as unknown;

    if (isErrorResponse(responseBody)) {
      return responseBody.error.message;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}

function removeSuiteId(suiteIds: number[], suiteIdToRemove: number): number[] {
  return suiteIds.filter((suiteId) => suiteId !== suiteIdToRemove);
}

export function SuitesPage() {
  const [pageState, setPageState] = useState<SuitesPageState>({
    status: 'loading',
  });
  const [submittingSuiteIds, setSubmittingSuiteIds] = useState<number[]>([]);
  const [runFeedbackBySuiteId, setRunFeedbackBySuiteId] = useState<
    Record<number, RunFeedback | undefined>
  >({});

  useEffect(() => {
    const abortController = new AbortController();

    async function loadSuites() {
      try {
        const response = await fetch(suitesApiPath, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(
            await readErrorMessage(response, defaultSuitesErrorMessage),
          );
        }

        const responseBody = (await response.json()) as SuiteSummary[];

        startTransition(() => {
          setPageState({
            status: 'ready',
            suites: responseBody,
          });
        });
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        const message =
          error instanceof Error ? error.message : defaultSuitesErrorMessage;

        startTransition(() => {
          setPageState({
            status: 'error',
            message,
          });
        });
      }
    }

    void loadSuites();

    return () => {
      abortController.abort();
    };
  }, []);

  async function handleRunSuite(suiteId: number) {
    setSubmittingSuiteIds((currentSuiteIds) => {
      if (currentSuiteIds.includes(suiteId)) {
        return currentSuiteIds;
      }

      return [...currentSuiteIds, suiteId];
    });

    setRunFeedbackBySuiteId((currentFeedbackBySuiteId) => ({
      ...currentFeedbackBySuiteId,
      [suiteId]: undefined,
    }));

    try {
      const response = await fetch(createRunApiPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suite_id: suiteId,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, defaultCreateRunErrorMessage),
        );
      }

      const responseBody = (await response.json()) as CreateRunResponse;

      startTransition(() => {
        setRunFeedbackBySuiteId((currentFeedbackBySuiteId) => ({
          ...currentFeedbackBySuiteId,
          [suiteId]: {
            status: 'success',
            runId: responseBody.id,
          },
        }));
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : defaultCreateRunErrorMessage;

      startTransition(() => {
        setRunFeedbackBySuiteId((currentFeedbackBySuiteId) => ({
          ...currentFeedbackBySuiteId,
          [suiteId]: {
            status: 'error',
            message,
          },
        }));
      });
    } finally {
      startTransition(() => {
        setSubmittingSuiteIds((currentSuiteIds) =>
          removeSuiteId(currentSuiteIds, suiteId),
        );
      });
    }
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <OperatorNavigation />
        <p className="page-eyebrow">Run Entry</p>
        <h1>Suites</h1>
        <p className="page-summary">
          Start a configured suite from one stable entry surface, then jump into
          run detail only when you need deeper inspection.
        </p>
      </header>
      {pageState.status === 'loading' ? (
        <section className="status-panel">
          <p>Loading suites...</p>
        </section>
      ) : null}
      {pageState.status === 'error' ? (
        <section className="status-panel status-panel-error">
          <p>{pageState.message}</p>
        </section>
      ) : null}
      {pageState.status === 'ready' && pageState.suites.length === 0 ? (
        <section className="status-panel">
          <p>No runnable suites are configured yet.</p>
        </section>
      ) : null}
      {pageState.status === 'ready' && pageState.suites.length > 0 ? (
        <section className="suites-grid" aria-label="Suites">
          {pageState.suites.map((suite) => {
            const isSubmitting = submittingSuiteIds.includes(suite.id);
            const runFeedback = runFeedbackBySuiteId[suite.id];

            return (
              <article className="detail-panel suite-card" key={suite.id}>
                <div className="suite-card-header">
                  <p className="suite-card-label">Suite</p>
                  <h2>{suite.suite_name}</h2>
                </div>
                <dl className="detail-list">
                  <div className="detail-list-item">
                    <dt>Command</dt>
                    <dd>
                      <code>{suite.command}</code>
                    </dd>
                  </div>
                  <div className="detail-list-item">
                    <dt>SUT base URL</dt>
                    <dd>
                      <code>{suite.sut_base_url}</code>
                    </dd>
                  </div>
                </dl>
                <div className="suite-actions">
                  <button
                    className="suite-run-button"
                    disabled={isSubmitting}
                    onClick={() => {
                      void handleRunSuite(suite.id);
                    }}
                    type="button"
                  >
                    {isSubmitting ? 'Running...' : 'Run suite'}
                  </button>
                  {runFeedback?.status === 'success' ? (
                    <p className="suite-feedback suite-feedback-success">
                      Run {runFeedback.runId} created.{' '}
                      <Link to={`/runs/${runFeedback.runId}`}>
                        Open run detail
                      </Link>
                      .
                    </p>
                  ) : null}
                  {runFeedback?.status === 'error' ? (
                    <p className="suite-feedback suite-feedback-error">
                      {runFeedback.message}
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
