import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from './app';

type SuiteSummaryResponse = {
  id: number;
  suite_name: string;
  command: string;
  sut_base_url: string;
};

type RunStatusResponse =
  | 'pending'
  | 'running'
  | 'success'
  | 'abort'
  | 'fail'
  | 'timeout'
  | 'cancelled';

type RunSummaryResponse = {
  id: number;
  suite_id: number;
  suite_name: string;
  status: RunStatusResponse;
  reason: string | null;
  exit_code: number | null;
  created_at: string;
  start_time: string | null;
  end_time: string | null;
  duration_ms: number | null;
};

type RunDetailResponse = {
  id: number;
  suite_id: number;
  suite_name: string;
  status: RunStatusResponse;
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
  artifacts: {
    stdout_log: boolean;
    stderr_log: boolean;
    results_json: boolean;
    report_dir: boolean;
  };
  result_summary?: {
    total_count: number;
    passed_count: number;
    failed_count: number;
    skipped_count: number;
  } | null;
};

const runDetailPollingNotice =
  'Auto-refreshing every 2 seconds while this run is active.';
const runsPollingNotice =
  'Polling every 2 seconds while at least one run is active.';

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function createSuiteSummaryResponse(
  overrides: Partial<SuiteSummaryResponse> = {},
): SuiteSummaryResponse {
  return {
    id: 1,
    suite_name: 'demo-smoke',
    command: 'npm run test:smoke:platform',
    sut_base_url: 'http://localhost:3000',
    ...overrides,
  };
}

function createRunDetailResponse(
  overrides: Partial<RunDetailResponse> = {},
): RunDetailResponse {
  const baseResponse: RunDetailResponse = {
    id: 12,
    suite_id: 1,
    suite_name: 'demo-smoke',
    status: 'success',
    reason: null,
    exit_code: 0,
    created_at: '2026-03-20T12:00:00.000Z',
    start_time: '2026-03-20T12:00:02.000Z',
    end_time: '2026-03-20T12:00:07.000Z',
    duration_ms: 5000,
    command: 'npm run test:smoke:platform',
    cwd: '/tmp/demo-test-lib',
    sut_base_url: 'http://localhost:3000',
    probe_url: 'http://localhost:3000/',
    artifacts: {
      stdout_log: true,
      stderr_log: false,
      results_json: true,
      report_dir: false,
    },
    result_summary: {
      total_count: 3,
      passed_count: 2,
      failed_count: 1,
      skipped_count: 0,
    },
  };

  return {
    ...baseResponse,
    ...overrides,
    artifacts: {
      ...baseResponse.artifacts,
      ...(overrides.artifacts ?? {}),
    },
    result_summary:
      overrides.result_summary === undefined
        ? baseResponse.result_summary
        : overrides.result_summary,
  };
}

function createRunSummaryResponse(
  overrides: Partial<RunSummaryResponse> = {},
): RunSummaryResponse {
  return {
    id: 12,
    suite_id: 1,
    suite_name: 'demo-smoke',
    status: 'success',
    reason: null,
    exit_code: 0,
    created_at: '2026-03-20T12:00:00.000Z',
    start_time: '2026-03-20T12:00:02.000Z',
    end_time: '2026-03-20T12:00:07.000Z',
    duration_ms: 5000,
    ...overrides,
  };
}

function renderAppAtRoute(pathname: string) {
  window.history.pushState({}, '', pathname);
  return render(<App />);
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function navigateToRoute(pathname: string) {
  await act(async () => {
    window.history.pushState({}, '', pathname);
    window.dispatchEvent(new PopStateEvent('popstate'));
    await Promise.resolve();
  });
}

function createDeferredPromise<Value>() {
  let resolvePromise!: (value: Value) => void;

  const promise = new Promise<Value>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: resolvePromise,
  };
}

async function findSuiteCard(suiteName: string) {
  const suiteHeading = await screen.findByText(suiteName);
  const suiteCard = suiteHeading.closest('article');

  expect(suiteCard).not.toBeNull();

  return suiteCard!;
}

