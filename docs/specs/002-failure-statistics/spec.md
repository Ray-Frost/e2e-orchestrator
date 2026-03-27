# Failure Statistics

Companion docs: [`plan.md`](./plan.md), [`tasks.md`](./tasks.md)

## Purpose

- Define the scope and behavior of the `Failure statistics` feature.
- Lock the backend failures API contract and the frontend failures page
  behavior for this slice.
- Lock the aggregation contract, routing contract, and validation
  expectations.

## Why This Feature Exists Now

- Failure statistics gives operators a direct view of which test cases are
  failing repeatedly and which run failed most recently for each case code.
- This slice provides useful read-only visibility before run detail pages or
  run-control flows are complete because it derives from existing
  `case_results`.
- This is a low-coupling first statistics feature: it can be implemented
  without schema changes, caching, charts, filters, pagination, or broader
  run-management work.

## Scope

- Backend `GET /api/statistics/failures`.
- Frontend `/statistics/failures` page.
- Root redirect from `/` to `/statistics/failures`.
- Placeholder `/runs/:id` route so `last_run_id` links remain valid before run
  detail fetching is implemented.
- Deterministic aggregation over failed `case_results` rows using the locked
  ordering and tie-break rules.
- Error handling that preserves the existing `{ "error": { "message":
"string" } }` shape.

## Out of Scope

- Schema changes.
- Migrations.
- Results ingest.
- Run detail implementation.
- Caching.
- Charts.
- Filters.
- Pagination.
- Broader run-management flow.
- Backend CORS in this slice.

## Inherited Constraints

- Use the global Nest `/api` prefix.
- Use relative `/api/...` requests from the frontend.
- Use a Vite `/api` proxy to the server port for local dev and preview.
- Use `react-router` with `BrowserRouter`, `Routes`, and `Route`.
- Add only a minimal shared Prisma service on the backend.
- Do aggregation in application code after a deterministic ordered read.
- Keep `case_results` as the source of truth for failure statistics.
- Keep `test_lib_case_code` as the grouping key.
- Keep `case_title`, `last_failed_at`, and `last_run_id` sourced from the same
  latest tie-broken failed row in each group.
- Keep the response recency-first; use `test_lib_case_code` only as the
  tertiary response tie-breaker when `last_failed_at` and `last_run_id` tie.
  Treat `test_lib_case_code ASC` as locale-independent plain string order.

## Backend Behavior

- Endpoint: `GET /api/statistics/failures`.
- Response fields for each row:
  - `test_lib_case_code`
  - `case_title`
  - `fail_count`
  - `last_failed_at`
  - `last_run_id`
- Source rows come from failed `case_results`.
- Read ordering is deterministic: `failed_at DESC, run_id DESC, id DESC`.
- Grouping key is `test_lib_case_code`.
- `fail_count` is the number of failed rows in the group.
- `case_title`, `last_failed_at`, and `last_run_id` come from the same latest
  tie-broken failed row selected by that read order.
- Response order is deterministic and surfaces the most recent failed groups
  first: `last_failed_at DESC`, then `last_run_id DESC`, then
  `test_lib_case_code ASC` using locale-independent plain string comparison.

## Frontend Behavior

- The app opens at `/`, then redirects to `/statistics/failures`.
- The failures page loads statistics from the backend using the local `/api`
  proxy in local dev and preview.
- The page shows loading, empty, error, and populated states.
- Each populated row links `last_run_id` to `/runs/:id`.
- The `/runs/:id` route only needs to exist as a placeholder in this slice.

## Acceptance Criteria

- `GET /api/statistics/failures` returns the locked fields with the locked
  error shape.
- The backend aggregates failed `case_results` deterministically by
  `test_lib_case_code`.
- Rows from the same code use the latest tie-broken failed row for title and
  timestamps, with raw-row ties resolved by `id DESC`.
- The response order is newest failure group first, using `last_failed_at DESC`
  then `last_run_id DESC`, then `test_lib_case_code ASC` as the locked plain
  string sort.
- The frontend redirects `/` to `/statistics/failures`.
- The frontend renders `/statistics/failures` with the expected loading,
  empty, error, and populated states.
- `last_run_id` links resolve through a placeholder `/runs/:id` route.
- The implementation does not add schema changes, migrations, caching,
  charts, filters, pagination, or broader run-management behavior.

## Open Questions

- None for this feature slice.
