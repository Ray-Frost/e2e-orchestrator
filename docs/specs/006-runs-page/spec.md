# Runs Page

Companion docs: [`plan.md`](./plan.md), [`tasks.md`](./tasks.md)

## Purpose

- Define the scope and behavior of the `Runs Page` feature.
- Lock the read-only `/runs` operator page and its list-driven observation
  workflow.
- Keep filters, controls, and queue-dashboard behavior out of scope for this
  slice.

## Why This Feature Exists Now

- The backend already exposes `GET /api/runs`, but the frontend still has no
  first-class page for reviewing recently created runs.
- The suites page can create a run and the run-detail page can inspect one run,
  but operators still lack a stable page for scanning run history and spotting
  active work without relying on deep links.
- This slice closes an existing navigation and observation gap without
  introducing new runtime behavior or reopening the current runs API contract.

## Scope

- Frontend `/runs` page.
- Primary navigation among `/runs`, `/suites`, and
  `/statistics/failures`.
- Existing backend `GET /api/runs` reused as the page's only data source.
- Loading, empty, error, and ready states for the route.
- Read-only run summaries with links to `/runs/:id`.
- Low-concurrency automatic polling while the current page data still contains
  at least one `pending` or `running` run.
- Dense operator-facing rendering of the existing run summary fields:
  - `id`
  - `suite_name`
  - `status`
  - `reason`
  - `created_at`
  - `start_time`
  - `end_time`
  - `duration_ms`

## Out of Scope

- Backend runs-list endpoint redesign.
- New query parameters, filters, sorting controls, pagination, or search.
- Root-route changes away from `/suites`.
- Queue dashboards, charts, or aggregate operator metrics beyond the existing
  list.
- Inline run creation on the runs page.
- Cancel, restart, or any other run-control action.
- Inline logs, report access, artifact access, or result-summary rendering on
  the list page.
- Per-run polling or any other polling strategy that fans out into one request
  per active run.

## Inherited Constraints

- Use the global Nest `/api` prefix.
- Use relative `/api/...` requests from the frontend.
- Use `react-router` with `BrowserRouter`, `Routes`, and `Route`.
- Preserve the uniform error body `{ "error": { "message": "string" } }`.
- Preserve the locked run status, reason, and timing semantics already defined
  by the platform.
- Keep API and JSON field names in `snake_case`.
- Keep `GET /api/runs` as a newest-first list of run summaries.
- Keep `/suites` as the root-route destination for `/`.
- Keep `/runs/:id` as the detail page for richer inspection instead of growing
  the list page into a second detail surface.

## Backend Behavior

- Endpoint remains `GET /api/runs`.
- Existing response fields and error semantics remain stable.
- The response remains a newest-first list of run summaries.
- This slice does not add query parameters, result-summary fields, artifact
  fields, or execution-context fields to the list endpoint.

## Frontend Behavior

- The `/runs` route is reachable as a peer operator page alongside `/suites`
  and `/statistics/failures`.
- The runs page loads data from the backend using the local `/api` proxy in
  local dev and preview.
- The page shows loading, empty, error, and populated states.
- The populated page renders a dense, scan-friendly list of run summaries with
  explicit labels for the locked operator fields.
- Each run entry links to `/runs/:id` for full detail.
- When the current list contains at least one `pending` or `running` run, the
  page automatically polls every 2 seconds.
- Automatic polling uses a single page-level request loop, not one request per
  active run.
- Automatic polling stops after the list reaches an all-terminal state.
- If a polling request fails after the page already has active-run data, the
  page keeps the last ready list visible and retries on the next interval
  instead of dropping into a blocking error state.
- If the initial load fails before any list data is available, the page shows
  the error state.

## Acceptance Criteria

- Navigating to `/runs` shows a real runs page instead of falling back to a
  different route.
- `/runs`, `/suites`, and `/statistics/failures` are directly reachable as
  peer operator pages.
- `GET /api/runs` remains the page's only data source and keeps its existing
  contract.
- The page renders the expected loading, empty, error, and ready states.
- The ready state surfaces the locked run-summary fields and links each entry
  to `/runs/:id`.
- The page starts automatic polling only when the current list includes an
  active run.
- Automatic polling uses a single in-flight request at a time and stops when
  the list becomes fully terminal.
- A transient polling failure does not discard the last ready list while
  active runs are still present.
- The feature does not add filters, pagination, queue dashboards, or run
  control actions.

## Open Questions

- None for this feature slice.