function expectCreateRunRequest(
  fetchMock: ReturnType<typeof vi.fn>,
  requestIndex: number,
  suiteId: number,
) {
  const requestCall = fetchMock.mock.calls[requestIndex];

  expect(requestCall?.[0]).toBe('/api/runs');
  expect(requestCall?.[1]).toEqual({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      suite_id: suiteId,
    }),
  });
}

beforeEach(() => {
  window.history.pushState({}, '', '/statistics/failures');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('redirects / to /suites', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(createJsonResponse([createSuiteSummaryResponse()]));

  vi.stubGlobal('fetch', fetchMock);

  renderAppAtRoute('/');

  expect(await screen.findByRole('heading', { name: 'Suites' })).toBeVisible();
  expect(window.location.pathname).toBe('/suites');
  expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/suites');
});

test('redirects unknown routes to /suites and loads the suites page', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(createJsonResponse([createSuiteSummaryResponse()]));

  vi.stubGlobal('fetch', fetchMock);

  renderAppAtRoute('/does-not-exist');

  expect(await screen.findByRole('heading', { name: 'Suites' })).toBeVisible();
  expect(await screen.findByText('demo-smoke')).toBeInTheDocument();
  expect(window.location.pathname).toBe('/suites');
  expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/suites');
});

test('shows a loading state while suites load', async () => {
  const fetchMock = vi.fn().mockReturnValue(new Promise<Response>(() => {}));

  vi.stubGlobal('fetch', fetchMock);

  renderAppAtRoute('/suites');

  expect(await screen.findByRole('heading', { name: 'Suites' })).toBeVisible();
  expect(screen.getByText('Loading suites...')).toBeInTheDocument();
  expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/suites');
});

test('renders an empty state when the suites API returns no entries', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createJsonResponse([])));

  renderAppAtRoute('/suites');

  expect(
    await screen.findByText('No runnable suites are configured yet.'),
  ).toBeInTheDocument();
});

test('renders the backend error message when the suites request fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      createJsonResponse(
        {
          error: {
            message: 'Failed to load suites.',
          },
        },
        500,
      ),
    ),
  );

  renderAppAtRoute('/suites');

  expect(await screen.findByText('Failed to load suites.')).toBeInTheDocument();
});

test('renders ready suites cards with suite context fields', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      createJsonResponse([
        createSuiteSummaryResponse(),
        createSuiteSummaryResponse({
          id: 2,
          suite_name: 'checkout-smoke',
          command: 'pnpm run test:checkout',
          sut_base_url: 'http://localhost:4100',
        }),
      ]),
    ),
  );

  renderAppAtRoute('/suites');

  const demoSmokeCard = await findSuiteCard('demo-smoke');
  const checkoutSmokeCard = await findSuiteCard('checkout-smoke');

  expect(
    within(demoSmokeCard).getByText('npm run test:smoke:platform'),
  ).toBeInTheDocument();
  expect(
    within(demoSmokeCard).getByText('http://localhost:3000'),
  ).toBeInTheDocument();
  expect(
    within(checkoutSmokeCard).getByText('pnpm run test:checkout'),
  ).toBeInTheDocument();
  expect(
    within(checkoutSmokeCard).getByText('http://localhost:4100'),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Runs' })).toHaveAttribute(
    'href',
    '/runs',
  );
  expect(
    screen.getByRole('link', { name: 'Failure statistics' }),
  ).toHaveAttribute('href', '/statistics/failures');
});

test('loads runs when the suites navigation link is clicked', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      createJsonResponse([createSuiteSummaryResponse({ suite_name: 'alpha' })]),
    )
    .mockResolvedValueOnce(
      createJsonResponse([
        createRunSummaryResponse({
          id: 44,
          suite_name: 'alpha',
          status: 'running',
          exit_code: null,
          end_time: null,
          duration_ms: null,
        }),
      ]),
    );

  vi.stubGlobal('fetch', fetchMock);

  renderAppAtRoute('/suites');

  const user = userEvent.setup();

  await user.click(await screen.findByRole('link', { name: 'Runs' }));

  expect(
    await screen.findByRole('heading', { name: 'Runs' }),
  ).toBeInTheDocument();
  expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/runs');
});

