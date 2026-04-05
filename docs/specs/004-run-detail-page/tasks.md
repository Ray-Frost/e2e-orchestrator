# Run Detail Page Tasks

Companion docs: [`spec.md`](./spec.md), [`plan.md`](./plan.md)

## Preconditions

- Implement on the current branch.
- Reuse the existing `GET /api/runs/{id}` route, frontend routing scaffold, and
  shared operator navigation patterns as the starting point.
- Keep the slice read-only and observation-first.

## Ordered Tasks

1. Extend `GET /api/runs/{id}` with the summary-only `result_summary` contract.
   Validation: backend HTTP tests cover runs with persisted `case_results` and
   runs without persisted `case_results`, while existing detail fields remain
   stable.
2. Add the `Run detail page` frontend module and replace the current placeholder
   `/runs/:id` route behavior.
   Validation: frontend tests confirm a run link lands on a real detail page
   instead of the placeholder copy, and the shared operator navigation treats
   the detail route as part of `Runs`.
3. Implement route-level fetch lifecycle and active-run polling.
   Validation: frontend tests cover loading, not-found, generic-error, ready,
   polling for `pending`/`running`, and polling stop after terminalization.
4. Render the observation-first detail sections for overview, timing, execution
   context, artifact availability, and summary-only results.
   Validation: frontend tests cover unavailable timing fields, artifact
   availability-only rendering, and summary-present versus summary-absent
   states.
5. Update `IMPLEMENTATION_GUIDE.md` so migrated run-detail content points at the
   `004-run-detail-page` spec directory and no longer duplicates the run-detail
   contract now owned by this slice.
   Validation: the guide lists `004-run-detail-page` in its migration entry and
   keeps only a short pointer instead of repeating the run-detail feature
   detail.
6. Re-run the documented verification commands and compare the implementation to
   `spec.md`.
   Validation: the delivered behavior matches the locked slice and does not add
   logs viewing, report navigation, artifact download, or a full case-results
   browser.
