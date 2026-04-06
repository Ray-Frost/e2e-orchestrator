# Run Stdout Access

Companion docs: [`plan.md`](./plan.md), [`tasks.md`](./tasks.md)

## Purpose

- Define the scope and behavior of the minimal operator-facing stdout-access
  slice for completed or active runs.
- Lock backend raw stdout access without reopening the unfinished full logs API
  design.
- Keep stderr, report access, streaming, and generic artifact browsing out of
  scope for this slice.

## Why This Feature Exists Now

- The current run-detail page already exposes artifact availability, but the
  operator still cannot inspect raw stdout from the platform UI.
- The runtime already writes `stdout.log`, so this slice can expose an existing
  artifact instead of inventing a new artifact generation path.
- Time is constrained, so a small stdout-only slice is a better fit than
  finalizing the previously planned cursor-based logs API.

## Scope

- Backend raw stdout access at `GET /api/runs/{id}/stdout`.
- Missing-artifact semantics for the stdout access path above.
- Frontend entrypoints on `/runs/:id` for reading stdout.
- Minimal run-detail UI changes needed to keep stdout access operator-usable.

## Out of Scope

- `stderr` access.
- Cursor-based logs API design, `tail`, pagination, or streaming updates.
- Report serving or report navigation.
- Generic artifact download endpoints or directory browsing.
- A new top-level stdout page outside `/runs/:id`.
- Changes to artifact generation, artifact naming, or run-result semantics.
- Prisma schema changes or migration assets.

## Inherited Constraints

- Use the global Nest `/api` prefix.
- Use relative `/api/...` requests from the frontend.
- Preserve the deterministic artifact layout from
  [`001-run-artifact-persistence`](../001-run-artifact-persistence/spec.md),
  including `stdout.log`.
- Keep the database authoritative for run identity and terminal state. Artifact
  files remain filesystem-backed runtime outputs.
- Preserve the uniform JSON error body
  `{ "error": { "message": "string" } }` for non-success API responses that
  return JSON.
- Keep API and JSON field names in `snake_case`.
- Keep the implementation single-machine and low-dependency.

## Backend Behavior

- `GET /api/runs/{id}/stdout` returns the full contents of `stdout.log` as
  `text/plain; charset=utf-8`.
- The stdout endpoint does not support query params, cursors, tailing, or
  partial reads in this slice.
- If the target run does not exist, the stdout endpoint returns `404`.
- If the run exists but `stdout.log` is missing, the stdout endpoint returns
  `404` with a readable message that the artifact was not generated or is no
  longer present.
- If `stdout.log` exists and is empty, the stdout endpoint returns `200` with
  an empty text body.
- The feature does not add `stderr`, a generic `/artifacts/*` endpoint, or a
  second run-detail payload just for stdout access.

## Frontend Behavior

- `/runs/:id` remains the operator entrypoint for stdout access in this slice.
- The existing `Artifacts` section remains the current availability view; this
  slice adds stdout access without reopening report behavior.
- When the stdout artifact is available, the page exposes a `View stdout`
  entrypoint that loads raw stdout from `/api/runs/{id}/stdout`.
- The stdout view is read-only and displays the raw text in a preformatted
  block without filtering, searching, or live tailing.
- The page does not expose stderr or report access in this slice.
- If stdout loading fails after the page already has run detail data, the page
  keeps the current run detail visible and renders local artifact-access error
  feedback instead of replacing the whole route with a blocking error state.
- Missing stdout should read to the operator as "not generated" or "already
  cleaned up", not as a malformed run state.

## Acceptance Criteria

- Operators can read raw stdout for a run from `/runs/:id` when `stdout.log`
  exists.
- `GET /api/runs/{id}/stdout` returns the full stdout text and avoids cursor,
  tail, or streaming behavior.
- Missing run ids and missing artifacts return `404` with readable semantics.
- The frontend keeps run-detail data visible when stdout loading fails locally.
- The feature does not add stderr access, report access, a full logs
  subsystem, generic artifact download APIs, schema changes, or new top-level
  pages.

## Open Questions

- None for this feature slice.
