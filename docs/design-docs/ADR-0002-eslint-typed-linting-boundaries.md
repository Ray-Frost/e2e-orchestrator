# ESLint Typed-Linting Boundaries in Monorepo

- Status: Accepted
- Date: 2026-03-06
- Deciders: Platform maintainers

## Context

Two typed-linting failures were discovered during local/VSCode ESLint runs:

- Problem 1 (app source files): `apps/web/src/App.tsx` intermittently failed with `@typescript-eslint/await-thenable` missing type information, depending on execution cwd.
- Problem 2 (ESLint config files): all four config files (`eslint.config.mjs`, `eslint.shared.mjs`, `apps/web/eslint.config.js`, `apps/server/eslint.config.mjs`) reported `was not found by the project service` from line 1 in editor diagnostics.

These errors came from type-aware rules being applied where TypeScript project resolution was either unstable (cwd-sensitive file matching) or not desirable (tooling config files).

## Decision Drivers

- Ensure deterministic lint behavior across CLI and VSCode working-directory differences.
- Keep type-aware linting for application code where it adds value.
- Eliminate noisy false-positive editor failures on tooling config files.
- Keep configuration ownership aligned with package boundaries (`apps/web`, `apps/server`).

## Considered Options

1. Keep one root monorepo config and expand broad glob fallback patterns (for example `**/*`) plus `allowDefaultProject`.
2. Split lint config ownership by package (`web` and `server`), use `basePath` for source-file matching, and disable type-checked rules for ESLint config files.
3. Disable type-aware linting globally to avoid project-service issues entirely.

## Decision Outcome

Select option 2.

Adopt per-package ESLint config ownership for app code and preserve type-aware linting there. For ESLint configuration files themselves, explicitly disable type-checked rule sets (`typescript-eslint` disable-type-checked config) so project service is not required.

This addresses both discovered problems without weakening typed linting for production source files.

Implementation is further normalized through shared helpers in `eslint.shared.mjs` so root defaults and tooling-file untyped behavior are defined once and reused by the root, web, and server ESLint entrypoints.
Lint script ownership also follows the same boundary: `web` and `server` packages own their concrete lint commands, while the root package keeps aggregate orchestration commands and root-level tooling lint.
Prettier format script ownership follows the same split for app files: `web` and `server` packages own package-local format commands, while the root package keeps aggregate format commands and formatting for root-level tooling files.

## Implementation Constraints

- `apps/web` and `apps/server` source linting must use package-local config with `basePath: import.meta.dirname`.
- Type-aware linting remains enabled for app source and server source paths.
- ESLint config files must not depend on `projectService`; they must use disable-type-checked behavior.
- Root tooling lint commands must include both `eslint.config.mjs` and `eslint.shared.mjs`.
- Shared helper functions should remain the source of truth for common ESLint config defaults and tooling-file untyped behavior unless a package-specific exception is required.
- App-package lint implementation should live in the corresponding workspace package, while the root package should only orchestrate workspace and tooling lint entrypoints.
- App-package format implementation should live in the corresponding workspace package, while the root package should orchestrate workspace format commands and retain formatting for root-owned files.

## Consequences

- Positive:
  - Cwd differences no longer change whether typed lint applies to app source.
  - VSCode diagnostics for config files are stable and no longer fail at file start due to project-service lookup.
  - Ownership is clearer: each package maintains its own runtime/source lint rules.
  - Repeated disable-type-checked merge logic is centralized, reducing configuration drift across ESLint entrypoints.
  - Script ownership now matches config ownership, reducing root-level coupling when package lint targets change.
  - Format command ownership now follows the same package/root split, reducing root-level coupling when app file scopes change.
- Negative:
  - Package configs still carry some duplication for source-specific file scopes and environment settings.
  - Tooling config files no longer receive type-aware lint rules by design.
- Migration and compatibility impacts (required):
  - Existing lint scripts keep their command shape; internal config behavior changed only.
  - Any future config files added under `apps/*/eslint.config.*` should follow the same disable-type-checked convention unless explicitly justified.

## Evidence

- Reproduced typed-lint parser failure for `apps/web/src/App.tsx` when lint was executed from package cwd with config-level file matching that did not bind type info.
- Reproduced project-service discovery errors from line 1 for all ESLint config files in editor-equivalent lint runs.
- Verified after changes:
  - direct lint runs for app source from root and package cwd succeed,
  - direct lint runs for all ESLint config files succeed,
  - `pnpm lint` succeeds.
- Refactored repeated root-default and tooling untyped configuration into shared helpers without changing lint behavior.

## References

- `eslint.config.mjs`
- `eslint.shared.mjs`
- `apps/web/eslint.config.js`
- `apps/server/eslint.config.mjs`
- `package.json`
- `apps/web/package.json`
- `apps/server/package.json`
- `tsconfig.tools.json`
- `docs/design-docs/index.md`

## Supersedes

None.

## Superseded by

None.