test('disables only the clicked suite action while create-run is in flight', async () => {
  const createRunRequest = createDeferredPromise<Response>();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      createJsonResponse([
        createSuiteSummaryResponse(),
        createSuiteSummaryResponse({
          id: 2,
          suite_name: 'checkout-smoke',
        }),
      ]),
    )
    .mockReturnValueOnce(createRunRequest.promise);

  vi.stubGlobal('fetch', fetchMock);

  renderAppAtRoute('/suites');

  const user = userEvent.setup();
  const firstSuiteCard = await findSuiteCard('demo-smoke');
  const secondSuiteCard = await findSuiteCard('checkout-smoke');

  const firstButton = within(firstSuiteCard).getByRole('button', {
    name: 'Run suite',
  });
  const secondButton = within(secondSuiteCard).getByRole('button', {
    name: 'Run suite',
  });

  await user.click(firstButton);

  expect(
    within(firstSuiteCard).getByRole('button', { name: 'Running...' }),
  ).toBeDisabled();
  expect(secondButton).toBeEnabled();
  expectCreateRunRequest(fetchMock, 1, 1);

  createRunRequest.resolve(createJsonResponse({ id: 91 }));
  await flushAsyncWork();
});

test('shows success feedback with a run-detail link and stays on /suites', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      createJsonResponse([createSuiteSummaryResponse({ suite_name: 'alpha' })]),
    )
    .mockResolvedValueOnce(createJsonResponse({ id: 91 }));

  vi.stubGlobal('fetch', fetchMock);

  renderAppAtRoute('/suites');

  const user = userEvent.setup();
  const suiteCard = await findSuiteCard('alpha');

  await user.click(
    within(suiteCard).getByRole('button', { name: 'Run suite' }),
  );

  expectCreateRunRequest(fetchMock, 1, 1);
  expect(await screen.findByText(/Run 91 created\./)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open run detail' })).toHaveAttribute(
    'href',
    '/runs/91',
  );
  expect(
    within(suiteCard).getByRole('button', { name: 'Run suite' }),
  ).toBeEnabled();
  expect(window.location.pathname).toBe('/suites');
});

test('shows create-run errors and restores the suite action for retry', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(createJsonResponse([createSuiteSummaryResponse()]))
    .mockResolvedValueOnce(
      createJsonResponse(
        {
          error: {
            message: 'Suite 1 could not be scheduled.',
          },
        },
        500,
      ),
    );

  vi.stubGlobal('fetch', fetchMock);

  renderAppAtRoute('/suites');

  const user = userEvent.setup();
  const suiteCard = await findSuiteCard('demo-smoke');

  await user.click(
    within(suiteCard).getByRole('button', { name: 'Run suite' }),
  );

  expectCreateRunRequest(fetchMock, 1, 1);
  expect(
    await screen.findByText('Suite 1 could not be scheduled.'),
  ).toBeInTheDocument();
  expect(
    within(suiteCard).getByRole('button', { name: 'Run suite' }),
  ).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Running...' })).toBeNull();
});

test('shows a loading state while failure statistics load', async () => {
  const fetchMock = vi.fn().mockReturnValue(new Promise<Response>(() => {}));

  vi.stubGlobal('fetch', fetchMock);

  render(<App />);

  expect(
    await screen.findByRole('heading', { name: 'Failure statistics' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Loading failure statistics...')).toBeInTheDocument();
  expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/statistics/failures');
});

test('renders an empty state when the API returns no failures', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createJsonResponse([])));

  render(<App />);

  expect(
    await screen.findByText('No failed test cases yet.'),
  ).toBeInTheDocument();
});

test('renders the backend error message when the API request fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      createJsonResponse(
        {
          error: {
            message: 'Failed to load failure statistics.',
          },
        },
        500,
      ),
    ),
  );

  render(<App />);

  expect(
    await screen.findByText('Failed to load failure statistics.'),
  ).toBeInTheDocument();
});

