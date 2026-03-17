# docs

This file is the default entrypoint and canonical root index for repository documentation that lives under `docs/`.

## Scope

- `docs/` stores navigation, feature plans, process docs, and ADRs.
- Keep this file focused on the root `docs/` structure, registered areas, and maintenance rules.
- Do not expand this file into a duplicate of implementation-specific documents elsewhere in the repository.

## Current Doc Areas

- `process/`: contributor workflow, quality gates, handoff procedures, and Markdown writing rules.
  Entry files: [`process/quality-gates.md`](./process/quality-gates.md), [`process/code-style.md`](./process/code-style.md), [`process/markdown-style.md`](./process/markdown-style.md), [`process/implementation-guide-decomposition.md`](./process/implementation-guide-decomposition.md)
- `design-docs/`: Architecture Decision Records (ADRs) and architecture history.
  Entry files: [`design-docs/README.md`](./design-docs/README.md), [`design-docs/index.md`](./design-docs/index.md)
- `specs/`: feature-level planning assets extracted from `IMPLEMENTATION_GUIDE.md`.
  Entry file: [`specs/README.md`](./specs/README.md)

## Root Rules

1. Add new stable documentation areas under `docs/` only when they represent an ongoing category, not a one-off note.
2. Register every new root docs area in this file.
3. Provide at least one entry file or canonical target for each registered area.
4. Subdirectories may use `README.md` plus `index.md` only when navigation and governance need to be separated.

## Update Guidance

- Update this file when the root `docs/` structure, best browsing path, or registration rules change.
- Keep detailed process rules in `docs/process/**`, not here.
- Keep ADR-specific governance in `docs/design-docs/index.md`, not here.
