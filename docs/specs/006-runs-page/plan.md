# Runs Page Plan

Companion docs: [`spec.md`](./spec.md), [`tasks.md`](./tasks.md)

## Implementation Approach

- Build on the existing `GET /api/runs` contract instead of adding a second
  runs bootstrap endpoint or expanding the list response.
- Add a dedicated `apps/web/src/runs-page.tsx` page module that matches the
  current frontend fetch/state style used by the other pages, but adapts it to
  list rendering plus page-level polling.
- Keep the root-route decision unchanged: `/` continues to redirect to
  `/suites`, while `/runs` becomes a peer operator route instead of the new
  homepage.
- Add clear peer-route navigation among `/runs`, `/suites`, and
  `/statistics/failures` without promoting `/runs/:id` into a primary
  navigation destination.
- Keep polling low-concurrency by using a single list request loop that runs
  only while the current list still contains an active run.
- Keep the page observation-first. Defer richer context and controls to later
  slices instead of turning this page into a queue dashboard or detail clone.

## Affected Files or Modules

- `apps/web/src/app.tsx`
- `apps/web/src/runs-page.tsx`
- `apps/web/src/suites-page.tsx`
- `apps/web/src/failure-statistics-page.tsx`
- `apps/web/src/app.css`
- `apps/web/src/app.test.tsx`
- `docs/specs/006-runs-page/**`
- `docs/specs/README.md`
- `IMPLEMENTATION_GUIDE.md`

## DB or Migration Impact

- None.
- Do not add schema changes or migration assets.

## API Impact

- None.
- Keep `GET /api/runs` unchanged as the runs-page data source.
- Do not add query parameters, filter endpoints, or a second runs bootstrap
  endpoint in this slice.

## Frontend Impact

- Add the `/runs` route.
- Keep `/` redirecting to `/suites`.
- Add peer-route navigation among `/runs`, `/suites`, and
  `/statistics/failures`.
- Add a runs page module that fetches run summaries and renders explicit
  loading, empty, error, and ready states.
- Show the locked operator-summary fields plus detail links.
- Poll the page automatically only while the current list still contains an
  active run.

## Key Technical Decisions

- Reuse `GET /api/runs` in place rather than expanding the backend surface for
  this slice.
- Keep the page-level polling loop to one in-flight request at a time so the
  page does not create per-run polling pressure.
- Treat transient polling failures as retryable when active-run data is already
  on screen; only the initial load should block the page with an error state.
- Keep result summaries, artifacts, execution context, and controls on
  `/runs/:id` rather than widening the list page contract.

## Open Questions

### Resolved During Planning

- Should `/runs` become the new homepage?
  Resolution: no. Keep `/` redirecting to `/suites`.
- Should the page reuse `GET /api/runs` without backend expansion?
  Resolution: yes. Keep the existing list contract unchanged.
- Should polling be automatic?
  Resolution: yes. Use a single low-concurrency page-level polling loop that
  runs only while active rows are present.

### Deferred to Implementation

- Final list styling can be decided during implementation as long as the page
  remains dense, scan-friendly, and read-only.
- Exact placement of peer-route navigation can be finalized during
  implementation as long as the three top-level operator pages remain directly
  reachable.

## Test Strategy

- Extend frontend route tests to cover:
  - `/runs` loading, empty, error, and ready states;
  - peer-route navigation among `/runs`, `/suites`, and
    `/statistics/failures`;
  - detail links to `/runs/:id`;
  - automatic polling while active runs exist;
  - stopping polling after a terminal list response;
  - retaining the last ready list through a transient polling failure.
- Keep backend coverage at guardrail level:
  - existing `GET /api/runs` tests continue proving newest-first ordering and
    the locked summary fields.

## Verification Commands

- `pnpm --filter web test`
- `pnpm --filter web build`
- `pnpm lint`

## Risks and Rollback Notes

- Risk: the page could drift into a second detail surface.
  Mitigation: keep the field set limited to existing run summaries and defer
  richer context to `/runs/:id`.
- Risk: polling behavior could create avoidable request pressure.
  Mitigation: keep a single in-flight request, poll only when active runs are
  present, and stop when the list becomes terminal.
- Risk: top-level navigation could become inconsistent across pages.
  Mitigation: update the affected peer pages together in the same slice.
- Rollback: remove the `/runs` route and peer navigation changes while leaving
  the existing runs API and run-detail page intact.