test('renders populated failure statistics rows with run links', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      createJsonResponse([
        {
          test_lib_case_code: 'CHECKOUT_SUBMITS_ORDER',
          case_title: 'Submits the checkout order',
          fail_count: 1,
          last_failed_at: '2026-03-20T12:00:00.000Z',
          last_run_id: 18,
        },
        {
          test_lib_case_code: 'AUTH_LOGIN_INVALID_PASSWORD',
          case_title: 'Shows an invalid password error with guidance',
          fail_count: 2,
          last_failed_at: '2026-03-20T12:00:00.000Z',
          last_run_id: 12,
        },
      ]),
    ),
  );

  render(<App />);

  expect(await screen.findByText('CHECKOUT_SUBMITS_ORDER')).toBeInTheDocument();
  expect(
    screen.getByText('Shows an invalid password error with guidance'),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '18' })).toHaveAttribute(
    'href',
    '/runs/18',
  );
  expect(screen.getByRole('link', { name: '12' })).toHaveAttribute(
    'href',
    '/runs/12',
  );
  expect(screen.getByRole('link', { name: 'Suites' })).toHaveAttribute(
    'href',
    '/suites',
  );
  expect(screen.getByRole('link', { name: 'Runs' })).toHaveAttribute(
    'href',
    '/runs',
  );
});

test('shows a loading state while runs load', async () => {
  const fetchMock = vi.fn().mockReturnValue(new Promise<Response>(() => {}));

  vi.stubGlobal('fetch', fetchMock);

  renderAppAtRoute('/runs');

  expect(await screen.findByRole('heading', { name: 'Runs' })).toBeVisible();
  expect(screen.getByText('Loading runs...')).toBeInTheDocument();
  expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/runs');
});

test('renders an empty state when the runs API returns no entries', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createJsonResponse([])));

  renderAppAtRoute('/runs');

  expect(
    await screen.findByText('No runs have been recorded yet.'),
  ).toBeInTheDocument();
});

test('renders the backend error message when the runs request fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      createJsonResponse(
        {
          error: {
            message: 'Failed to load runs.',
          },
        },
        500,
      ),
    ),
  );

  renderAppAtRoute('/runs');

  expect(await screen.findByText('Failed to load runs.')).toBeInTheDocument();
});

test('renders populated runs with operator fields and peer-route navigation', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      createJsonResponse([
        createRunSummaryResponse({
          id: 91,
          status: 'running',
          exit_code: null,
          end_time: null,
          duration_ms: null,
        }),
        createRunSummaryResponse({
          id: 90,
          suite_name: 'checkout-smoke',
          status: 'fail',
          reason: 'cases_failed',
          created_at: '2026-03-20T11:55:00.000Z',
          start_time: '2026-03-20T11:55:02.000Z',
          end_time: '2026-03-20T11:55:07.000Z',
        }),
      ]),
    ),
  );

  renderAppAtRoute('/runs');

  expect(await screen.findByText('checkout-smoke')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '91' })).toHaveAttribute(
    'href',
    '/runs/91',
  );
  expect(screen.getByRole('link', { name: 'Suites' })).toHaveAttribute(
    'href',
    '/suites',
  );
  expect(
    screen.getByRole('link', { name: 'Failure statistics' }),
  ).toHaveAttribute('href', '/statistics/failures');
  expect(screen.getByText('cases_failed')).toBeInTheDocument();
  expect(screen.getByText('None')).toBeInTheDocument();
});

test('does not start polling when the runs list is already fully terminal', async () => {
  const scheduledPollCallbacks: Array<() => void> = [];

  vi.spyOn(window, 'setTimeout').mockImplementation(((
    callback: TimerHandler,
  ) => {
    if (typeof callback === 'function') {
      scheduledPollCallbacks.push(callback as () => void);
    }

    return scheduledPollCallbacks.length;
  }) as typeof window.setTimeout);
  vi.spyOn(window, 'clearTimeout').mockImplementation(
    (() => undefined) as typeof window.clearTimeout,
  );
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      createJsonResponse([
        createRunSummaryResponse(),
        createRunSummaryResponse({
          id: 8,
          status: 'fail',
          reason: 'cases_failed',
        }),
      ]),
    ),
  );

  renderAppAtRoute('/runs');
  await flushAsyncWork();

  expect(screen.getByText('success')).toBeInTheDocument();
  expect(screen.queryByText(runsPollingNotice)).not.toBeInTheDocument();
  expect(scheduledPollCallbacks).toHaveLength(0);
});

