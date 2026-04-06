# web

This package is the frontend workspace for the E2E orchestrator. It contains the React + Vite operator UI that talks to the backend API for suites, runs, run detail, cancellation, and failure statistics.

## Current State

- `src/app.tsx` wires the operator routes for `/suites`, `/runs`, `/runs/:id`, and `/statistics/failures`.
- `src/suites-page.tsx` is the default operator entry surface and supports run creation from configured suites.
- `src/runs-page.tsx` shows recorded runs, polls while active runs exist, and exposes cancellation actions.
- `src/run-detail-page.tsx` shows run metadata, artifact presence, result summary, and cancellation entrypoints.
- `src/failure-statistics-page.tsx` renders aggregated failed-case history linked back to run detail.

## Key Paths

- `src/`: frontend application source.
- `src/app.tsx`: top-level router for operator pages.
- `src/operator-navigation.tsx`: shared top-level navigation.
- `package.json`: frontend scripts and package metadata.
- `vite.config.ts`: Vite app configuration.
- `vitest.config.ts`: frontend test configuration.

## Common Commands

Run these from the repository root unless you intentionally switch into the package directory.

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web format:check
```

## Related Docs

- Frontend-local working rules: [`./AGENTS.md`](./AGENTS.md)
