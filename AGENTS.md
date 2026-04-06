# AGENTS.md

This document is a project map for contributors and coding agents working in this repository. It explains where things live today, where planned capabilities should be implemented, and which repository-level constraints must be respected while building the E2E platform.

## How to Use This Map

- Use this file first to locate code and decide edit boundaries quickly.
- Use `docs/README.md` as the default entrypoint and canonical root index for repository documentation under `docs/`.
- Use `docs/specs/**` for feature-local planning assets once a slice has been decomposed out of `IMPLEMENTATION_GUIDE.md`. Within a feature directory, `spec.md` owns scope/behavior/acceptance, `plan.md` owns approach/impact/validation, and `tasks.md` is the execution breakdown that must stay consistent with the other two.
- Use `IMPLEMENTATION_GUIDE.md` for platform-wide runtime behavior, workflow, API contract intent, and implementation constraints that have not yet been decomposed into `docs/specs/**`.
- Use `apps/server/prisma/schema.prisma` as the source of truth for database models, enums, relations, and indexes.
- If this file conflicts with those sources, use the conflict handling rule in `Priority of Truth`.
- Read in this order when starting a task: topology -> capability map -> repository rules -> source-of-truth docs.
- Use this file as orientation and repository navigation.

## Repository Topology (Current)

The tree below is intentionally selective. It highlights contributor-relevant roots and notable files, rather than serving as a complete repository listing.

