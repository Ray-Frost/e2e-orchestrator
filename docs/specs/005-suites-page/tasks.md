# Suites Page Tasks

Companion docs: [`spec.md`](./spec.md), [`plan.md`](./plan.md)

## Preconditions

- Implement on the current branch without reopening the backend suite model.
- Keep the slice limited to the suites page, the root-route promotion it
  requires, and the minimal suites API expansion needed to render the page.

## Ordered Tasks

1. Extend the suites API contract in the backend without changing the suite
   data model.
   Validation: backend tests cover `GET /api/suites` returning `id`,
   `suite_name`, `command`, and `sut_base_url` while `POST /api/runs` keeps its
   existing contract.
2. Add the `/suites` page and promote it to the root entry route.
   Validation: frontend route tests cover `/` redirecting to `/suites`,
   loading/empty/error/ready states, and a secondary navigation path to
   `/statistics/failures`.
3. Implement the per-suite `Run suite` action with one-time feedback.
   Validation: frontend tests cover in-flight button disabling, successful
   create-run feedback with a `/runs/:id` link, and failed create-run recovery
   without polling or persistent live-status UI.
4. Record the homepage-route decision in forward-looking docs without rewriting
   historical feature specs.
   Validation: `docs/design-docs/ADR-0004-suites-page-homepage-route.md`,
   `docs/design-docs/index.md`, `docs/specs/005-suites-page/**`, and
   `docs/specs/README.md` agree on the current route structure and slice
   boundaries.
5. Re-run the documented verification commands and compare the implementation
   to `spec.md`.
   Validation: the delivered behavior matches the locked suites-page scope and
   does not add recent-runs summaries, queue dashboards, suite management, or
   case-level run controls.
