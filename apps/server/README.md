# server

This package is the backend workspace for the E2E orchestrator. It contains the NestJS server scaffold, Prisma schema, and the database-facing runtime that will incrementally grow into the platform API and execution engine described in `IMPLEMENTATION_GUIDE.md`.

## Current State

- The package is still early-stage. `src/main.ts` and `src/app.module.ts` remain close to the Nest starter baseline.
- The target backend behavior is defined in `../../IMPLEMENTATION_GUIDE.md` and will be implemented incrementally.
- More detailed backend working constraints live in `./AGENTS.md`.

## Key Paths

- `src/`: backend runtime and API source.
- `prisma/schema.prisma`: authoritative database schema.
- `.env`: local `DATABASE_URL` source for Prisma commands.
- `package.json`: backend scripts and package metadata.

## Common Commands

Run these from the repository root unless you intentionally switch into the package directory.

```bash
pnpm --filter server start:dev
pnpm --filter server build
pnpm --filter server lint
pnpm --filter server format:check
pnpm --filter server db:check
pnpm --filter server db:migrate:status
```

## Related Docs

- Repository map and global rules: [`../../AGENTS.md`](../../AGENTS.md)
- Backend-local working rules: [`./AGENTS.md`](./AGENTS.md)
- Runtime behavior and API contract intent: [`../../IMPLEMENTATION_GUIDE.md`](../../IMPLEMENTATION_GUIDE.md)
