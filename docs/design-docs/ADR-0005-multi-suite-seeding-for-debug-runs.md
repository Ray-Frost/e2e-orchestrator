# Multi-Suite Seeding for Debug Run Entry

- Status: Accepted
- Date: 2026-04-05
- Deciders: Project maintainers

## Context

The original smoke-run backend slice (`003-external-smoke-run-loop`) locked the
platform to one seeded suite row loaded from server config.

That implementation matched the first backend milestone, but the current
operator workflow now needs multiple suite entries on `/suites` so different
debug-oriented `demo-test-lib` scripts can be launched through the same normal
run flow.

We also have historical feature docs that still describe the earlier singleton
contract. Those docs are being preserved as historical slice records rather than
rewritten in place.

## Decision Drivers

- Make additional debug run variants available through the existing `/suites`
  and `POST /api/runs` workflow without inventing a second launch path.
- Keep the implementation simple and local to the current seeded-suite backend
  code.
- Avoid destructive suite-row rewrites that would disturb historical run
  records.
- Preserve the current schema and run creation contract.

## Considered Options

1. Keep the singleton suite model and ask operators to switch commands outside
   the platform.
2. Seed multiple configured suites that share the same runtime context and are
   launched through the existing create-run path.
3. Introduce a separate debug-only endpoint or UI surface for alternate
   commands.

## Decision Outcome

Select option 2.

The backend now seeds a small configured suite set instead of collapsing the
database to one canonical suite row. The active suite list includes the default
smoke command plus the debug variants needed for current local investigation.

This option wins because it exposes the new scripts through the normal product
flow, keeps implementation scope tight, and avoids creating a parallel control
surface just for debug work.

## Implementation Constraints

- Keep the existing `Suite` schema and `POST /api/runs` contract unchanged.
- Seed the active suite list from backend configuration/runtime code, not from a
  new schema or admin UI.
- Treat `cwd`, `sut_base_url`, `probe_url`, and timeout settings as shared
  runtime context for all seeded suites in this slice.
- Do not delete or rewrite historical suite rows that are still referenced by
  existing runs.
- Expose only the currently configured suite set on `/api/suites` and allow
  create-run only for those suite IDs.

## Consequences

- Positive:
  - Operators can launch multiple debug-oriented smoke variants directly from
    `/suites`.
  - The existing suites page naturally benefits from its list-shaped response
    model.
  - Historical runs keep their original suite relationships.
- Negative:
  - The code no longer matches the earlier singleton-only slice docs verbatim.
  - Runtime config now implicitly owns a small suite catalog instead of a single
    entry.
- Migration and compatibility impacts (required):
  - `GET /api/suites` now returns the configured active suite set rather than a
    single seeded row.
  - Existing run records remain valid because the schema is unchanged and
    historical suite rows are preserved.

## Evidence

- `005-suites-page` already treated the frontend as list-shaped and future-ready
  for more than one suite entry.
- Current debugging needs require launching:
  - `test:smoke:platform`
  - `test:smoke:platform:with-30-second-case`
  - `test:smoke:platform:with-failure`
- The existing backend already stores suite identity separately from run
  snapshots, so preserving historical suite rows is straightforward.

## References

- `docs/specs/003-external-smoke-run-loop/spec.md`
- `docs/specs/005-suites-page/spec.md`
- `apps/server/src/runs/smoke-run-config.ts`
- `apps/server/src/runs/smoke-suite.service.ts`

## Supersedes

None.

## Superseded by

None.
