# Quality Gates

This document is the detailed source for repository quality-gate rules.

## Quality Gates

- Local pre-commit gate: run staged-only checks via Git native hook `.githooks/pre-commit` (executes `lint-staged`).
- Hook activation (one-time, repo-local): `git config core.hooksPath .githooks`.
- Hook path verification: `git config --get core.hooksPath` (expected output: `.githooks`).
- Note: `core.hooksPath` is stored in `.git/config` and is not synced with repository files.
- Handoff gate: run `pnpm lint` when staged changes include any non-Markdown files.
- Markdown-only exception: if staged changes are only `*.md`, `pnpm lint` may be skipped before handoff.
- Pre-merge gate (GitHub PR): require `.github/workflows/ci.yml` checks to pass.
- Pre-release gate (GitHub release flow): require `.github/workflows/release.yml` verify job to pass before publish.
- Keep branch/ruleset protection aligned with CI checks (at least `CI / lint` and `CI / build`).
- DB Gate is independent from pre-commit and follows the section below.

## DB Gate (Prisma/DB Feature Work)

- Trigger the full DB Gate in the same feature PR when any of the following happens:
  - `apps/server/prisma/schema.prisma` changes in a way that affects models, fields, relations, enums, defaults, or indexes.
  - Any file under `apps/server/prisma/migrations/**` changes.
  - Application code under `apps/server/src/**` introduces Prisma Client usage.
  - Server DB scripts or `DATABASE_URL` conventions are changed.
- Full DB Gate commands:
  - `pnpm --filter server db:check`
  - `pnpm --filter server db:migrate:status`
  - `pnpm lint`
- Comment-only or documentation-only edits in `apps/server/prisma/schema.prisma` run a reduced DB Gate:
  - `pnpm --filter server db:check`
  - `pnpm lint`
- Schema-shape change add-on requirements:
  - When models, fields, relations, enums, defaults, or indexes change, commit migration assets under `apps/server/prisma/migrations/`.
  - Comment-only or documentation-only edits to `apps/server/prisma/schema.prisma` do not require new migration assets or `db:migrate:status`.
  - Record command outcomes (pass/fail; include reason when failed) in the final handoff note.
- Environment and directory boundary requirements:
  - `DATABASE_URL` is sourced from `apps/server/.env` (example in `apps/server/.env.example`).
  - Local DB files live under `apps/server/.data/`.
  - Migration directory remains `apps/server/prisma/migrations/`.

## Trigger Rules

- If `apps/server/prisma/schema.prisma` is modified for comments or documentation only, gate = `Reduced DB Gate`.
- If `apps/server/prisma/schema.prisma` is modified for schema shape, gate = `Full DB Gate`.
- If any file under `apps/server/prisma/migrations/**` is modified, gate = `Full DB Gate`.
- If new Prisma Client usage is introduced under `apps/server/src/**`, gate = `Full DB Gate`.
- If server DB scripts or the `DATABASE_URL` convention changes, gate = `Full DB Gate`.
- If changes have no DB impact, gate = `No DB Gate`.

## Execution Checklist

1. Determine whether the change triggers the reduced DB Gate or full DB Gate by checking the trigger rules above.
2. Run the command set for the applicable gate (`Reduced DB Gate` or `Full DB Gate`) defined above.
3. If the Prisma schema shape changed (models, fields, relations, enums, defaults, or indexes), commit migration assets under `apps/server/prisma/migrations/`.
4. Record command outcomes (pass/fail; include reason when failed) in the final handoff note.
