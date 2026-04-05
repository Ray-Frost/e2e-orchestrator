# Run Cancel

Companion docs: [`plan.md`](./plan.md), [`tasks.md`](./tasks.md)

## Purpose

- Define the scope and behavior of the `Run cancel` feature.
- Lock the backend cancel contract and the operator-facing cancel entrypoints
  for active runs.
- Keep restart, bulk-control, and recovery work out of scope for this slice.

## Why This Feature Exists Now

- The database schema and current frontend/backend status types already include
  `cancelled`, but the platform still lacks a documented cancel flow.
- `IMPLEMENTATION_GUIDE.md` still holds the cancel behavior as an undecomposed
  note, so moving it here reduces overlap with the run-loop and page specs.
- `/runs` and `/runs/:id` are now the stable operator surfaces for observing
  runs, so this slice can add cancel entrypoints without reopening route scope
  or inventing a new control surface.

## Scope

- Backend `POST /api/runs/{id}/cancel`.
- Cancellation semantics for `pending` and `running` runs in the current FIFO
  single-run scheduler.
- Frontend cancel entrypoints on `/runs` and `/runs/:id`.
- Local success and failure feedback for the cancel action.
- Existing `GET /api/runs` and `GET /api/runs/{id}` reflecting cancelled runs
  through their existing status, reason, and timing fields.

## Out of Scope

- Cancel entrypoints on `/suites`.
- Restart, retry, rerun, or any other run-control action.
- Bulk cancel or queue-wide controls.
- Logs, report access, or artifact download behavior.
- New run statuses, a `cancelling` intermediate state, or recovery rules across
  platform restarts.
- Prisma schema changes or migration assets.

## Inherited Constraints

- Use the global Nest `/api` prefix.
- Use relative `/api/...` requests from the frontend.
- Preserve the uniform error body `{ "error": { "message": "string" } }`.
- Keep API and JSON field names in `snake_case`.
- Keep the database authoritative for status, reason, timing, and run
  identity.
- Preserve the locked timing semantics for `created_at`, `start_time`,
  `end_time`, and `duration_ms`.
- Keep the scheduler concurrency fixed at `1` with FIFO queueing.
- Preserve the `001-run-artifact-persistence` rule that runs which never leave
  `pending` do not need an artifact directory.

## Backend Behavior

- The cancel endpoint is `POST /api/runs/{id}/cancel`.
- The `id` path param must remain a positive integer and keeps the existing
  `400` error shape for invalid path input.
- The request body is action-empty in this slice:
  - clients must not send a custom `reason`;
  - the server must reject non-empty request payloads with `400`;
  - the server owns the persisted cancel reason.
- If the target run does not exist, the endpoint returns `404`.
- If the target run is already terminal, including an already-cancelled run,
  the endpoint returns `400` with a readable message and no structured
  `status/reason` fragment in `error.message`.
- On a successful cancel, the persisted terminal result is:
  - `status=cancelled`
  - `reason=user_cancelled`
  - `exit_code=null`
- If the run is still `pending` when cancellation succeeds:
  - `start_time` remains `null`;
  - `end_time` is written when the cancel takes effect;
  - `duration_ms` remains `null`;
  - the run must not later execute from the queue;
  - the implementation does not create an artifact directory just to represent
    this cancellation.
- If the run is `running` when cancellation succeeds:
  - the platform stops the runner process for that run, including child
    processes started under it;
  - `end_time` is written when terminal cancellation is finalized;
  - `duration_ms` is derived only if `start_time` already exists.
- A successful cancel response returns the updated run summary using the
  existing run-summary field set instead of inventing a new cancel response
  shape.
- The feature does not add a second detail endpoint, a queue endpoint, or a
  separate cancel-status polling endpoint.

## Frontend Behavior

- `/runs` shows a cancel entrypoint only for rows whose current status is
  `pending` or `running`.
- `/runs/:id` shows a cancel entrypoint only when the loaded run is `pending`
  or `running`.
- `/suites` remains creation-focused in this slice and does not expose cancel
  controls.
- The frontend uses a native browser confirmation step before sending the
  cancel request.
- While the cancel request is in flight, the page disables the relevant cancel
  control to avoid duplicate submissions.
- On success, the page refreshes its current run data immediately rather than
  waiting for the next automatic polling tick.
- A cancel failure after the page already has run data keeps the existing page
  content visible and adds local error feedback for the action instead of
  replacing the entire page with a blocking error state.
- Once the refreshed data becomes terminal, the existing polling rules for
  `/runs` and `/runs/:id` continue to stop automatically without adding new
  polling logic just for cancel.

## Acceptance Criteria

- `POST /api/runs/{id}/cancel` cancels `pending` and `running` runs without
  accepting client-defined reason fields.
- Successful cancellation persists `cancelled / user_cancelled` and keeps the
  locked timing semantics intact.
- Pending cancellation prevents the run from later executing and does not force
  creation of an artifact directory.
- Running cancellation stops the active runner and its child processes, then
  resolves to one terminal state without exposing a `cancelling` intermediate
  status.
- Terminal runs reject repeated cancellation with `400`.
- `/runs` and `/runs/:id` expose cancel controls only for active runs.
- The frontend uses native confirmation, disables in-flight controls, refreshes
  current data after success, and preserves page content on action failure.
- The feature does not add `/suites` controls, restart behavior, bulk actions,
  schema changes, or new artifact APIs.

## Open Questions

- None for this feature slice.