test('polls active runs and stops after a terminal list response', async () => {
  const scheduledPollCallbacks: Array<() => void> = [];

  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      createJsonResponse([
        createRunSummaryResponse({
          id: 21,
          status: 'pending',
          exit_code: null,
          start_time: null,
          end_time: null,
          duration_ms: null,
        }),
      ]),
    )
    .mockResolvedValueOnce(
      createJsonResponse([
        createRunSummaryResponse({
          id: 21,
          status: 'running',
          exit_code: null,
          end_time: null,
          duration_ms: null,
        }),
      ]),
    )
    .mockResolvedValueOnce(
      createJsonResponse([
        createRunSummaryResponse({
          id: 21,
          status: 'success',
        }),
      ]),
    );

  vi.spyOn(window, 'setTimeout').mockImplementation(((
    callback: TimerHandler,
  ) => {
    if (typeof callback === 'function') {
      scheduledPollCallbacks.push(callback as () => void);
    }

    return scheduledPollCallbacks.length;
  }) as typeof window.setTimeout);
  vi.spyOn(window, 'clearTimeout').mockImplementation(
    (() => undefined) as typeof window.clearTimeout,
  );
  vi.stubGlobal('fetch', fetchMock);

  renderAppAtRoute('/runs');
  await flushAsyncWork();

  expect(screen.getByText(runsPollingNotice)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(scheduledPollCallbacks).toHaveLength(1);

  const firstPollCallback = scheduledPollCallbacks.shift();
  firstPollCallback?.();
  await flushAsyncWork();

  expect(screen.getByText('running')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(scheduledPollCallbacks).toHaveLength(1);

  const secondPollCallback = scheduledPollCallbacks.shift();
  secondPollCallback?.();
  await flushAsyncWork();

  expect(screen.getByText('success')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(screen.queryByText(runsPollingNotice)).not.toBeInTheDocument();
  expect(scheduledPollCallbacks).toHaveLength(0);
});

test('keeps polling after a transient runs-list failure and preserves the ready state', async () => {
  const scheduledPollCallbacks: Array<() => void> = [];

  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      createJsonResponse([
        createRunSummaryResponse({
          id: 33,
          status: 'running',
          exit_code: null,
          end_time: null,
          duration_ms: null,
        }),
      ]),
    )
    .mockResolvedValueOnce(
      createJsonResponse(
        {
          error: {
            message: 'Temporary upstream failure.',
          },
        },
        500,
      ),
    )
    .mockResolvedValueOnce(
      createJsonResponse([
        createRunSummaryResponse({
          id: 33,
          status: 'success',
        }),
      ]),
    );

  vi.spyOn(window, 'setTimeout').mockImplementation(((
    callback: TimerHandler,
  ) => {
    if (typeof callback === 'function') {
      scheduledPollCallbacks.push(callback as () => void);
    }

    return scheduledPollCallbacks.length;
  }) as typeof window.setTimeout);
  vi.spyOn(window, 'clearTimeout').mockImplementation(
    (() => undefined) as typeof window.clearTimeout,
  );
  vi.stubGlobal('fetch', fetchMock);

  renderAppAtRoute('/runs');
  await flushAsyncWork();

  expect(screen.getByText('running')).toBeInTheDocument();
  expect(scheduledPollCallbacks).toHaveLength(1);

  const firstPollCallback = scheduledPollCallbacks.shift();
  firstPollCallback?.();
  await flushAsyncWork();

  expect(screen.getByText('running')).toBeInTheDocument();
  expect(
    screen.queryByText('Temporary upstream failure.'),
  ).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(scheduledPollCallbacks).toHaveLength(1);

  const secondPollCallback = scheduledPollCallbacks.shift();
  secondPollCallback?.();
  await flushAsyncWork();

  expect(screen.getByText('success')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(screen.queryByText(runsPollingNotice)).not.toBeInTheDocument();
});

test('loads a real run detail page when a run link is clicked', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse([
          {
            test_lib_case_code: 'AUTH_LOGIN_INVALID_PASSWORD',
            case_title: 'Shows an invalid password error with guidance',
            fail_count: 2,
            last_failed_at: '2026-03-20T12:00:00.000Z',
            last_run_id: 12,
          },
        ]),
      )
      .mockResolvedValueOnce(createJsonResponse(createRunDetailResponse())),
  );

  render(<App />);

  const user = userEvent.setup();

  await user.click(await screen.findByRole('link', { name: '12' }));

  expect(
    await screen.findByRole('heading', { name: 'Run 12' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Overview')).toBeInTheDocument();
  expect(
    screen.queryByText('Run details are not implemented yet.'),
  ).not.toBeInTheDocument();
});

test('shows a loading state while run detail loads', async () => {
  const fetchMock = vi.fn().mockReturnValue(new Promise<Response>(() => {}));

  vi.stubGlobal('fetch', fetchMock);

  renderAppAtRoute('/runs/12');

  expect(
    await screen.findByRole('heading', { name: 'Run 12' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Loading run detail...')).toBeInTheDocument();
  expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/runs/12');
});

test('does not flash the previous run detail while switching between run routes', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      createJsonResponse(
        createRunDetailResponse({
          id: 12,
          suite_name: 'suite-12',
          command: 'command-12',
        }),
      ),
    )
    .mockReturnValueOnce(new Promise<Response>(() => {}));

  vi.stubGlobal('fetch', fetchMock);

  renderAppAtRoute('/runs/12');

  expect(await screen.findByText('suite-12')).toBeInTheDocument();

  await navigateToRoute('/runs/18');

  expect(
    await screen.findByRole('heading', { name: 'Run 18' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Loading run detail...')).toBeInTheDocument();
  expect(screen.queryByText('suite-12')).not.toBeInTheDocument();
  expect(screen.queryByText('command-12')).not.toBeInTheDocument();
  expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/runs/18');
});

test('renders a not-found state when the run detail API returns 404', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      createJsonResponse(
        {
          error: {
            message: 'Run 12 was not found.',
          },
        },
        404,
      ),
    ),
  );

  renderAppAtRoute('/runs/12');

  expect(await screen.findByText('Run 12 was not found.')).toBeInTheDocument();
});

test('renders the backend error message when the run detail request fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      createJsonResponse(
        {
          error: {
            message: 'Failed to load run detail.',
          },
        },
        500,
      ),
    ),
  );

  renderAppAtRoute('/runs/12');

  expect(
    await screen.findByText('Failed to load run detail.'),
  ).toBeInTheDocument();
});

