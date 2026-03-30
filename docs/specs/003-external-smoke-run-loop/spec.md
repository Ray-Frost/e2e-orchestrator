# External Smoke Run Loop

Companion docs: [`plan.md`](./plan.md), [`tasks.md`](./tasks.md)

## Purpose

- Define the first backend-only smoke-run slice for the platform.
- Lock the singleton suite, run loop, and minimal Playwright results ingest
  needed to make run state and failure statistics truthful.
- Keep artifact layout rules in
  [`001-run-artifact-persistence`](../001-run-artifact-persistence/spec.md)
  and failure statistics rules in
  [`002-failure-statistics`](../002-failure-statistics/spec.md).

## Scope

- Startup config for one seeded external smoke suite.
- Backend `GET /api/suites`, `POST /api/runs`, `GET /api/runs`, and
  `GET /api/runs/{id}`.
- FIFO in-process scheduling with concurrency fixed at `1`.
- Probe, runner spawn, timeout handling, and terminal status writing.
- Minimal `results.json` ingest into `case_results`.
- SQLite WAL enablement and the Prisma migration that makes `suite_name`
  unique.
- Tests that prove the seeded suite, run loop, ingest, and failure-statistics
  compatibility.

## Out of Scope

- Frontend pages.
- Cancel/restart flows.
- Logs API and report serving.
- Artifact layout rules, which remain owned by
  [`001-run-artifact-persistence`](../001-run-artifact-persistence/spec.md).
- Failure statistics aggregation rules, which remain owned by
  [`002-failure-statistics`](../002-failure-statistics/spec.md).

## Inherited Constraints

- Use the backend-local `apps/server/artifacts/` directory.
- Keep the database as the source of truth for status, reason, timing, and run
  identity.
- Keep API and JSON field names snake_case.
- Keep `test_lib_case_code` as the case-results grouping key for statistics.
- Use a single seeded suite row from server env config.
- Keep all run-pipeline DB writes strictly serial with explicit `await`.
- Preserve the uniform error body `{ "error": { "message": "string" } }`.

## Behavior

- `E2E_SMOKE_SUITE_NAME` defaults to `demo-smoke`.
- `E2E_SMOKE_COMMAND` defaults to `npm run test:smoke:platform`.
- `E2E_SMOKE_CWD` is required.
- `E2E_SMOKE_SUT_BASE_URL` defaults to `http://localhost:3000`.
- `E2E_SMOKE_PROBE_URL` defaults to `${E2E_SMOKE_SUT_BASE_URL}/`.
- `E2E_SMOKE_TIMEOUT_MINUTES` defaults to `10` and must be positive.
- Startup sync seeds or updates exactly one suite row from config.
- `POST /api/runs` creates a pending run, snapshots suite/runtime config, and
  returns immediately while scheduling work asynchronously.
- Probe failures become `fail / probe_failed`.
- Required artifact bootstrap failures become `fail / parse_or_write_error`
  without spawning the runner.
- Nonzero exit before valid ingest becomes `fail / runner_exit_nonzero`.
- Valid ingest with any failed case becomes `fail / cases_failed`.
- Valid ingest with no failed cases becomes `success / null`.

## Acceptance Criteria

- `GET /api/suites` exposes the seeded suite row only.
- `POST /api/runs` validates the seeded suite and returns the created run
  summary.
- `GET /api/runs` and `GET /api/runs/{id}` expose the locked summary fields
  and artifact presence flags.
- Probe retry, timeout, FIFO scheduling, and timeout termination are covered by
  tests.
- `results.json` ingest writes one `case_results` row per Playwright test and
  keeps `failure-statistics` working without changing its contract.
- The implementation does not reopen artifact layout or failure-statistics
  scope.

## Open Questions

- None.
