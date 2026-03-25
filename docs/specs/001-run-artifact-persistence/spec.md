# Run Artifact Persistence

Companion docs: [`plan.md`](./plan.md), [`tasks.md`](./tasks.md)

## Purpose

- Define the run artifact persistence slice extracted from
  `IMPLEMENTATION_GUIDE.md`.
- Give future coding threads a bounded implementation target for filesystem
  artifact layout and `meta.json` persistence.
- Keep debugging and post-run inspection possible without re-reading the macro
  guide.

## Source Extraction

- Extracted from `IMPLEMENTATION_GUIDE.md` section 8, implementation step 12.5,
  and decision section 13.5.

## Why This Feature Exists Now

- The implementation guide already contains stable rules for artifact layout and
  `meta.json`.
- This slice is independent enough to plan separately and is a prerequisite for
  later artifact-access, logs, report, and recovery work.
- Moving it out of the guide reduces future planning overlap.

## Scope

- Backend-local artifact output under `apps/server/artifacts/`, following the
  current `IMPLEMENTATION_GUIDE.md` requirement for backend-owned runtime
  artifacts.
- Deterministic per-run directory derivation from `run_id`.
- Required and optional artifact names inside a run directory.
- `meta.json` schema version 1 and write/update rules.
- DB-versus-`meta.json` authority rules for the fields covered by this feature.
- Structured warning behavior when `meta.json` persistence fails.
- Runtime hooks needed to create and update artifact files during run
  execution.

## Out of Scope

- HTTP serving or download of artifact files.
- `GET /api/runs/{id}/logs/stdout` and its cursor protocol.
- `GET /api/runs/{id}/report` transport behavior.
- Parsing `results.json` into `case_results`.
- Artifact cleanup or retention policy.
- Scheduler, cancellation, timeout, or recovery logic beyond providing the
  lifecycle hooks and inputs this feature needs.

## Inherited Constraints

- Use the backend-local `apps/server/artifacts/` directory.
- Use numeric `run_id` and `suite_id` consistently across filesystem snapshots
  and diagnostics.
- Keep `snake_case` for JSON keys.
- Treat the database as authoritative for identity, status, reason, timing, and
  summary fields.
- If a DB value and `meta.json` disagree, readers must trust the DB.
- Persist `meta.json` after DB writes on a best-effort basis; a `meta.json`
  write failure must not roll back DB state or change the run terminal status.
- Keep the implementation single-machine and low-dependency.

## Runtime Behavior

### Artifact Directory

- Each run uses one deterministic directory:
  `apps/server/artifacts/run-<run_id>/`.
- The directory is derived from `run_id` only. Do not store a separate artifact
  index in the database or in another manifest file.
- The run directory may be created lazily when the run is about to start
  execution. Runs that never leave `pending` do not need an artifact directory.

### Expected Artifact Layout

- Required paths once execution has started:
  - `stdout.log`
  - `stderr.log`
  - `meta.json`
- Conditionally present paths:
  - `results.json`
  - `playwright-report/`
  - `test-results/`
- Later features may expose these paths through APIs, but this feature only
  defines how they are written and named.

### `meta.json` Contents

- `meta_schema_version`
- `identity.run { id }`
- `identity.suite { id, suite_name_snapshot }`
- `execution { command, cwd }`
- `config { sut_base_url, probe_url }`
- `result { status, reason, exit_code, timeout_minutes }`
- `timing { created_at, start_time, end_time, duration_ms }`
- `process { runner_pgid, started_at, platform_pid }`
- Use `meta_schema_version = 1` for the first implementation.
- `platform_pid` records which platform server process launched or was managing
  the run, so restart-recovery logic and diagnostics can reason about stale
  process metadata.
- When a field value is not yet known at the time of a write, store `null`
  rather than inventing a placeholder value.

### Write Lifecycle

- When a run is about to spawn the runner, perform artifact bootstrap in this
  order:
  - ensure the run directory exists;
  - prepare the `stdout.log` and `stderr.log` targets that the executor will
    stream into;
  - write the first `meta.json` snapshot on a best-effort basis using the
    current DB-backed run state plus the available process context.
- Stream stdout and stderr directly into `stdout.log` and `stderr.log` during
  execution after the required bootstrap steps have succeeded.
- After the run reaches a terminal DB state and required DB-side updates are
  committed, rewrite `meta.json` with the final result and timing fields.
- If no runner process is ever spawned, do not create synthetic log files just
  to satisfy the layout.

### Failure Semantics

- Failure to create the run directory or prepare stdout/stderr targets before
  spawn is a fatal pre-spawn error. In that case, the runner must not start and
  the run should terminate through the existing `fail` /
  `parse_or_write_error` path.
- When pre-spawn artifact bootstrap fails after creating partial filesystem
  state, the implementation should attempt best-effort cleanup of the new empty
  files or directory before finalizing the run.
- `meta.json` persistence follows `DB -> meta(best-effort)`.
- Both the initial and terminal `meta.json` writes are best-effort. A
  `meta.json` write failure records a structured warning and keeps the DB state
  unchanged.
- Structured warnings for this slice use `run_id` and `suite_id` when resource
  context is needed.
- Later consumers must tolerate missing optional artifacts even when
  `meta.json` exists.

## Acceptance Criteria

- A run that reaches `running` or any terminal state after spawning a runner has
  a deterministic artifact directory under
  `apps/server/artifacts/run-<id>/`.
- The directory contains `stdout.log`, `stderr.log`, and `meta.json` when a
  runner process was spawned.
- `meta.json` uses schema version `1` and the expected top-level sections.
- Final `meta.json` content reflects the final DB result fields without becoming
  the authority over them.
- If required artifact bootstrap fails before spawn, the runner does not start,
  the run exits through the existing `fail` / `parse_or_write_error` path, and
  no synthetic stdout/stderr files are left behind.
- A `meta.json` write failure only emits a warning and does not roll back or
  mutate persisted DB state.
- The implementation does not add DB schema changes, migration assets, or an
  artifact index.

## Open Questions

- None for this feature slice.
- Artifact HTTP access, report delivery, and retention policy stay in separate
  future feature specs.
