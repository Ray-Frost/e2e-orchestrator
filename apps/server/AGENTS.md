# AGENTS.md

This document defines backend-local working rules for the server package.

## Scope

- Use this file for backend implementation, Prisma work, runtime behavior, and server package documentation in `apps/server`.
- Use the repository root `AGENTS.md` for repository-wide navigation, process entrypoints, and cross-workspace rules.
- If this file conflicts with the backend authority docs listed below, follow those authority docs first.

## Backend Authorities

- `apps/server/prisma/schema.prisma`: source of truth for database models, enums, relations, indexes, and migration-facing data shape.
- `docs/specs/**`: source of feature-local planning for decomposed server capabilities within their declared scope. Inside one feature directory, `spec.md` owns scope/behavior/acceptance, `plan.md` owns implementation approach and validation, and `tasks.md` is the executable breakdown that must stay aligned with the other two.
- `IMPLEMENTATION_GUIDE.md`: source of truth for runtime behavior, API contracts, run semantics, and operational constraints that have not yet been decomposed into `docs/specs/**`.
- `apps/server/.env`: source of `DATABASE_URL` for server-side Prisma commands.
- `apps/server/package.json`: source of runnable backend package scripts.

## Key Paths

- `apps/server/src`: backend runtime and API implementation root.
- `apps/server/prisma/schema.prisma`: schema authority for DB structure.
- `apps/server/.env`: local database connection configuration.
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
- Use `apps/server/.env` as the `DATABASE_URL` source for server Prisma commands.
- Use `snake_case` for API fields, database fields, and JSON fields.
- Expose the public resource identifier field as `id` and keep it typed as a number.
- Use `run_id` and `suite_id` in diagnostics and `meta.json` when resource-specific naming is needed.
- When a server capability has a registered feature spec under `docs/specs/**`, implement against that scoped spec first and use `IMPLEMENTATION_GUIDE.md` for undecomposed or cross-feature rules.
- Follow `IMPLEMENTATION_GUIDE.md` for run status, reason, and timing semantics.
- Derive statistics from structured DB records. `case_results` is the source for case-level aggregation.
- Keep cancellation semantics and error-body constraints aligned with `IMPLEMENTATION_GUIDE.md`.