test('renders artifact availability and summary-unavailable copy for runs without parsed case results', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      createJsonResponse(
        createRunDetailResponse({
          status: 'fail',
          reason: 'probe_failed',
          exit_code: null,
          start_time: null,
          end_time: null,
          duration_ms: null,
          artifacts: {
            stdout_log: false,
            stderr_log: false,
            results_json: false,
            report_dir: false,
          },
          result_summary: null,
        }),
      ),
    ),
  );

  renderAppAtRoute('/runs/12');

  expect(
    await screen.findByText(
      'Structured case summary is not available for this run.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Availability only in this slice. Logs, report access, and downloads stay out of scope here.',
    ),
  ).toBeInTheDocument();
  expect(screen.getAllByText('Not available')).toHaveLength(4);
  expect(screen.getAllByText('Not recorded for this run.')).toHaveLength(4);
});

test('treats a missing result_summary field as summary unavailable', async () => {
  const { result_summary: ignoredResultSummary, ...legacyRunDetailResponse } =
    createRunDetailResponse({
      status: 'success',
    });

  void ignoredResultSummary;

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(createJsonResponse(legacyRunDetailResponse)),
  );

  renderAppAtRoute('/runs/12');

  expect(
    await screen.findByText(
      'Structured case summary is not available for this run.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByText('Overview')).toBeInTheDocument();
});

test('polls pending and running runs, then stops after a terminal response', async () => {
  const scheduledPollCallbacks: Array<() => void> = [];

  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      createJsonResponse(
        createRunDetailResponse({
          status: 'pending',
          exit_code: null,
          start_time: null,
          end_time: null,
          duration_ms: null,
          result_summary: null,
        }),
      ),
    )
    .mockResolvedValueOnce(
      createJsonResponse(
        createRunDetailResponse({
          status: 'running',
          exit_code: null,
          end_time: null,
          duration_ms: null,
        }),
      ),
    )
    .mockResolvedValueOnce(
      createJsonResponse(
        createRunDetailResponse({
          status: 'success',
        }),
      ),
    );

  vi.spyOn(window, 'setTimeout').mockImplementation(((
    callback: TimerHandler,
  ) => {
    if (typeof callback === 'function') {
      scheduledPollCallbacks.push(callback as () => void);
    }

    return scheduledPollCallbacks.length;
  }) as typeof window.setTimeout);
  vi.spyOn(window, 'clearTimeout').mockImplementation(
    (() => undefined) as typeof window.clearTimeout,
  );
  vi.stubGlobal('fetch', fetchMock);

  renderAppAtRoute('/runs/12');
  await flushAsyncWork();

  expect(screen.getByText(runDetailPollingNotice)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(scheduledPollCallbacks).toHaveLength(1);

  const firstPollCallback = scheduledPollCallbacks.shift();
  firstPollCallback?.();
  await flushAsyncWork();

  expect(screen.getByText('running')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(scheduledPollCallbacks).toHaveLength(1);

  const secondPollCallback = scheduledPollCallbacks.shift();
  secondPollCallback?.();
  await flushAsyncWork();

  expect(screen.getByText('success')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(screen.queryByText(runDetailPollingNotice)).not.toBeInTheDocument();
  expect(scheduledPollCallbacks).toHaveLength(0);
});

test('keeps polling after a transient active-run failure and eventually shows the terminal state', async () => {
  const scheduledPollCallbacks: Array<() => void> = [];

  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      createJsonResponse(
        createRunDetailResponse({
          status: 'running',
          exit_code: null,
          end_time: null,
          duration_ms: null,
          result_summary: null,
        }),
      ),
    )
    .mockResolvedValueOnce(
      createJsonResponse(
        {
          error: {
            message: 'Temporary upstream failure.',
          },
        },
        500,
      ),
    )
    .mockResolvedValueOnce(
      createJsonResponse(
        createRunDetailResponse({
          status: 'success',
        }),
      ),
    );

  vi.spyOn(window, 'setTimeout').mockImplementation(((
    callback: TimerHandler,
  ) => {
    if (typeof callback === 'function') {
      scheduledPollCallbacks.push(callback as () => void);
    }

    return scheduledPollCallbacks.length;
  }) as typeof window.setTimeout);
  vi.spyOn(window, 'clearTimeout').mockImplementation(
    (() => undefined) as typeof window.clearTimeout,
  );
  vi.stubGlobal('fetch', fetchMock);

  renderAppAtRoute('/runs/12');
  await flushAsyncWork();

  expect(screen.getByText('running')).toBeInTheDocument();
  expect(scheduledPollCallbacks).toHaveLength(1);

  const firstPollCallback = scheduledPollCallbacks.shift();
  firstPollCallback?.();
  await flushAsyncWork();

  expect(screen.getByText('running')).toBeInTheDocument();
  expect(
    screen.queryByText('Temporary upstream failure.'),
  ).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(scheduledPollCallbacks).toHaveLength(1);

  const secondPollCallback = scheduledPollCallbacks.shift();
  secondPollCallback?.();
  await flushAsyncWork();

  expect(screen.getByText('success')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(screen.queryByText(runDetailPollingNotice)).not.toBeInTheDocument();
});

test('ignores an outdated 404 response when the route changes before the body resolves', async () => {
  const delayedNotFoundBody = createDeferredPromise<{
    error: {
      message: string;
    };
  }>();
  const consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);

  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: vi.fn().mockImplementation(() => delayedNotFoundBody.promise),
      } as unknown as Response)
      .mockResolvedValueOnce(
        createJsonResponse(
          createRunDetailResponse({
            id: 18,
            suite_name: 'suite-18',
            command: 'command-18',
          }),
        ),
      ),
  );

  renderAppAtRoute('/runs/12');
  await flushAsyncWork();

  await navigateToRoute('/runs/18');
  await flushAsyncWork();

  expect(await screen.findByText('suite-18')).toBeInTheDocument();

  delayedNotFoundBody.resolve({
    error: {
      message: 'Run 12 was not found.',
    },
  });
  await flushAsyncWork();

  expect(screen.getByText('suite-18')).toBeInTheDocument();
  expect(screen.queryByText('Run 12 was not found.')).not.toBeInTheDocument();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
});
