# server

This package is the backend workspace for the E2E orchestrator. It contains the NestJS server, Prisma schema, and the current runtime and API implementation for suites, runs, cancellation, statistics, and run-artifact persistence.

## Current State

- `src/app.module.ts` currently wires the implemented `RunsModule` and `StatisticsModule`.
- The backend currently serves suite listing, run creation, run listing, run detail, run cancellation, and failure-statistics endpoints.
- The `runs` area already includes smoke-suite resolution, scheduler orchestration, probe checks, `results.json` ingest, and artifact-path persistence helpers.
- Package-local working constraints and source-of-truth pointers live in `./AGENTS.md`.

## Key Paths

- `src/`: backend runtime and API source.
- `prisma/schema.prisma`: authoritative database schema.
- `.env`: local backend env source for Prisma commands and backend runtime.
- `package.json`: backend scripts and package metadata.

## Runtime Env

- The backend runtime uses `dotenv` through the standard
  `import 'dotenv/config';` path.
- For local development, `pnpm dev:server` and `pnpm --filter server ...`
  run in the `apps/server` package context, so the default `.env` lookup reads
  `apps/server/.env`.
- Prisma commands in the `server` package also use `apps/server/.env`, so
  `DATABASE_URL` and runtime variables live in one local backend env file.
- For production or any startup that does not run with `apps/server` as the
  working directory, pass an explicit absolute `DOTENV_CONFIG_PATH`.
- Keep the runtime `.env` in standard dotenv format, not shell `export` format.

Example runtime `.env`:

```bash
DATABASE_URL=file:../.data/dev.sqlite
E2E_SMOKE_CWD=/absolute/path/to/demo-test-lib
E2E_SMOKE_COMMAND=npm run test:smoke:platform
E2E_SMOKE_SUT_BASE_URL=http://localhost:3000
```

## Common Commands

Run these from the repository root unless you intentionally switch into the package directory.

```bash
pnpm --filter server start:dev
pnpm --filter server build
pnpm --filter server test
pnpm --filter server lint
pnpm --filter server format:check
pnpm --filter server db:check
pnpm --filter server db:migrate:status
```

## Startup Examples

Local development from the repository root:

```bash
pnpm dev:server
```

Production-style startup with an explicit env-file path:

```bash
DOTENV_CONFIG_PATH=/srv/e2e-orchestrator/apps/server/.env \
node /srv/e2e-orchestrator/apps/server/dist/main.js
```

If the deployed `dist` lives at another path, keep the same
`DOTENV_CONFIG_PATH=/absolute/path/to/server.env` convention and only replace
the `node` entrypoint path.

## Related Docs

- Backend-local working rules: [`./AGENTS.md`](./AGENTS.md)
