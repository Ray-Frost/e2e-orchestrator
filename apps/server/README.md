# server

This package is the backend workspace for the E2E orchestrator. It contains the NestJS server scaffold, Prisma schema, and the database-facing runtime that will incrementally grow into the platform API and execution engine described in `IMPLEMENTATION_GUIDE.md`.

## Current State

- The package is still early-stage. `src/main.ts` and `src/app.module.ts` remain close to the Nest starter baseline.
- The target backend behavior is defined in `../../IMPLEMENTATION_GUIDE.md` and will be implemented incrementally.
- More detailed backend working constraints live in `./AGENTS.md`.

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

- Repository map and global rules: [`../../AGENTS.md`](../../AGENTS.md)
- Backend-local working rules: [`./AGENTS.md`](./AGENTS.md)
- Runtime behavior and API contract intent: [`../../IMPLEMENTATION_GUIDE.md`](../../IMPLEMENTATION_GUIDE.md)
