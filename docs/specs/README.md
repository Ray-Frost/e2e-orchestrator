# Feature Specs

This directory stores feature-level planning assets extracted from
`IMPLEMENTATION_GUIDE.md`.

## Usage

- Use one subdirectory per independently scoped feature slice.
- Keep `spec.md`, `plan.md`, and `tasks.md` together for each feature.
- `spec.md` owns scope, behavior, acceptance criteria, and blocking open
  questions.
- Keep `spec.md` feature-facing: do not put extraction history, migration
  notes, or coding-thread guidance in the spec body.
- `plan.md` owns implementation approach, affected areas, validation strategy,
  and risks.
- `tasks.md` is the default implementation handoff for coding threads and must
  stay consistent with `spec.md` and `plan.md`; if task wording drifts, follow
  `spec.md` first, then `plan.md`.
- Add `contracts.md` only when a feature later needs a separate long-lived
  contract file, such as a stable API or file-format reference. Current specs
  do not require it.
- After a feature is migrated here, shrink the duplicated planning detail in
  `IMPLEMENTATION_GUIDE.md` and leave a pointer back to the spec directory.

## Current Specs

- [`001-run-artifact-persistence/`](./001-run-artifact-persistence/):
  runtime artifact directory layout and `meta.json` persistence behavior for
  runs.
- [`002-failure-statistics/`](./002-failure-statistics/): backend
  `GET /api/statistics/failures` aggregation and the frontend
  `/statistics/failures` page.
