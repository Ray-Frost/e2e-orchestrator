# Runs Page Tasks

Companion docs: [`spec.md`](./spec.md), [`plan.md`](./plan.md)

## Preconditions

- Keep the slice limited to the runs page, peer-route navigation, and the
  existing `GET /api/runs` list contract.

## Ordered Tasks

1. Add the `/runs` page route and peer-route navigation without changing the
   backend contract.
   Validation: frontend route tests cover `/runs`, peer navigation, and
   detail links while `/` still redirects to `/suites`.
2. Render the runs page from the existing `GET /api/runs` data source.
   Validation: frontend tests cover loading, empty, error, and ready states,
   and the ready state shows the locked run-summary fields plus
   `/runs/:id` links.
3. Implement low-concurrency automatic polling for active runs.
   Validation: frontend tests prove polling starts only when active runs are
   present, keeps one in-flight request at a time, preserves the last ready
   list through a transient polling failure, and stops after terminalization.
4. Re-run the required verification after the page behavior and tests are in
   place.
   Validation: `pnpm lint` passes, and any additional targeted web checks
   needed by the implementation also pass.
