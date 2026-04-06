# Minimal Run Stdout Access Scope

- Status: Accepted
- Date: 2026-04-06
- Deciders: Project maintainers

## Context

`IMPLEMENTATION_GUIDE.md` originally left logs and report access as undecomposed
future capabilities.

The earlier direction included a cursor-based logs API for
`GET /api/runs/{id}/logs/stdout`, optional `stderr` expansion, and a separate
report-access capability.

The current project timeline no longer supports completing that broader artifact
access surface in one pass.

At the same time, the runtime already writes `stdout.log` for each executed
run, and raw stdout is the smallest missing debugging surface on the current
operator pages.

We need one explicit decision that narrows the next implementation slice so the
remaining work can stay small, testable, and aligned with current time
constraints.

## Decision Drivers

- Reduce implementation scope while still delivering a usable debugging surface
  on `/runs/:id`.
- Reuse an artifact that already exists instead of introducing new generation
  or synchronization paths.
- Avoid finalizing a richer logs contract whose details are still unsettled.
- Keep the frontend simple and avoid reopening report behavior in the same
  slice.
- Preserve room for a future richer logs/artifact design if real usage later
  justifies it.

## Considered Options

1. Continue with the previously planned full logs API plus separate report
   access.
2. Narrow the next slice to one raw stdout text endpoint and defer report
   access.
3. Expose report access only and drop stdout access from the next slice.
4. Inject stdout viewing into a report-oriented frontend flow.

## Decision Outcome

Select option 2.

The next artifact-access slice is intentionally reduced to:

- raw stdout access at `GET /api/runs/{id}/stdout`
- minimal `/runs/:id` entrypoint for `View stdout`

This option wins because it captures the most valuable immediate debugging
workflow with the smallest reliable implementation surface, while explicitly
deferring both the unfinished richer logs design and report access.

## Implementation Constraints

- Do not implement the previously planned cursor-based logs API in this slice.
- Keep stdout access limited to whole-file `text/plain` reads; no `cursor`,
  `tail`, streaming, search, or `stderr` support.
- Keep stdout access on the existing `/runs/:id` page rather than creating a
  new top-level page.
- Keep report access out of scope for this slice.
- Preserve the existing artifact-generation behavior and schema.

## Consequences

- Positive:
  - The project gets a shippable stdout-access slice with materially lower
    complexity than the full logs design.
  - The implementation can reuse an existing runtime output and existing run
    detail routing.
  - The decision keeps future richer logs work possible without forcing it into
    the current schedule.
- Negative:
  - The platform will not yet have `stderr`, log tailing, pagination, live
    streaming, or report access.
  - Operators will still need later work if report viewing becomes necessary.
- Migration and compatibility impacts (required):
  - Planning and implementation should follow the new minimal slice under
    `008-run-stdout-access` instead of reviving the earlier undecomposed logs
    API from `IMPLEMENTATION_GUIDE.md`.
  - `IMPLEMENTATION_GUIDE.md` should treat richer logs capabilities as deferred
    future work and should not imply that report access is part of the current
    slice.

## Evidence

- The runtime already persists `stdout.log` per run.
- The current run-detail page already exposes artifact availability, making it
  the natural place for minimal operator-facing stdout access.
- Current time constraints favor a minimal debugging surface over a broader
  report-plus-logs slice.

## References

- `IMPLEMENTATION_GUIDE.md`
- `docs/specs/001-run-artifact-persistence/spec.md`
- `docs/specs/004-run-detail-page/spec.md`
- `docs/specs/008-run-stdout-access/spec.md`
- `apps/server/src/runs/run-scheduler.service.ts`

## Supersedes

None.

## Superseded by

None.
