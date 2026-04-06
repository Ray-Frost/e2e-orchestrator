# Run Stdout Access Plan

Companion docs: [`spec.md`](./spec.md), [`tasks.md`](./tasks.md)

## Implementation Approach

- Keep backend work inside the existing runs module instead of adding a new
  stdout-access module. Extend the current controller and add only the
  smallest supporting service/helper needed to read `stdout.log` and express
  missing-artifact semantics cleanly.
- Keep the artifact-path authority in the existing artifact-persistence layer.
  Reuse `resolveRunArtifactPaths()` instead of duplicating path math for the
  new access endpoint.
- Treat raw stdout access as a separate plain-text endpoint,
  `GET /api/runs/{id}/stdout`, rather than reviving the unfinished
  cursor-based logs API from `IMPLEMENTATION_GUIDE.md`.
- Keep frontend changes local to `apps/web/src/run-detail-page.tsx`,
  `apps/web/src/app.test.tsx`, and small style adjustments in
  `apps/web/src/app.css`.
- Prefer lazy stdout loading from the detail page instead of widening the
  existing `GET /api/runs/{id}` payload with log text.
- Keep report behavior explicitly out of scope for this slice so the current
  work stays limited to stdout debugging.

## Affected Files or Modules

- `apps/server/src/runs/runs.controller.ts`
- `apps/server/src/runs/runs.service.ts`
- `apps/server/src/runs/runs.http.spec.ts`
- `apps/server/src/runs/artifact-persistence/artifact-paths.ts`
- `apps/web/src/run-detail-page.tsx`
- `apps/web/src/app.test.tsx`
- `apps/web/src/app.css`
- `docs/specs/008-run-stdout-access/**`
- `docs/specs/README.md`
- `IMPLEMENTATION_GUIDE.md`

## DB or Migration Impact

- None.
- Do not add schema changes or migration assets.
- Reuse the existing run identity and artifact-presence data already exposed by
  `GET /api/runs/{id}`.

## API Impact

- Add `GET /api/runs/{id}/stdout` that returns `text/plain` on success.
- Return `404` when the run does not exist.
- Return `404` when the requested artifact does not exist for that run.
- Keep `GET /api/runs/{id}` as the frontend's page-data source; do not add log
  text to that payload in this slice.

## Runtime Impact

- None on run execution semantics, scheduling, or artifact generation.
- Existing stdout files become operator-readable through an explicit backend
  route.
- The frontend adds one lazy read path for stdout without introducing extra
  polling behavior.

## Key Technical Decisions

- Do not implement the deferred cursor/tail logs API in this slice.
- Expose stdout as a whole-file plain-text read because it is the smallest
  useful debugging surface.
- Keep `/runs/:id` as the only new frontend entrypoint for this slice.
- Keep stdout errors local to the artifact UI instead of replacing the route's
  already-loaded run detail state.
- Keep report access out of scope for this slice.

## Open Questions

### Resolved During Planning

- Should the slice expose stderr too?
  Resolution: no. Keep the first cut limited to stdout.
- Should stdout use the old planned cursor protocol?
  Resolution: no. Return the whole file as plain text.
- Should report access be included in the same slice?
  Resolution: no. Defer it.

### Deferred to Implementation

- Exact run-detail UI placement for the stdout panel can be finalized during
  implementation as long as it stays inside `/runs/:id`.

## Test Strategy

- Extend backend HTTP coverage for:
  - successful full-text stdout reads;
  - empty stdout file reads;
  - missing run `404` handling for stdout;
  - missing artifact `404` handling for stdout.
- Extend frontend route tests for:
  - `View stdout` shown only when stdout is available;
  - lazy stdout fetch and read-only rendering;
  - local artifact-access error feedback without losing the ready-state page.

## Risks And Rollback Notes

- Risk: large stdout files could make the first implementation feel heavy.
  Mitigation: keep the slice intentionally minimal now, then add truncation or
  partial reads later only if real usage justifies it.
- Risk: stdout-missing handling could drift from detail-page availability flags
  after cleanup or failed runs.
  Mitigation: treat artifact access as filesystem-truth at request time and
  keep missing-file responses readable.
- Rollback: remove the stdout endpoint and local stdout UI while leaving the
  existing read-only run-detail page and artifact availability metadata intact.
