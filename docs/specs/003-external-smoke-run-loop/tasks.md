# External Smoke Run Loop Tasks

Companion docs: [`spec.md`](./spec.md), [`plan.md`](./plan.md)

## Preconditions

- Implement on the current branch.
- Keep the work backend-only.
- Reuse the existing runs, Prisma, artifact, and statistics scaffolding.

## Ordered Tasks

1. Add the `003` spec, plan, and tasks docs and register the slice in
   `docs/specs/README.md`.
   Validation: the docs tree lists `003-external-smoke-run-loop` next to the
   existing feature specs.
2. Update `IMPLEMENTATION_GUIDE.md` so migrated run-loop detail points at the
   new spec directory while preserving the locked status, reason, timing, and
   `test_lib_case_code` rules.
   Validation: the guide no longer duplicates the migrated run-loop contract.
3. Add the smoke-run config loader and singleton suite bootstrap.
   Validation: unit tests cover required `E2E_SMOKE_CWD`, timeout validation,
   probe-url defaulting, and startup sync of one suite row.
4. Add the Prisma uniqueness migration and enable SQLite WAL during startup.
   Validation: migration replay succeeds and the Prisma startup path enables
   WAL without replacing the current lightweight setup.
5. Implement the backend suite and run APIs.
   Validation: HTTP tests cover `GET /api/suites`, `POST /api/runs`,
   `GET /api/runs`, and `GET /api/runs/{id}` with the locked summary and error
   shapes.
6. Implement the FIFO scheduler, probe, spawn, timeout, and terminalization
   path.
   Validation: tests cover retry, timeout, async queueing, nonzero exit, probe
   failure, and timeout termination.
7. Implement `results.json` ingest and connect it to run terminalization.
   Validation: parser tests cover the attached Playwright shape, missing
   `test_lib_case_code`, missing `results[]`, mixed outcomes, and the
   `failure-statistics` regression.
8. Re-run the documented verification commands and compare the code to
   `spec.md`.
   Validation: the implemented behavior matches the locked slice contract.