```text
.
├─ .github/
│  └─ workflows/               # GitHub quality gates
│     ├─ ci.yml                # PR gate: lint + build
│     └─ release.yml           # Release gate: verify + publish
├─ apps/
│  ├─ server/                  # Backend workspace package
│  │  ├─ src/                  # Backend source root
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma      # DB schema source of truth
│  │  │  └─ migrations/        # Prisma migration assets
│  │  ├─ README.md             # Backend package guide
│  │  ├─ package.json          # Backend scripts and deps
│  │  └─ tsconfig*.json
│  └─ web/                     # Frontend workspace package
│     ├─ src/                  # Frontend source root
│     ├─ public/
│     ├─ package.json          # Frontend scripts and deps
│     └─ vite.config.ts
├─ docs/                       # Repository documentation subtree (root index: docs/README.md)
│  ├─ process/                 # Contributor workflow and quality-gate docs
│  ├─ design-docs/             # ADRs and architecture history
│  └─ specs/                   # Feature-level planning assets extracted from IMPLEMENTATION_GUIDE.md
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

- Backend now includes implemented `runs` and `statistics` modules rather than only the Nest starter baseline.
- Backend HTTP surfaces currently include `GET /api/suites`, `POST /api/runs`, `GET /api/runs`, `GET /api/runs/{id}`, `POST /api/runs/{id}/cancel`, and `GET /api/statistics/failures`.
- Backend runtime also includes smoke-suite resolution, run scheduling, probe checks, results ingestion, and run-artifact persistence under `apps/server/src/runs/**`.
- Frontend now ships operator pages for `/suites`, `/runs`, `/runs/:id`, and `/statistics/failures` under `apps/web/src`.
- Frontend supports suite-triggered run creation, run-list polling, run cancellation entrypoints, run detail inspection, and failure-statistics browsing.
- Current operating model: a single human maintainer uses coding agents heavily for implementation and review assistance.
- `IMPLEMENTATION_GUIDE.md` defines the target platform behavior that is expected to be implemented incrementally in this repo and is being decomposed into `docs/specs/**` feature plans.
- `docs/` provides the navigation layer for detailed process docs and ADR records without turning this file into a full doc index.
- Runtime artifact folder `apps/server/artifacts/` is used by the implemented run-artifact persistence flow and may be created by runtime execution when missing.
- Status snapshot date: `2026-04-06` (refresh this section when major code or tooling baselines change).

## Capability-to-Location Map (No Speculative Paths)

- Backend runtime and API capabilities (`suites`, `runs`, `cancellations`, `logs`, `report`, `cases`, `statistics`, scheduler, executor, recovery): `apps/server/src`
- Frontend pages and API consumption (`suites`, `runs list`, `run detail`, `failure statistics`): `apps/web/src`
- Database structure and indexes: `apps/server/prisma/schema.prisma`
- Runtime artifact output root: `apps/server/artifacts/` (backend package, created at runtime)

## Repository Rules

- Keep new implementation files inside the existing roots in this map. Add a new root only with explicit approval.
- Treat this root `AGENTS.md` as repository navigation, not as the implementation spec or a detailed `docs/**` index.
- Optimize for a single-maintainer, agent-assisted workflow. Prefer simple, explicit, low-ceremony solutions over team-scaled patterns.
- Do not add abstractions, ownership boundaries, review choreography, or extension points justified mainly by hypothetical future teammates or agent roles.
- Preserve clarity and handoff-readiness through explicit code, small APIs, and focused docs, not through speculative architecture.
- Use explicit scope, constraints, and maintenance tradeoffs for repository decisions. Do not use academic framing.
- Keep external `sut-demo` and `demo-test-lib` source outside this repository. Do not vendor external SUT or test-library source into the platform repo as part of normal implementation work.
- When source authorities conflict or behavior is undocumented, do not guess or silently self-resolve. Use the conflict handling rule in `Priority of Truth`.

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
pnpm --filter server test
pnpm --filter server format:check
pnpm --filter server lint
```

- Run backend commands from root or target package context.
- Backend lint implementation is owned by the `server` package; root `pnpm lint:server` / `pnpm lint:server:fix` remain aggregate entrypoints.
- Backend format implementation is owned by the `server` package; root `pnpm format:check` / `pnpm format:write` remain aggregate entrypoints.

CI and release workflows:

```bash
.github/workflows/ci.yml
.github/workflows/release.yml
```

- `ci.yml`: PR to `main` runs lint + build gates.
- `release.yml`: tag `v*` or manual dispatch runs verify gate before publish.

## Documentation Navigation

- Start docs discovery from `docs/README.md`.
- Use `docs/README.md` for the canonical root `docs/` structure, registered doc areas, and maintenance rules.
- Treat `docs/specs/**` as the home for feature-local planning assets once a capability has been decomposed out of `IMPLEMENTATION_GUIDE.md`.
- Treat `docs/design-docs/**` as the home for ADRs and architecture decision history.
- Keep this file focused on repository navigation and edit boundaries. See `Repository Rules` for scope guardrails.

## Process Requirements

- Follow the repository quality gates before handoff. Use `docs/process/quality-gates.md` for the required checks, exceptions, and DB-gate rules.
- Follow `docs/process/code-style.md` for repository-wide local code-style defaults and naming conventions.
- Follow `docs/process/markdown-style.md` for Markdown writing rules. Keep detailed writing guidance there, not in this file.

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
- `docs/specs/**` when intentionally adding or revising feature-level planning assets
- `docs/process/**` when intentionally updating process or quality-gate documentation
- `docs/design-docs/**` when intentionally adding or revising ADR records and indexes
- workspace config files related to toolchain behavior (`package.json`, eslint/ts/vite/nest configs)

Treat as generated or runtime output:

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
   - `docs/specs/**`: feature-local planning assets for capabilities that have been explicitly decomposed out of `IMPLEMENTATION_GUIDE.md`. Within one feature directory, `spec.md` owns scope/behavior/acceptance, `plan.md` owns implementation approach and validation strategy, and `tasks.md` operationalizes the work without overriding the other two.
   - `IMPLEMENTATION_GUIDE.md`: platform-wide runtime behavior, API contracts, process semantics, and operational constraints that have not yet been decomposed into `docs/specs/**`.
2. Documentation governance and detail docs:
   - `docs/README.md`: canonical root structure and registration rules for the `docs/` subtree.
   - `docs/process/**`: detailed contributor-process and quality-gate rules.
   - `docs/design-docs/**`: ADRs and accepted architecture decision history.
   - These docs are governance and detail references under the scope-based authorities listed above.
3. Workspace and app package scripts or config for what is runnable now.
4. This `AGENTS.md` for repository navigation and implementation location guidance.

Conflict handling rule:

- Classify conflict scope first:
  - Hard-pause conflicts (must stop affected coding and wait for approval): DB schema, indexes, migrations, API contract shape, status code, error body, run status semantics, reason semantics, timing semantics, cancellation semantics.
  - Soft-pause conflicts (can continue non-conflicting tasks): doc wording, scaffold or layout refactors, non-contract tooling adjustments.
- For hard-pause conflicts, submit a short conflict note before coding continues in the affected scope:
  - conflicting statements with file and line references
  - expected impact or risk if unresolved
  - option A and B with a recommended option
- Apply scope-based authority when proposing options: `apps/server/prisma/schema.prisma` for DB shape, then `docs/specs/**` when the affected capability has been decomposed there, then `IMPLEMENTATION_GUIDE.md` for undecomposed behavior and API, then fallback to runnable scripts or config.
- Wait for explicit user approval before implementing conflict-dependent code and before updating this file.
- After approval, implement the agreed resolution and update this file to restore consistency.
