# AGENTS.md

This document is a project map for contributors and coding agents working in this repository. It explains where things live today, where planned capabilities should be implemented (without inventing new directory templates), and which constraints must be respected while building the E2E platform.

## How to Use This Map

- Use this file first to locate code and decide edit boundaries quickly.
- Use `docs/README.md` as the default entrypoint and canonical root index for repository documentation under `docs/`.
- Use `IMPLEMENTATION_GUIDE.md` for detailed behavior, workflow, API contract intent, and implementation constraints.
- Use `apps/server/prisma/schema.prisma` as the source of truth for database models, enums, relations, and indexes.
- If this file conflicts with those two sources, use the conflict handling rule in `Priority of Truth`.
- Read in this order when starting a task: topology -> capability map -> rules -> source-of-truth docs.
- Use this file as orientation and repository navigation.

## Repository Topology (Current)

The tree below is intentionally selective. It highlights contributor-relevant roots and notable files, rather than serving as a complete repository listing.

```text
.
├─ .github/
│  └─ workflows/             # GitHub quality gates
│     ├─ ci.yml              # PR gate: lint + build
│     └─ release.yml         # Release gate: verify + publish
├─ apps/
│  ├─ server/                  # NestJS backend scaffold
│  │  ├─ src/                  # Current backend source root
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma      # DB schema source of truth
│  │  │  └─ migrations/        # Prisma migration assets
│  │  ├─ package.json          # Backend scripts and deps
│  │  └─ tsconfig*.json
│  └─ web/                     # React + Vite frontend scaffold
│     ├─ src/                  # Current frontend source root
│     ├─ public/
│     ├─ package.json          # Frontend scripts and deps
│     └─ vite.config.ts
├─ docs/                       # Repository documentation subtree (root index: docs/README.md)
├─ IMPLEMENTATION_GUIDE.md     # Implementation plan and constraints
├─ package.json                # Workspace-level scripts
└─ pnpm-workspace.yaml         # Workspace package boundaries
```

- `apps/server` is the backend workspace package (`name: server`).
- `apps/web` is the frontend workspace package (`name: web`).
- `docs/README.md` is the root entrypoint and canonical index for documentation stored under `docs/`.
- Root package scripts provide dev entrypoints and unified lint/format workflows for workspace packages.
- Existing `dist/` folders are build outputs.
- Existing `node_modules/` folders are dependency caches.

## Current Implementation Status

- Backend is still mostly the NestJS starter skeleton (`main.ts`, `app.module.ts`) and does not yet implement planned business modules.
- Frontend is still mostly the Vite React starter UI and does not yet implement planned pages.
- Current operating model: a single human maintainer uses coding agents heavily for implementation and review assistance.
- `IMPLEMENTATION_GUIDE.md` defines the target platform behavior that is expected to be implemented incrementally in this repo.
- `docs/` now provides the navigation layer for detailed process docs and ADR records without turning this file into a full doc index.
- Treat current source tree as a scaffold baseline plus implementation guide as the intended target capability set.
- Runtime artifact folder `artifacts/` is part of planned behavior and may be created during implementation/runtime.
- Current readmes under app workspaces are starter templates and not project-specific guides yet.
- Status snapshot date: `2026-03-04` (refresh this section when major code/tooling baseline changes).

## Capability-to-Location Map (No Speculative Paths)

- Backend runtime and API capabilities (`suites`, `runs`, `cancellations`, `logs`, `report`, `cases`, `statistics`, scheduler, executor, recovery): `apps/server/src`
- Frontend pages and API consumption (`runs list`, `run detail`, `statistics`): `apps/web/src`
- Database structure and indexes: `apps/server/prisma/schema.prisma`
- Runtime artifact output root: `artifacts/` (repo root, created at runtime)

## Constraints

- Keep new implementation files inside the existing roots in this map. Add a new root only with explicit approval.
- Treat `AGENTS.md` as repository navigation, not as the implementation spec or a detailed `docs/**` index.
- Optimize for a single-maintainer, agent-assisted workflow. Prefer simple, explicit, low-ceremony solutions over team-scaled patterns.
- Do not add abstractions, ownership boundaries, review choreography, or extension points justified mainly by hypothetical future teammates or agent roles.
- Preserve clarity and handoff-readiness through explicit code, small APIs, and focused docs, not through speculative architecture.
- Use explicit scope, constraints, and maintenance tradeoffs for repository decisions. Do not use academic framing.
- Keep runtime design within SQLite single-writer discipline. Avoid parallel write patterns for the same run pipeline.
- Keep external `sut-demo` and `demo-test-lib` source outside this repository. Do not vendor external SUT or test-library source into the platform repo as part of normal implementation work.
- When source authorities conflict or behavior is undocumented, do not guess or silently self-resolve. Use the conflict handling rule in `Priority of Truth`.

## Critical Project Rules (Minimal Set)

- Use `snake_case` for API fields, database fields, and JSON fields.
- API must expose resource identifier field name as `id` (number).
- Numeric primary keys (`runs.id`, `suites.id`) are exposed directly as resource IDs.
- Use `run_id` / `suite_id` consistently in diagnostics and `meta.json` when resource-specific naming is needed.
- Run status, reason, and timing semantics must follow `IMPLEMENTATION_GUIDE.md` definitions.
- Statistics must be derived from structured DB records, with `case_results` as the source for case-level aggregation.
- For `logs` API implementation, finalize pending protocol details in `IMPLEMENTATION_GUIDE.md` section 13.8 before coding and tests.
- Treat `apps/server/prisma/schema.prisma` as authoritative for model/index definitions.
- Use `apps/server/.env` as the `DATABASE_URL` source for server Prisma commands.
- Cancellation semantics and error-body constraints should follow the implementation guide contract.
- For data-shape disagreements, reconcile code to schema before extending API responses.

