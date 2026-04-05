# Run Cancel Tasks

Companion docs: [`spec.md`](./spec.md), [`plan.md`](./plan.md)

## Preconditions

- Keep the slice limited to run cancellation and the two existing operator
  entrypoints on `/runs` and `/runs/:id`.
- Reuse the current runs module, scheduler, and page data sources as the
  starting point.
- Do not add schema changes, migration assets, or new top-level pages.
- Treat `spec.md` and `plan.md` as already approved inputs rather than work to
  be recreated during implementation.

## Ordered Tasks

1. Add the backend cancel endpoint plus empty-request validation.
   Validation: backend HTTP tests cover invalid path input, missing runs,
   terminal reruns, and rejection of non-empty payloads while preserving the
   locked error body.
2. Implement `pending` and `running` cancel semantics inside the runs service
   and scheduler.
   Validation: backend tests prove queued runs are removed before execution,
   running runs stop the active runner plus any child processes, and successful
   cancellation persists `cancelled / user_cancelled` with the expected timing
   behavior.
3. Add cancel controls to `/runs` and `/runs/:id`.
   Validation: frontend tests cover active-run-only visibility, native
   confirmation, in-flight disabling, immediate refetch after success, and
   local action-error feedback without losing ready-state content.
4. Re-run the targeted verification commands once the implementation is in
   place.
   Validation: `pnpm --filter server test`, `pnpm --filter web test`, and
   `pnpm lint` pass with the cancel behavior and tests included.
