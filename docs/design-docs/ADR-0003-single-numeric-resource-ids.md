# Single Numeric Resource IDs

- Status: Accepted
- Date: 2026-03-16
- Deciders: Project maintainers

## Context

The project previously planned a dual-ID model: SQLite autoincrement primary keys would stay internal, while the API would expose derived external string IDs with signature verification, versioning, and key rotation.

That design was defined before the runtime and API features were implemented. The repository is still at scaffold stage, and the project scope is intentionally narrow: single-machine deployment, low external dependencies, and no complex authorization or multi-tenant requirements.

We need a simpler identifier policy that matches the actual scope and unblocks the implementation order.

## Decision Drivers

- Minimize implementation and operational cost for the current project scope.
- Align identifier design with the documented single-machine, low-dependency scope.
- Keep API contracts, diagnostics, and artifact conventions easy to understand and implement.
- Preserve straightforward SQLite relations and artifact path derivation without adding extra signing or rotation machinery.

## Considered Options

1. Expose a single numeric ID end-to-end.
2. Store a public UUID alongside the internal integer primary key.
3. Keep the derived and signed dual-ID protocol.

## Decision Outcome

We will expose a single numeric resource ID.

The existing SQLite autoincrement primary keys (`runs.id`, `suites.id`) remain the only resource identifiers and are exposed directly through the API.

This option wins because it removes the highest-cost part of the original plan while preserving the simplest possible data model and implementation path.

## Implementation Constraints

- API and JSON contracts use numeric identifiers for `id`, `suite_id`, and `last_run_id`.
- URL path params remain decimal strings at the HTTP layer, but are parsed as numeric IDs by the server.
- Invalid ID format returns `400`; a valid numeric ID that does not exist returns `404`.
- `POST /api/runs` uses `suite_id: number` in the request body.
- Artifact paths, `meta.json`, and structured diagnostics use the same single-ID model; when resource-specific naming is needed, use `run_id` and `suite_id`.

## Consequences

- Positive impacts:
  - Removes crypto, key rotation, and signature validation from the critical path.
  - Keeps API and runtime planning aligned with the project's actual scope.
  - Simplifies future implementation threads for runs, suites, artifacts, and statistics.
- Negative impacts:
  - Public API resource IDs are now coupled to the database primary keys.
  - Moving to opaque public IDs later would require a documented breaking-change strategy.
- Migration and compatibility impacts:
  - No Prisma schema shape change or migration is required in this decision branch.
  - Normative docs and repo rules must be updated together so the repository no longer contains conflicting identifier guidance.

## Evidence

- The implementation guide defines single-machine deployment, low external dependency, and no complex authorization or multi-tenant scope.
- The earlier dual-ID plan added signature validation and key rotation before any runtime feature implementation.
- The repository is still scaffold-first, so this decision can be adopted before runtime compatibility costs appear.

## References

- `IMPLEMENTATION_GUIDE.md`
- `AGENTS.md`
- `apps/server/prisma/schema.prisma`
- `docs/process/quality-gates.md`

## Supersedes

- None.

## Superseded by

- None.
