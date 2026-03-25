# Run Artifact Persistence Plan

Companion docs: [`spec.md`](./spec.md), [`tasks.md`](./tasks.md)

## Implementation Approach

- Introduce a small artifact area under `apps/server/src/runs/` and keep the
  split minimal: path derivation, `meta.json` snapshot assembly, and filesystem
  writes.
- Use plain Node.js `fs/promises` and `path`. Do not add a storage abstraction
  layer or new dependency for this feature.
- Centralize artifact-root resolution in one place so later runtime changes do
  not scatter `process.cwd()` assumptions across the codebase.
- Call the artifact service from exactly two points in the run pipeline so its
  responsibility stays narrow:
  - before runner spawn, it prepares the run directory, stdout/stderr targets,
    and the initial best-effort `meta.json` snapshot;
  - after terminal DB commit, it rewrites `meta.json` from the authoritative DB
    state.
- Keep HTTP artifact access out of scope. This slice owns persistence only.

## Preconditions

- Implement this plan on the current branch, and ensure the work either already
  has or co-implements a run lifecycle path with:
  - one integration point before runner spawn, so artifact bootstrap can
    prepare stdout/stderr targets and the initial snapshot;
  - one integration point after terminal DB commit, so final `meta.json`
    reflects the authoritative run state;
  - and the process context needed for `runner_pgid` and `platform_pid`.
- Do not expand this feature into logs API, report serving, or results ingest.

## Affected Files or Modules

- Future runtime area: `apps/server/src/runs/**`
- Proposed new files:
  - `apps/server/src/runs/artifact-persistence/artifact-paths.ts`
  - `apps/server/src/runs/artifact-persistence/meta-snapshot.ts`
  - `apps/server/src/runs/artifact-persistence/run-artifacts.service.ts`
  - `apps/server/src/runs/artifact-persistence/*.spec.ts`
- Likely integration points once the run lifecycle module exists:
  - run execution service
  - terminalization or result-finalization logic
  - recovery readers only if later work needs to inspect persisted `meta.json`

## DB or Migration Impact

- None.
- No Prisma schema change.
- No migration assets.
- Read existing `runs` fields only.

## API Impact

- No new public endpoint in this slice.
- Preserve future compatibility with `GET /api/runs/{id}` artifact exposure and
  report access by keeping path names stable.
- Do not add artifact URLs or HTTP handlers here unless another feature
  explicitly absorbs them.

## Artifact or Runtime Impact

- Runtime creates `apps/server/artifacts/` on demand. This plan is inheriting
  the current `IMPLEMENTATION_GUIDE.md` requirement that backend runtime
  artifacts live inside the server package, not re-deciding that location here.
- Each run directory is isolated under `run-<id>`.
- The executor points stdout and stderr file handles at deterministic paths
  resolved by the artifact service.
- Failure to prepare those required file targets blocks runner spawn and routes
  the run through the existing `fail` / `parse_or_write_error` path.
- `meta.json` rewrite happens after DB updates. Warning logs capture write
  failures without mutating run result semantics.

## Test Strategy

- Unit tests for path derivation and stable file naming.
- Unit tests for snapshot mapping from DB-backed run state to `meta.json`.
- Integration test with a temporary artifact root verifying:
  - running snapshot creation,
  - terminal snapshot overwrite,
  - optional artifacts remaining absent until produced,
  - no synthetic stdout/stderr files for probe failures or other no-spawn
    exits.
- Failure-path test where `meta.json` writing throws and the caller observes a
  preserved DB outcome plus a structured warning.
- Failure-path test where pre-spawn artifact bootstrap fails and the caller
  observes blocked spawn plus best-effort cleanup of partial filesystem state.

## Risks and Rollback Notes

- Risk: artifact-root resolution drifts between dev and build execution
  contexts.
  Mitigation: keep path resolution in one service and avoid inline path joins in
  callers.
- Risk: `meta.json` becomes stale if terminal rewrite is skipped.
  Mitigation: keep the final write in the explicit run-finalization path.
- Risk: later artifact-access features depend on undocumented file shape.
  Mitigation: treat the directory layout and top-level `meta.json` sections in
  `spec.md` as the stable contract for this slice.
- Rollback: if the implementation causes issues, disable the new artifact
  writer integration points while keeping DB behavior unchanged. No migration
  rollback is required.
