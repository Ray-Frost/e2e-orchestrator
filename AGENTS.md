# AGENTS.md

This document is a project map for contributors and coding agents working in this repository. It explains where things live today, where planned capabilities should be implemented (without inventing new directory templates), and which constraints must be respected while building the E2E platform.

## How to Use This Map

- Use this file first to locate code and decide edit boundaries quickly.
- Use `IMPLEMENTATION_GUIDE.md` for detailed behavior, workflow, API contract intent, and implementation constraints.
- Use `schema.prisma` as the source of truth for database models, enums, relations, and indexes.
- If this file conflicts with those two sources, do not silently self-resolve in code: pause implementation in the affected scope, report the conflict with file+line evidence and options, wait for user approval, then implement and update this map.
- Read in this order when starting a task: topology -> capability map -> rules -> source-of-truth docs.
- Treat this file as orientation, not as a replacement for implementation specs.

## Repository Topology (Current)

```text
.
├─ apps/
│  ├─ server/                  # NestJS backend scaffold
│  │  ├─ src/                  # Current backend source root
│  │  ├─ package.json          # Backend scripts and deps
│  │  └─ tsconfig*.json
│  └─ web/                     # React + Vite frontend scaffold
│     ├─ src/                  # Current frontend source root
│     ├─ public/
│     ├─ package.json          # Frontend scripts and deps
│     └─ vite.config.ts
├─ IMPLEMENTATION_GUIDE.md     # Implementation plan and constraints
├─ schema.prisma               # DB schema source of truth
├─ package.json                # Workspace-level scripts
└─ pnpm-workspace.yaml         # Workspace package boundaries
```

- `apps/server` is the backend workspace package (`name: server`).
- `apps/web` is the frontend workspace package (`name: web`).
- Root package scripts provide dev entrypoints and unified lint/format workflows for workspace packages.
- Existing `dist/` folders are build outputs, not the primary source-edit target.
- Existing `node_modules/` folders are dependency caches and should not be edited.

## Current Implementation Status

- Backend is still mostly the NestJS starter skeleton (`main.ts`, `app.module.ts`) and does not yet implement planned business modules.
- Frontend is still mostly the Vite React starter UI and does not yet implement planned pages.
- `IMPLEMENTATION_GUIDE.md` defines the target platform behavior that is expected to be implemented incrementally in this repo.
- Treat current source tree as a scaffold baseline plus implementation guide as the intended target capability set.
- Runtime artifact folder `artifacts/` is part of planned behavior and may be created during implementation/runtime.
- Current readmes under app workspaces are starter templates and not project-specific guides yet.
- Status snapshot date: `2026-03-04` (refresh this section when major code/tooling baseline changes).

## Capability-to-Location Map (No Speculative Paths)

- Backend runtime and API capabilities (`suites`, `runs`, `cancellations`, `logs`, `report`, `cases`, `statistics`, scheduler, executor, recovery): `apps/server/src`
- Frontend pages and API consumption (`runs list`, `run detail`, `statistics`): `apps/web/src`
- Database structure and indexes: `schema.prisma`
- Runtime artifact output root: `artifacts/` (repo root, created at runtime)
- Rule: keep new implementation files inside these existing roots unless a new root is explicitly approved.

## Critical Project Rules (Minimal Set)

- Use `snake_case` for API fields, database fields, and JSON fields.
- API must expose external resource identifier field name as `id` (string).
- Internal numeric primary keys (`runs.id`, `suites.id`) stay internal and are not exposed directly to frontend consumers.
- Keep dual-ID traceability in diagnostics: logs and `meta.json` should allow mapping between internal ID and external string ID.
- Follow SQLite single-writer discipline in runtime design: avoid parallel write patterns for the same run pipeline.
- Run status, reason, and timing semantics must follow `IMPLEMENTATION_GUIDE.md` definitions.
- Statistics must be derived from structured DB records, with `case_results` as the source for case-level aggregation.
- For `logs` API implementation, finalize pending protocol details in `IMPLEMENTATION_GUIDE.md` section 14.9 before coding and tests.
- `schema.prisma` remains authoritative for model/index definitions; do not treat doc prose as stronger than schema.
- Cancellation semantics and error-body constraints should follow the implementation guide contract.
- For data-shape disagreements, reconcile code to schema before extending API responses.

## Cross-Repo Integration Boundaries

