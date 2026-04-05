# Suites Page

Companion docs: [`plan.md`](./plan.md), [`tasks.md`](./tasks.md)

## Purpose

- Define the scope and behavior of the first real `Suites Page` feature.
- Lock the primary run-entry route and page behavior for this slice.
- Lock the minimal suites API expansion needed so the page can show runnable
  suite context without inventing a second bootstrap endpoint.

## Why This Feature Exists Now

- The frontend already has read-only visibility through failure statistics and
  run detail, but it still lacks a first-class page for discovering runnable
  suites and starting a run.
- The backend already exposes suite lookup and run creation, so this slice
  closes a navigation and workflow gap instead of inventing a new runtime
  capability.
- A dedicated suites page creates a stable home for future multi-suite and
  case-level execution work without requiring this slice to redesign the
  current backend suite model first.

## Scope

- Frontend `/suites` page.
- Root redirect from `/` to `/suites`.
- Secondary navigation from the suites page to `/statistics/failures`.
- Existing backend `GET /api/suites` plus the backward-compatible contract
  additions this page needs.
- Existing backend `POST /api/runs` reused as the `Run suite` action.
- Loading, empty, error, and ready states for the page.
- One-time create-run success and failure feedback that keeps the user on the
  suites page.
- Multi-suite-ready list or card presentation even when current backend data
  often contains only one suite.

## Out of Scope

- Backend suite-model redesign or suite-management workflows.
- Suite-write endpoints, suite CRUD flows, or a second suites-page bootstrap
  endpoint.
- Recent-runs summary, `/runs` list page, queue dashboard, or broader
  run-management UX.
- Active-run polling or a persistent in-page run-status block.
- Automatic navigation to `/runs/:id` after successful create-run.
- Case-level execution entrypoints such as `run test case`.
- Cancel, restart, logs, report, or artifact-access controls from the suites
  page.
- Failure-statistics redesign beyond preserving a reachable route from the new
  homepage.

## Inherited Constraints

- Use the global Nest `/api` prefix.
- Use relative `/api/...` requests from the frontend.
- Use `react-router` with `BrowserRouter`, `Routes`, and `Route`.
- Preserve the uniform error body `{ "error": { "message": "string" } }`.
- Preserve the existing run-creation semantics, queue behavior, and run-detail
  route already defined by the platform.
- Keep API and JSON field names in `snake_case`.
- Keep the page future-friendly for multiple suites without requiring this
  slice to remove the current single-seeded-suite backend implementation.

## Backend Behavior

- Endpoint remains `GET /api/suites`.
- The response remains list-shaped and returns one object per runnable suite.
- Each returned suite object includes:
  - `id`
  - `suite_name`
  - `command`
  - `sut_base_url`

## Frontend Behavior

- The app opens at `/`, then redirects to `/suites`.
- The suites page loads suite data from the backend using the local `/api`
  proxy in local dev and preview.
- The page shows loading, empty, error, and populated states.
- The populated page renders suite entries as a list or set of cards rather
  than as a single hard-coded singleton view.
- Each suite entry shows:
  - `suite_name`
  - `command`
  - `sut_base_url`
  - a `Run suite` action
- When a user clicks `Run suite`, only that suite action becomes temporarily
  disabled until the create-run request resolves.
- On successful run creation, the page stays on `/suites` and shows one-time
  success feedback with the created run `id` and a link to `/runs/:id`.
- On failed run creation, the page stays on `/suites`, surfaces the backend
  error, and re-enables the action so the user can retry.
- The page includes a clear but secondary navigation path to
  `/statistics/failures`.

## Acceptance Criteria

- Navigating to `/` lands on a real suites page instead of failure statistics.
- `/statistics/failures` remains reachable from the new primary entry surface.
- `GET /api/suites` provides the locked fields needed by this page without
  requiring a new bootstrap endpoint.
- The page renders suite entries correctly for both one-suite and multi-suite
  response shapes.
- `Run suite` disables only the clicked action while the request is in flight.
- Successful run creation shows visible confirmation plus a direct link to the
  created run detail page while keeping the user on `/suites`.
- Failed run creation shows an explicit error and restores the action so the
  user can retry.

## Open Questions

- None for this feature slice.