## Cross-Repo Integration Boundaries

- This platform repo covers platform code, runtime artifacts, and execution metadata.
- Run execution is driven by configured `command` and `cwd` recorded by the platform.
- SUT connectivity and readiness checks are represented by `sut_base_url` and `probe_url`.
- Runtime artifacts are produced and managed from this platform repository side.
- Cross-repo coupling should remain configuration-driven instead of code-copy-driven.

## Commands (Current Workspace)

Root workspace:

```bash
pnpm dev:web
pnpm dev:server
pnpm lint
pnpm format:check
pnpm lint:web
pnpm lint:server
pnpm lint:fix
```

- Run root commands from repository root.

Frontend workspace (`web`):

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web format:check
pnpm --filter web lint
pnpm --filter web preview
```

- Run frontend commands from root or target package context.
- Frontend lint implementation is owned by the `web` package; root `pnpm lint:web` / `pnpm lint:web:fix` remain aggregate entrypoints.
- Frontend format implementation is owned by the `web` package; root `pnpm format:check` / `pnpm format:write` remain aggregate entrypoints.

Backend workspace (`server`):

```bash
pnpm --filter server start:dev
pnpm --filter server build
pnpm --filter server format:check
pnpm --filter server lint
```

- Run backend commands from root or target package context.
- Backend lint implementation is owned by the `server` package; root `pnpm lint:server` / `pnpm lint:server:fix` remain aggregate entrypoints.
- Backend format implementation is owned by the `server` package; root `pnpm format:check` / `pnpm format:write` remain aggregate entrypoints.

CI/release workflows:

```bash
.github/workflows/ci.yml
.github/workflows/release.yml
```

- `ci.yml`: PR to `main` runs lint + build gates.
- `release.yml`: tag `v*`/manual dispatch runs verify gate before publish step.

## Documentation Navigation

- Start docs discovery from `docs/README.md`.
- Use `docs/README.md` for the canonical root `docs/` structure, registered doc areas, and maintenance rules.
- Treat `docs/design-docs/**` as the home for ADRs and architecture decision history.
- Keep this file focused on repository navigation and edit boundaries. See `Constraints` for scope guardrails.

## Process Requirements

- Follow the repository quality gates before handoff. Use `docs/process/quality-gates.md` for the required checks, exceptions, and DB-gate rules.

## Safe Editing Boundaries

Edit preferred:

- `apps/server/src/**`
- `apps/web/src/**`
- root-level project configs when needed (`package.json`, `pnpm-workspace.yaml`, etc.)
- root-level quality gates and tooling configs (eslint/prettier/hook configs, lint-staged, task scripts)
- Prisma schema and migration assets required by implementation tasks
- `apps/server/prisma/schema.prisma`
- `IMPLEMENTATION_GUIDE.md` (only when intentionally updating plan text)
- `docs/README.md` when updating the root docs navigation model
- `docs/process/**` when intentionally updating process or quality-gate documentation
- `docs/design-docs/**` when intentionally adding or revising ADR records and indexes
- workspace config files related to toolchain behavior (`package.json`, eslint/ts/vite/nest configs)

Treat as generated/runtime (not source of truth):

- `node_modules/**`
- `apps/*/node_modules/**`
- `apps/*/dist/**`
- build artifacts and temporary outputs
- runtime artifact outputs unless a task explicitly targets artifact inspection

Editing hygiene:

- Keep edits focused on task-relevant files.
- Prefer small, traceable diffs that preserve this map's current-vs-target framing.

## Priority of Truth

1. Scope-based authority:
   - `apps/server/prisma/schema.prisma`: DB structure, enums, relations, indexes, and migration-facing data shape.
   - `IMPLEMENTATION_GUIDE.md`: runtime behavior, API contracts, process semantics, and operational constraints.
2. Documentation governance and detail docs:
   - `docs/README.md`: canonical root structure and registration rules for the `docs/` subtree.
   - `docs/process/**`: detailed contributor-process and quality-gate rules.
   - `docs/design-docs/**`: ADRs and accepted architecture decision history.
   - These docs are governance and detail references under the scope-based authorities listed above.
3. workspace and app package scripts/config for what is runnable now.
4. this `AGENTS.md` for navigation and implementation location guidance.

Conflict handling rule:

- Classify conflict scope first:
  - Hard-pause conflicts (must stop affected coding and wait for approval): DB schema/indexes/migrations; API contract shape/status code/error body; run status/reason/timing semantics; cancellation semantics.
  - Soft-pause conflicts (can continue non-conflicting tasks): doc wording, scaffold/layout refactors, non-contract tooling adjustments.
- For hard-pause conflicts, submit a short conflict note before coding continues in the affected scope:
  - conflicting statements with file+line references
  - expected impact/risk if unresolved
  - option A/B and a recommended option
- Apply scope-based authority when proposing options: `apps/server/prisma/schema.prisma` for DB shape; `IMPLEMENTATION_GUIDE.md` for behavior/API; then fallback to runnable scripts/config.
- Wait for explicit user approval before implementing conflict-dependent code and before updating this file.
- After approval, implement the agreed resolution and update this file to restore consistency.
