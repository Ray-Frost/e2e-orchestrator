# AGENTS.md

This document defines web-local working rules for the `web` package.

## Scope

- Use this file for frontend implementation and package-local documentation in `apps/web`.

## Key Paths

- `apps/web/src`: frontend source root.
- `apps/web/package.json`: frontend package scripts and package metadata.
- `apps/web/vite.config.ts`: Vite app configuration.
- `apps/web/vitest.config.ts`: frontend test configuration.

## Web Commands

Run these from the repository root unless a package context is explicit.

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web format:check
```

## Web Rules

- Use lowercase kebab-case for locally authored source filenames under `apps/web/src`.
- React component, hook, and type names may stay PascalCase or camelCase inside kebab-case files when that matches TypeScript and React conventions.
- Keep established suffix patterns when they apply, such as `.test.tsx`.
