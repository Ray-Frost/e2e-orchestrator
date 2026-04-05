# Suites Page as the Primary Frontend Entry Route

- Status: Accepted
- Date: 2026-04-05
- Deciders: Project maintainers

## Context

`002-failure-statistics` introduced the first usable frontend route and used
`/` -> `/statistics/failures`.

`005-suites-page` introduces the first dedicated run-entry page at `/suites`.

We need one explicit owner for the frontend homepage route.

## Decision Drivers

- Give the product a first-class homepage for starting runs, not only observing
  prior failures.
- Keep route ownership explicit for future implementation work.
- Avoid introducing a separate neutral landing page when a stronger primary
  surface is already identified.

## Considered Options

1. Keep `/` routed to `/statistics/failures`.
2. Move `/` to `/suites`.
3. Introduce a neutral landing page at `/` that links to both `/suites` and
   `/statistics/failures`.

## Decision Outcome

Select option 2.

The primary frontend entry route moves to `/suites`, and `/statistics/failures`
remains a secondary operator surface.

This option wins because the current product direction needs a direct run-entry
homepage more than a read-only statistics homepage.

## Implementation Constraints

- New implementation work should treat `/suites` as the primary homepage and
  `/statistics/failures` as a reachable secondary route.
- The suites-page slice must not use this routing decision as justification for
  expanding into broader run-management or suite-management scope.

## Consequences

- Positive:
  - The product gains a homepage centered on starting runs.
  - Future contributors get one explicit homepage-route decision to follow.
- Negative:
  - Homepage ownership now differs from the earlier failure-statistics slice.
- Migration and compatibility impacts (required):
  - Frontend implementation and future specs should follow `/` -> `/suites`
    going forward.
  - `/statistics/failures` remains supported at its existing route.

## Evidence

- `002-failure-statistics` introduced the first frontend route and used `/` ->
  `/statistics/failures` as an early-product default.
- The planned `Suites Page` creates the first dedicated run-entry surface and is
  a stronger homepage candidate for the current product direction.

## References

- `docs/specs/002-failure-statistics/spec.md`
- `docs/specs/005-suites-page/spec.md`
- `docs/design-docs/index.md`

## Supersedes

None.

## Superseded by

None.
