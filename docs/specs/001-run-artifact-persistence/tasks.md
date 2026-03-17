# Run Artifact Persistence Tasks

Companion docs: [`spec.md`](./spec.md), [`plan.md`](./plan.md)

## Preconditions

- Implement on the current branch, and ensure it already has the run lifecycle
  core or includes the minimal lifecycle integration points in the same change.
- Do not expand the work into logs API, report serving, results ingest, or
  retention policy.

## Ordered Tasks

1. Create the artifact path helper and root-resolution logic in
   `apps/server/src/runs/artifacts/`.
   Validation: unit test the `artifacts/run-<id>/` layout and child paths.
2. Implement the `meta.json` snapshot builder in
   `apps/server/src/runs/artifacts/`.
   Validation: unit test pre-spawn and terminal snapshots, including `null` for
   values that are not known yet.
3. Implement the filesystem writer service for run directories and
   `meta.json`.
   Validation: temp-directory integration test that checks directory creation,
   required files, idempotent snapshot rewrites, and best-effort cleanup when
   required pre-spawn bootstrap fails partway through.
4. Wire the artifact service into the run execution lifecycle.
   Validation: service-level or integration test covering at least one success
   path, one fail path after runner spawn, and one no-spawn exit that leaves no
   synthetic stdout/stderr files behind.
5. Add failure handling for required artifact bootstrap and structured warnings
   for best-effort `meta.json` writes.
   Validation: failure-path tests prove pre-spawn bootstrap blocks runner start
   and routes to `fail` / `parse_or_write_error`, while `meta.json` write
   failures preserve the DB outcome and emit warnings with `run_id` and, when
   available, `suite_id`.
6. Re-check the implemented layout against `spec.md` before handoff.
   Validation: no drift between code behavior and the documented artifact
   contract.
