# Prisma Schema and Migration Artifacts Location

- Status: Accepted
- Date: 2026-03-05
- Deciders: Platform maintainers

## Context

The repository started with `IMPLEMENTATION_GUIDE.md` and a root-level `schema.prisma` baseline. During later infrastructure setup, the root-level convention was kept. However, historical records emphasize schema source-of-truth semantics more strongly than an immutable root path requirement.

## Decision Drivers

- Align directory ownership with implementation ownership.
- Reduce cross-workspace coupling in day-to-day operations.

## Considered Options

1. Keep Prisma assets under repository-level `prisma/`.
2. Move Prisma assets to `apps/server/prisma` and treat server as owner.
3. Keep current layout temporarily and defer relocation to a future trigger.

## Decision Outcome

Select option 2: move Prisma schema and migrations to `apps/server/prisma`.

This decision keeps source-of-truth governance as a policy while aligning file placement with the current primary implementation owner (`apps/server`).

## Implementation Constraints

- Preserve a single schema source of truth and avoid dual-authoritative schema locations during and after migration.

## Consequences

- A follow-up implementation task must update Prisma command paths in root and server scripts.
- A follow-up implementation task must update path references in `AGENTS.md` and `IMPLEMENTATION_GUIDE.md`.
- Source-of-truth semantics remain mandatory and are enforced by documentation governance rather than root-level placement.
- Existing references to root-level Prisma paths remain temporarily valid only until migration PRs are completed.

## Evidence

- Commit `a6b4732` introduced only two baseline files: `IMPLEMENTATION_GUIDE.md` and `schema.prisma`.
- Commit `b62273c` introduced workspace infrastructure and retained root-level schema reference, but commit message/body does not include an explicit architectural argument that the path must remain root permanently.
- Therefore, historical evidence is strong for "schema is source of truth" and weak for "schema path must be root forever".

## References

- `IMPLEMENTATION_GUIDE.md`
- `AGENTS.md`
- `git show --name-only a6b4732`
- `git show --name-only b62273c`

## Supersedes

None.

## Superseded by

None.
