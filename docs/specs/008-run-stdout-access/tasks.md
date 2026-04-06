# Run Stdout Access Tasks

Companion docs: [`spec.md`](./spec.md), [`plan.md`](./plan.md)

## Preconditions

- Keep the slice limited to raw stdout access from `/runs/:id`.
- Reuse existing artifact paths and run-detail data instead of redesigning the
  run payload.
- Do not add schema changes, migration assets, stderr access, report access,
  cursor logic, or a new top-level page.
- Treat `spec.md` and `plan.md` as already approved inputs rather than work to
  be recreated during implementation.

## Ordered Tasks

1. Add backend stdout access.
   Validation: backend HTTP tests cover successful full-text reads, empty-file
   reads, missing runs, and missing-artifact `404` responses for
   `GET /api/runs/{id}/stdout`.
2. Add stdout entrypoints to `/runs/:id`.
   Validation: frontend tests cover conditional visibility, lazy stdout
   loading, read-only stdout rendering, and local artifact-access error
   feedback without replacing the ready-state route.
3. Re-run the targeted verification commands once the implementation is in
   place.
   Validation: `pnpm --filter server test`, `pnpm --filter web test`, and
   `pnpm lint` pass with the new artifact-access behavior and tests included.
