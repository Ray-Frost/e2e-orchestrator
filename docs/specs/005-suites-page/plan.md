# Suites Page Plan

Companion docs: [`spec.md`](./spec.md), [`tasks.md`](./tasks.md)

## Implementation Approach

- Build on the existing suites and runs APIs instead of adding a second
  page-bootstrap endpoint. Extend `GET /api/suites` in place with the minimal
  display fields this page needs.
- Keep the suites response list-shaped even when the backend currently returns
  one seeded suite most of the time, so the frontend does not encode the
  current singleton behavior into its structure.
- Add a dedicated `apps/web/src/suites-page.tsx` page module that matches the
  current frontend fetch/state style used by the other pages, but adapts it to
  suites loading plus one-time create-run feedback.
- Promote `/suites` to the primary entry route and keep
  `/statistics/failures` available as a secondary operator surface.
- Keep the run action lightweight: disable only the clicked button while the
  request is in flight, then show one-time success or error feedback without
  turning the page into a live run monitor.
- Keep this slice out of suite-model redesign. The current backend may still
  expose one seeded suite backed by the existing smoke-run configuration, but
  the new page and API contract should not hard-code singleton-only UI
  structure as a permanent product rule.

## Affected Files or Modules

- `apps/server/src/runs/runs.controller.ts`
- `apps/server/src/runs/smoke-suite.service.ts`
- `apps/server/src/runs/smoke-suite.service.spec.ts`
- `apps/server/src/runs/runs.http.spec.ts`
- `apps/web/src/app.tsx`
- `apps/web/src/suites-page.tsx`
- `apps/web/src/app.css`
- `apps/web/src/app.test.tsx`
- `docs/design-docs/ADR-0004-suites-page-homepage-route.md`
- `docs/design-docs/index.md`
- `docs/specs/005-suites-page/**`
- `docs/specs/README.md`

## DB or Migration Impact

- None.
- Do not add schema changes or migration assets.
- Do not expand the `Suite` model just to satisfy this page.

## API Impact

- Extend `GET /api/suites` with backward-compatible suite-display fields:
  - `command`
  - `sut_base_url`
- Keep the response list-shaped and the error body stable.
- Keep `POST /api/runs` unchanged as the run-creation endpoint.
- Do not add a `/api/suites/:id`, `/api/suites/:id/runs`, or create-suite
  endpoint in this slice.

## Frontend Impact

- Add the `/suites` route and redirect `/` to it.
- Add a suites page module that fetches suite data and renders explicit
  loading, empty, error, and ready states.
- Keep a secondary navigation path to `/statistics/failures`.
- Show one-time create-run feedback with a run-detail link after successful run
  creation.
- Keep the page free of recent-runs summaries and active-run polling.

## Key Technical Decisions

- Extend `GET /api/suites` in place rather than layering on a second endpoint
  just for page bootstrap.
- Keep the frontend structurally multi-suite-ready now instead of baking the
  current singleton data shape into a singleton-only page.
- Keep post-create feedback lightweight and non-persistent so the page stays a
  run-entry surface rather than drifting into a run-status dashboard.
- Avoid schema work in this slice. For the current implementation, populate the
  new suite-display fields from the existing suite record plus the current
  smoke-run configuration, and treat that wiring as an implementation shortcut
  rather than a long-term multi-suite data model.

## Open Questions

### Resolved During Planning

- Should the page become the new homepage?
  Resolution: yes. Redirect `/` to `/suites` and keep failure statistics as a
  secondary destination.
- Should successful create-run navigate immediately to `/runs/:id`?
  Resolution: no. Stay on `/suites` and show one-time success feedback with a
  run-detail link.
- Should the suites page poll active runs or show recent-run summaries?
  Resolution: no. Keep the slice focused on suite discovery and run creation.

### Deferred to Implementation

- Exact success and error feedback placement can be finalized during
  implementation as long as the behavior remains explicit and one-time.
- Final card or list styling can be decided during implementation as long as
  the page remains structurally multi-suite-ready.

## Test Strategy

- Extend backend HTTP coverage to prove:
  - `GET /api/suites` returns the locked fields for suite display;
  - existing run creation still works with the unchanged `POST /api/runs`
    contract;
  - suite lookup remains list-shaped.
- Extend frontend route tests to cover:
  - `/` redirecting to `/suites`;
  - suites-page loading, empty, error, and ready states;
  - secondary navigation to `/statistics/failures`;
  - per-suite button disabling while a create-run request is in flight;
  - success feedback with a run-detail link;
  - failed create-run feedback and button recovery.

## Verification Commands

- `pnpm --filter server test`
- `pnpm --filter server build`
- `pnpm --filter web build`
- `pnpm lint`
- `pnpm --filter server db:check`
- If a usable local database is not available, record the DB-gate commands as
  blocked or maintainer-run instead of claiming them as passed.

## Risks and Rollback Notes

- Risk: the page could accidentally imply that multi-suite backend support
  already exists.
  Mitigation: keep the response list-shaped, but avoid management features or
  claims about suite authoring in this slice.
- Risk: root-route ownership could remain inconsistent across specs after the
  homepage shift.
  Mitigation: record the cross-feature homepage decision in ADR form while
  preserving older feature specs as historical records.
- Risk: rapid repeated clicks could create duplicate runs unintentionally.
  Mitigation: disable only the clicked action while the request is in flight
  and cover the behavior in frontend tests.
- Rollback: revert the `/` redirect, remove the suites page route, and roll
  back the `GET /api/suites` field expansion while leaving the existing run
  APIs intact.
