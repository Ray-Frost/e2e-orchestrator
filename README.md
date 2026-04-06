# E2E Orchestrator

E2E Orchestrator is a small single-maintainer platform for running and
observing smoke-style end-to-end test runs.

It provides:

- a NestJS + Prisma backend for suite discovery, run execution, cancellation,
  artifact persistence, and failure statistics
- a React + Vite operator UI for `/suites`, `/runs`, `/runs/:id`, and
  `/statistics/failures`
- a documentation layout that keeps feature scope, process rules, and ADRs in
  separate places

## Current Product Surface

Backend API:

- `GET /api/suites`
- `POST /api/runs`
- `GET /api/runs`
- `GET /api/runs/{id}`
- `POST /api/runs/{id}/cancel`
- `GET /api/runs/{id}/stdout`
- `GET /api/statistics/failures`

Frontend routes:

- `/suites`
- `/runs`
- `/runs/:id`
- `/statistics/failures`

## Repository Layout

```text
.
├─ apps/
│  ├─ server/      # NestJS backend, Prisma schema, run execution runtime
│  └─ web/         # React operator UI
├─ docs/
│  ├─ process/     # contributor workflow and quality gates
│  ├─ design-docs/ # ADRs and architecture history
│  └─ specs/       # feature-scoped planning and behavior docs
├─ AGENTS.md       # repository map and coding rules
├─ package.json    # workspace scripts
└─ pnpm-workspace.yaml
```

## Quick Start

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Prepare backend env:

   ```bash
   cp apps/server/.env.example apps/server/.env
   ```

3. Update `apps/server/.env` for your local setup:
   - `DATABASE_URL`
   - `E2E_SMOKE_CWD`
   - `E2E_SMOKE_COMMAND`
   - `E2E_SMOKE_SUT_BASE_URL`

4. Start the backend:

   ```bash
   pnpm dev:server
   ```

5. Start the frontend in another terminal:

   ```bash
   pnpm dev:web
   ```

The backend expects the configured SUT and smoke test workspace to be available
locally. This repository does not vendor the external SUT or test library.

## Common Commands

From the repository root:

```bash
pnpm dev:web
pnpm dev:server
pnpm lint
pnpm format:check
pnpm lint:web
pnpm lint:server
```

Package-specific commands:

```bash
pnpm --filter server test
pnpm --filter server build
pnpm --filter server db:check
pnpm --filter web test
pnpm --filter web build
```

## Documentation Map

- `docs/README.md`: root index for the `docs/` tree
- `docs/specs/README.md`: feature-scoped specs, plans, and task breakdowns
- `docs/process/quality-gates.md`: validation requirements before handoff
- `docs/process/code-style.md`: repository code-style defaults
- `docs/design-docs/README.md`: architecture decision records
- `apps/server/README.md`: backend-specific runtime notes
- `apps/web/README.md`: frontend-specific notes

## Working Style

- Keep solutions simple, explicit, and production-friendly.
- Prefer scoped feature docs over monolithic planning documents.
- Treat `apps/server/prisma/schema.prisma` as the database source of truth.
- Use `AGENTS.md` when you need repository navigation or edit-boundary rules.
