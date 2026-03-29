import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from './app';

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

beforeEach(() => {
  window.history.pushState({}, '', '/statistics/failures');
});

afterEach(() => {
  vi.unstubAllGlobals();
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
});

test('navigates to the placeholder run route when a run link is clicked', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      createJsonResponse([
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

  const user = userEvent.setup();

  await user.click(await screen.findByRole('link', { name: '12' }));

  expect(
    await screen.findByRole('heading', { name: 'Run 12' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Run details are not implemented yet.'),
  ).toBeInTheDocument();
});
