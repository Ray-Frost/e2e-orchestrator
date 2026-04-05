# Run Detail Page Plan

Companion docs: [`spec.md`](./spec.md), [`tasks.md`](./tasks.md)

## Implementation Approach

- Build on the existing `GET /api/runs/{id}` contract instead of introducing a
  second detail-adjacent endpoint. Add a small `result_summary` extension so the
  frontend can fetch the page with one request shape during initial load and
  polling.
- Keep the backend change inside the current runs module by extending
  `RunsService`, `runs.types.ts`, and the existing HTTP integration coverage.
  Do not add a new backend abstraction unless the summary logic becomes more
  complex than simple per-run aggregation.
- Add a dedicated `apps/web/src/run-detail-page.tsx` page module that mirrors
  the current frontend fetch/state style used by
  `apps/web/src/failure-statistics-page.tsx`, but adapts it to route params,
  run-detail states, shared operator navigation, and active-run polling.
- Keep the page observation-first: overview, timing, execution context,
  artifacts, and summary-only result data. Do not turn this slice into a logs
  viewer, report launcher, or results browser.
- Treat `/runs/:id` as part of the `Runs` top-level section in the shared
  operator navigation instead of implying a single parent route back to failure
  statistics.
- Keep the `Artifacts` section non-interactive in this slice. Show availability
  status only, so the page stays aligned with current backend capability and
  avoids fake controls. Treat this as a sequencing decision for `004`, not as a
  permanent product rule against future artifact entrypoints.
- Poll active runs on a short fixed interval and stop when the response reaches
  a terminal status, when the route changes, or when the component unmounts.

## Affected Files or Modules

- `apps/server/src/runs/runs.service.ts`
- `apps/server/src/runs/runs.types.ts`
- `apps/server/src/runs/runs.http.spec.ts`
- `apps/web/src/app.tsx`
- `apps/web/src/run-detail-page.tsx`
- `apps/web/src/app.css`
- `apps/web/src/app.test.tsx`
- `docs/specs/004-run-detail-page/**`
- `docs/specs/README.md`

## DB or Migration Impact

- None.
- No Prisma schema change.
- No migration assets.
- Read existing `runs` and `case_results` data only.

## API Impact

- Preserve `GET /api/runs/{id}` as the page's single detail endpoint.
- Add a backward-compatible `result_summary` field to the run-detail response:
  - `null` when no `case_results` exist for the run;
  - otherwise `{ total_count, passed_count, failed_count, skipped_count }`.
- Keep existing run-detail fields and the uniform error body unchanged.
- Keep logs, report, and artifact-access endpoints out of this slice.

## Runtime Impact

- Frontend polling adds repeated read requests for active runs only.
- Polling should stop once a run becomes terminal so the page does not keep
  fetching a settled record.
- No new backend background job, queue, or process-management behavior is added
  by this feature.

## Key Technical Decisions

- Extend existing run detail in place: one endpoint keeps the page simple and
  makes polling straightforward.
- Use `result_summary: null` instead of synthetic zero counts when no structured
  result data exists, so the UI can distinguish "no summary available" from a
  real aggregate.
- Keep artifact presentation non-interactive: availability is useful now,
  while logs/report actions remain separate future capabilities that should be
  defined by later slices instead of implied here.
- Keep case-result coverage summary-only: this page should explain the run, not
  replace future result-inspection surfaces.

## Open Questions

### Resolved During Planning

- What polling interval should active runs use?
  Resolution: use a short fixed polling interval of about two seconds and stop
  after terminalization.
- Should the `Artifacts` section show disabled future-action controls?
  Resolution: no. Show availability-only presentation in this slice.
- Should summary-only result data use a separate endpoint?
  Resolution: no. Extend `GET /api/runs/{id}` in place with a small
  backward-compatible field.

### Deferred to Implementation

- Exact field-formatting helpers and final display copy for unavailable timing
  values can be decided during implementation as long as the behavior remains
  explicit and non-placeholder.
- If the frontend page grows awkward while implementing the layout, the
  implementer may extract small presentational helpers without changing the
  locked route behavior or API contract.

## Test Strategy

- Extend backend HTTP tests around `GET /api/runs/{id}` to cover:
  - runs with ingested passing results;
  - runs with ingested failing results;
  - runs that never produced `case_results` because they failed earlier in the
    lifecycle or timed out before ingest;
  - preservation of existing detail fields while adding `result_summary`.
- Extend frontend route tests to cover:
  - shared operator navigation on `/runs/:id`;
  - `Runs` highlighted on `/runs/:id`;
  - loading state;
  - not-found state;
  - generic error state;
  - ready state for a terminal run;
  - polling behavior for `pending` or `running` runs;
  - polling stop after terminalization;
  - summary-present versus summary-absent rendering;
  - non-interactive artifact availability rendering.

## Risks and Rollback Notes

- Risk: the UI could miscommunicate active runs if missing summary data looks
  like a real zero-result aggregate.
  Mitigation: use `result_summary: null` and render explicit summary-unavailable
  copy when needed.
- Risk: polling timers could continue after terminalization or unmount.
  Mitigation: keep interval setup and cleanup inside one effect with explicit
  stop conditions and abort handling.
- Risk: the page scope could drift into logs or report UX because those features
  are adjacent in the guide.
  Mitigation: keep `Artifacts` availability-only and hold all live-log behavior
  outside this slice, while stating explicitly that later slices may add those
  entrypoints once their contracts are defined.
- Rollback: revert the frontend route back to placeholder behavior and remove
  the `result_summary` response addition while preserving the existing run-detail
  endpoint.
