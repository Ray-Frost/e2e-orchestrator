# AGENTS.md

This document defines backend-local working rules for the server package.

## Scope

- Use this file for backend implementation, Prisma work, runtime behavior, and server package documentation in `apps/server`.
- Use the repository root `AGENTS.md` for repository-wide navigation, process entrypoints, and cross-workspace rules.
- If this file conflicts with the backend authority docs listed below, follow those authority docs first.

## Backend Authorities

- `apps/server/prisma/schema.prisma`: source of truth for database models, enums, relations, indexes, and migration-facing data shape.
- `docs/specs/**`: source of feature-local planning for server capabilities within their declared scope. Inside one feature directory, `spec.md` owns scope/behavior/acceptance, `plan.md` owns implementation approach and validation, and `tasks.md` is the executable breakdown that must stay aligned with the other two.
- `apps/server/.env`: source of local backend env values for server-side Prisma commands and backend runtime.
- `apps/server/package.json`: source of runnable backend package scripts.

## Key Paths

- `apps/server/src`: backend runtime and API implementation root.
- `apps/server/prisma/schema.prisma`: schema authority for DB structure.
- `apps/server/.env`: local backend env configuration.
- `apps/server/package.json`: backend scripts and package metadata.

## Backend Commands

Run these from the repository root unless a package context is explicit.

```bash
pnpm --filter server start:dev
pnpm --filter server build
pnpm --filter server test
pnpm --filter server lint
pnpm --filter server format:check
pnpm --filter server db:validate
pnpm --filter server db:generate
pnpm --filter server db:check
pnpm --filter server db:migrate:dev
pnpm --filter server db:migrate:status
pnpm --filter server db:migrate:deploy
```

## Backend Rules

- Keep runtime design within SQLite single-writer discipline. Enable WAL, allow only one write transaction at a time, serialize each run write chain with explicit `await`, and do not use `Promise.all` for DB writes in the same run pipeline.
- Keep the storage boundary on SQLite. Do not switch the platform to MySQL as part of normal implementation work.
- Reconcile code to `apps/server/prisma/schema.prisma` before extending API responses or other DB-facing behavior.
- Keep Prisma schema changes and migration assets in sync.
- Use `apps/server/.env` as the single local backend env source for Prisma commands and backend runtime.
- Use `snake_case` for API fields, database fields, and JSON fields.
- Expose the public resource identifier field as `id` and keep it typed as a number.
- Preserve the uniform API error body `{ "error": { "message": "string" } }`.
- Return `400` for invalid input and `404` when the requested resource does not exist.
- Use `run_id` and `suite_id` in diagnostics and `meta.json` when resource-specific naming is needed.
- Treat `created_at` as the only queue timestamp for a run.
- Write `start_time` only after probe success and entry into the runner spawn path.
- Write `end_time` only after terminal finalization completes, and derive `duration_ms` only when both `start_time` and `end_time` exist.
- Keep locked terminal reasons: `fail` uses `probe_failed`, `cases_failed`, `runner_exit_nonzero`, or `parse_or_write_error`; `timeout` uses `timeout_exceeded`; `cancelled` uses `user_cancelled`.
- When a server capability has a registered feature spec under `docs/specs/**`, implement against that scoped spec first.
- Derive statistics from structured DB records. `case_results` is the source for case-level aggregation.
