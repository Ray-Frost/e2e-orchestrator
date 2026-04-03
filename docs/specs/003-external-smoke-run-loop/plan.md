# External Smoke Run Loop Plan

Companion docs: [`spec.md`](./spec.md), [`tasks.md`](./tasks.md)

## Implementation Approach

- Keep the work inside `apps/server/src/runs/` and reuse the existing
  `RunArtifactsService`.
- Add a small config loader for the smoke-suite env contract, then seed or sync
  the singleton suite during startup.
- Implement the run lifecycle as a small set of focused backend services:
  config/bootstrap, suite lookup, run creation/listing/detail, probe, scheduler,
  and results ingest.
- Use a single in-process FIFO queue with one active runner.
- Use the artifact service for pre-spawn bootstrap and terminal `meta.json`
  writes, but keep the DB authoritative for status and timing.
- Parse `results.json` by walking `suites[].specs[].tests[]` and only persisting
  the final test result from each test entry.
- Keep all persistence operations serial and explicit; do not parallelize DB
  writes.

## Affected Files or Modules

- `apps/server/src/runs/**`
- `apps/server/src/prisma/prisma.service.ts`
- `apps/server/prisma/schema.prisma`
- `apps/server/prisma/migrations/**`
- `docs/specs/003-external-smoke-run-loop/**`
- `IMPLEMENTATION_GUIDE.md`

## DB or Migration Impact

- Add `suite_name` uniqueness to `suites`.
- Keep the `Suite` model minimal: `suite_name` and `command`.
- Continue using existing `runs` and `case_results` tables.

## API Impact

- Add `GET /api/suites`.
- Add `POST /api/runs`.
- Add `GET /api/runs`.
- Add `GET /api/runs/{id}`.
- Keep the error body shape stable.

## Runtime Impact

- Enable SQLite WAL at startup through the existing Prisma setup.
- Spawn the smoke command in the configured `cwd` with the platform env vars
  required by the runner.
- Stream stdout and stderr to the existing artifact paths.
- Enforce timeout and terminate the whole process group.

## Test Strategy

- Unit test env parsing and singleton suite sync.
- Unit test probe retry and timeout behavior.
- Unit test `results.json` parsing against the attached Playwright JSON shape.
- HTTP test the run loop with temp-SQLite plus migration replay and a fake
  runner fixture.
- Keep the failure-statistics regression test in place so newly ingested
  `case_results` still drive the existing aggregation endpoint.

## Risks and Rollback Notes

- Risk: startup sync and run creation drift from the singleton-suite contract.
  Mitigation: keep suite selection and validation in one service.
- Risk: result ingest rejects valid-but-unexpected JSON shapes.
  Mitigation: keep the parser focused on the locked v1 reference file and add
  regression tests around the documented shape.
- Rollback: disable the new runs controller and scheduler wiring while leaving
  the schema and artifact changes intact.