- This platform repo does not host source code for `sut-demo` or `demo-test-lib`.
- Run execution is driven by configured `command` and `cwd` recorded by the platform.
- SUT connectivity and readiness checks are represented by `sut_base_url` and `probe_url`.
- Runtime artifacts are produced and managed from this platform repository side.
- Do not vendor external test-library or SUT source into this repository as part of normal implementation work.
- Cross-repo coupling should remain configuration-driven instead of code-copy-driven.

## Commands (Current Workspace)

Root workspace:

```bash
pnpm dev:web
pnpm dev:server
pnpm lint
pnpm lint:web
pnpm lint:server
pnpm lint:fix
```

- Run root commands from repository root.

Frontend workspace (`web`):

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web preview
```

- Run frontend commands from root or target package context.
- Frontend lint entrypoint is unified at root (`pnpm lint:web` / `pnpm lint:web:fix`); `web` package lint scripts are wrappers.

Backend workspace (`server`):

```bash
pnpm --filter server start:dev
pnpm --filter server build
```

- Run backend commands from root or target package context.
- Backend lint entrypoint is unified at root (`pnpm lint:server` / `pnpm lint:server:fix`); `server` package lint scripts are wrappers.

CI/release workflows:

```bash
.github/workflows/ci.yml
.github/workflows/release.yml
```

- `ci.yml`: PR to `main` runs lint + build gates.
- `release.yml`: tag `v*`/manual dispatch runs verify gate before publish step.

## Quality Gates (Current Decision)

- Daily coding gate (local): `pnpm lint` only.
- Pre-merge gate (GitHub PR): require `.github/workflows/ci.yml` checks to pass.
- Pre-release gate (GitHub release flow): require `.github/workflows/release.yml` verify job to pass before publish.
- Keep branch/ruleset protection aligned with CI checks (at least `CI / lint` and `CI / build`).
- Prisma/DB baseline requirements are defined in `IMPLEMENTATION_GUIDE.md` deferred-baseline section.

## Safe Editing Boundaries

Edit preferred:

- `apps/server/src/**`
- `apps/web/src/**`
- root-level project configs when needed (`package.json`, `pnpm-workspace.yaml`, etc.)
- root-level quality gates and tooling configs (eslint/prettier/hook configs, lint-staged, task scripts)
- Prisma schema and migration assets required by implementation tasks
- `schema.prisma`
- `IMPLEMENTATION_GUIDE.md` (only when intentionally updating plan text)
- workspace config files related to toolchain behavior (`package.json`, eslint/ts/vite/nest configs)

Treat as generated/runtime (not source of truth):

- `node_modules/**`
- `apps/*/node_modules/**`
- `apps/*/dist/**`
- build artifacts and temporary outputs
- runtime artifact outputs unless a task explicitly targets artifact inspection

Editing hygiene:

- Keep edits focused on task-relevant files and avoid broad refactors in scaffold areas.
- Prefer small, traceable diffs that preserve this map's current-vs-target framing.

Minimum verification before handoff:

- `pnpm lint`
- Local daily gate does not require running build commands; build regressions are covered by pre-merge/release CI gates.
- For Prisma/DB-related feature work, follow `IMPLEMENTATION_GUIDE.md` deferred-baseline requirements.

## Priority of Truth

1. Scope-based authority:
   - `schema.prisma`: DB structure, enums, relations, indexes, and migration-facing data shape.
   - `IMPLEMENTATION_GUIDE.md`: runtime behavior, API contracts, process semantics, and operational constraints.
2. workspace and app package scripts/config for what is runnable now.
3. this `AGENTS.md` for navigation and implementation location guidance.

Conflict handling rule:

- Classify conflict scope first:
  - Hard-pause conflicts (must stop affected coding and wait for approval): DB schema/indexes/migrations; API contract shape/status code/error body; run status/reason/timing semantics; cancellation semantics.
  - Soft-pause conflicts (can continue non-conflicting tasks): doc wording, scaffold/layout refactors, non-contract tooling adjustments.
- For hard-pause conflicts, submit a short conflict note before coding continues in the affected scope:
  - conflicting statements with file+line references
  - expected impact/risk if unresolved
  - option A/B and a recommended option
- Apply scope-based authority when proposing options: `schema.prisma` for DB shape; `IMPLEMENTATION_GUIDE.md` for behavior/API; then fallback to runnable scripts/config.
- Wait for explicit user approval before implementing conflict-dependent code and before updating this file.
- After approval, implement the agreed resolution and update this file to restore consistency.
- Do not resolve conflicts by guessing undocumented behavior.
