# Run Detail Page

Companion docs: [`plan.md`](./plan.md), [`tasks.md`](./tasks.md)

## Purpose

- Define the scope and behavior of the first real `Run detail page` feature.
- Lock the frontend `/runs/:id` page behavior and the summary-only run-detail
  contract additions needed for this slice.
- Keep logs streaming, report access, and run-control actions out of scope for
  this feature.

## Why This Feature Exists Now

- The current frontend route `/runs/:id` is still only a placeholder even
  though the backend already exposes `GET /api/runs/{id}`.
- Failure statistics already link operators into individual runs, so a real
  detail page now closes an existing navigation gap instead of inventing a new
  product surface.
- This slice builds directly on existing run detail, artifact presence, and
  `case_results` data without requiring logs API finalization or a full
  per-case results browser.

## Scope

- Frontend `/runs/:id` page.
- Existing backend `GET /api/runs/{id}` plus a backward-compatible
  summary-only result extension for this page.
- Loading, not-found, generic-error, and ready states for the route.
- Polling of the run-detail endpoint while a run is `pending` or `running`.
- Observation-first sections for:
  - run overview and terminal metadata;
  - timing information;
  - execution context;
  - artifact availability;
  - summary-only case-result information.

## Out of Scope

- Inline stdout or stderr log viewing.
- Logs API contract finalization.
- Report serving, report proxying, or report navigation.
- Cancel, restart, or any other run-control action.
- Artifact download or raw artifact file access.
- Full per-case results tables, filtering, sorting, or pagination.
- `/runs` list-page redesign or broader run-management UX.

## Inherited Constraints

- Use the global Nest `/api` prefix.
- Use relative `/api/...` requests from the frontend.
- Use `react-router` with `BrowserRouter`, `Routes`, and `Route`.
- Preserve the uniform error body `{ "error": { "message": "string" } }`.
- Preserve the locked run status, reason, and timing semantics already defined
  by the platform.
- Keep API and JSON field names in `snake_case`.
- Keep `artifacts` as availability metadata only in this slice. Later features
  may add logs, report, or artifact-access entrypoints, but this feature does
  not define those interaction contracts.
- Keep `case_results` as the source of truth for any summary-only result data
  added by this feature.

## Backend Behavior

- Endpoint remains `GET /api/runs/{id}`.
- Existing response fields and error semantics remain stable.
- The response adds `result_summary` for summary-only parsed case-result data.
- `result_summary` is either:
  - `null` when the run has no persisted `case_results`; or
  - an object with:
    - `total_count`
    - `passed_count`
    - `failed_count`
    - `skipped_count`
- `result_summary` is derived only from `case_results` rows belonging to the
  requested run.
- The endpoint does not add logs payloads, report payloads, or artifact URLs in
  this slice.

## Frontend Behavior

- The `/runs/:id` route loads run detail from the backend using the local `/api`
  proxy in local dev and preview.
- The page shows loading, not-found, generic-error, and populated states.
- The page presents the run as an observation-first detail view, not as a
  control panel.
- When the run is `pending` or `running`, the page polls the run-detail
  endpoint until the run reaches a terminal state, then stops polling.
- The page renders:
  - overview fields for run identity and lifecycle state;
  - timing fields that handle unavailable values explicitly;
  - execution context snapshot fields;
  - a non-interactive `Artifacts` section that communicates artifact
    availability only;
  - a summary-only result section that stays at aggregate count level.
- The `Artifacts` section is intentionally a present-tense availability view for
  this slice, not a long-term ban on future logs/report/artifact entrypoints.
- When `result_summary` is `null`, the result section communicates that a
  structured summary is not available for the run.

## Acceptance Criteria

- Navigating to `/runs/:id` shows a real run detail page instead of the current
  placeholder route.
- `GET /api/runs/{id}` preserves its existing fields and adds the locked
  `result_summary` contract without breaking existing consumers.
- Runs with persisted `case_results` return the expected summary counts.
- Runs without persisted `case_results` return `result_summary: null`.
- The frontend page renders the expected loading, not-found, generic-error, and
  ready states.
- `pending` and `running` runs are polled automatically and stop polling after
  terminalization.
- The page shows artifact availability and summary-only result information
  without introducing logs viewing, report navigation, artifact download, or a
  full case-results browser.
- The page leaves room for later logs/report/artifact-access features without
  pre-committing to those interaction details in this slice.

## Open Questions

- None for this feature slice.
