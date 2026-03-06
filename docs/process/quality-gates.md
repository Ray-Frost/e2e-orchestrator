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

- Trigger this gate in the same feature PR when any of the following happens:
  - `apps/server/prisma/schema.prisma` changes.
  - Any file under `apps/server/prisma/migrations/**` changes.
  - Application code under `apps/server/src/**` introduces Prisma Client usage.
  - Server DB scripts or `DATABASE_URL` conventions are changed.
- Required commands for triggered PRs:
  - `pnpm --filter server db:check`
  - `pnpm --filter server db:migrate:status`
  - `pnpm lint`
- Schema-change add-on requirements:
  - Commit migration assets under `apps/server/prisma/migrations/`.
  - Record command outcomes (pass/fail; include reason when failed) in the final handoff note.
- Environment and directory boundary requirements:
  - `DATABASE_URL` is sourced from `apps/server/.env` (example in `apps/server/.env.example`).
  - Local DB files live under `apps/server/.data/`.
  - Migration directory remains `apps/server/prisma/migrations/`.

## Trigger Matrix

| Change in feature PR                                   | Trigger DB Gate |
| ------------------------------------------------------ | --------------- |
| `apps/server/prisma/schema.prisma` modified            | Yes             |
| Any `apps/server/prisma/migrations/**` file modified   | Yes             |
| New Prisma Client usage under `apps/server/src/**`     | Yes             |
| Server DB scripts or `DATABASE_URL` convention changed | Yes             |
| Other changes with no DB impact                        | No              |

## Execution Checklist

1. Determine whether DB Gate is triggered by checking the trigger matrix above.
2. If triggered, run:
   - `pnpm --filter server db:check`
   - `pnpm --filter server db:migrate:status`
   - `pnpm lint`
3. If schema changed, commit migration assets under `apps/server/prisma/migrations/`.
4. Record command outcomes (pass/fail; include reason when failed) in the final handoff note.
