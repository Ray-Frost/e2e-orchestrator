# Run Cancel Plan

Companion docs: [`spec.md`](./spec.md), [`tasks.md`](./tasks.md)

## Implementation Approach

- Keep the backend work inside the existing runs module instead of creating a
  second run-control module. Extend the current controller, service, scheduler,
  and HTTP integration tests in `apps/server/src/runs/**`.
- Add one explicit action endpoint, `POST /api/runs/{id}/cancel`, rather than
  widening `POST /api/runs`, overloading `GET /api/runs/{id}`, or introducing
  a generic mutable `PATCH /api/runs/{id}` contract.
- Split cancellation responsibilities along the current boundaries:
  - controller: path parsing plus empty-request validation;
  - runs service: run lookup, terminal-state validation, and the DB updates
    needed for cancelling a queued run;
  - scheduler: ownership of queued run ids, the active runner process, and the
    runtime path for cancelling a currently running run.
- Keep `pending` cancellation lightweight by removing the run from the in-memory
  queue and writing the final cancelled state in the database. Preserve the
  existing execution guard where a queued item is reloaded before execution and
  skipped if it is no longer `pending`.
- Extend the scheduler with explicit active-run cancellation coordination for
  `running` runs. The scheduler should own any in-memory marker needed to
  distinguish user-driven cancellation from timeout or normal runner exit while
  avoiding a new persisted intermediate status.
- Reuse the existing runner-termination path instead of adding a second
  stop mechanism just for cancel.
- Keep the frontend implementation local to `apps/web/src/runs-page.tsx` and
  `apps/web/src/run-detail-page.tsx`, following the current fetch/state
  patterns already used on those pages.
- Use immediate post-success refetch of the current page data instead of an
  optimistic UI update, so the existing list/detail contracts remain the source
  of truth for the refreshed status.

## Affected Files or Modules

- `apps/server/src/runs/runs.controller.ts`
- `apps/server/src/runs/runs.service.ts`
- `apps/server/src/runs/runs.types.ts`
- `apps/server/src/runs/run-scheduler.service.ts`
- `apps/server/src/runs/runs.http.spec.ts`
- `apps/web/src/runs-page.tsx`
- `apps/web/src/run-detail-page.tsx`
- `apps/web/src/app.test.tsx`
- `apps/web/src/app.css`
- `docs/specs/007-run-cancel/**`
- `docs/specs/README.md`
- `IMPLEMENTATION_GUIDE.md`

## DB or Migration Impact

- None.
- Do not add schema changes or migration assets.
- Reuse the existing `run_status=cancelled` enum value and current run summary
  fields.

## API Impact

- Add `POST /api/runs/{id}/cancel`.
- Keep the request action-empty; reject non-empty payloads with the existing
  `400` error shape.
- Return `404` when the run does not exist.
- Return `400` when the run is already terminal or otherwise no longer
  cancelable.
- Return the updated run summary on success so the frontend can reuse the
  existing run-summary field set.
- Leave `GET /api/runs` and `GET /api/runs/{id}` unchanged as the frontend's
  page data sources.

## Runtime Impact

- Pending cancellation removes queued work before it reaches execution.
- Running cancellation stops the active runner and its child processes, then
  suppresses follow-on normal terminalization once the cancel path has won the
  race.
- The implementation must not create an artifact directory only because a run
  was cancelled while still pending.
- Existing active-run polling on `/runs` and `/runs/:id` stays in place; the
  frontend only adds an immediate refetch after successful cancellation.

## Key Technical Decisions

- Keep one cancel action endpoint instead of a generic mutable run endpoint.
- Do not introduce a persisted `cancelling` state; the feature resolves
  directly to `cancelled` when cancellation wins.
- Let the scheduler remain the owner of queue/runtime coordination so queue
  removal and process termination stay next to the existing execution logic.
- Treat frontend cancel actions as non-optimistic mutations. The refreshed list
  or detail response remains the source of truth for the page after success.
- Keep cancel failures local to the action surface instead of collapsing the
  entire page back into a blocking route-level error state.

## Open Questions

### Resolved During Planning

- Should the slice cover `/suites` too?
  Resolution: no. Limit operator entrypoints to `/runs` and `/runs/:id`.
- Which run states are cancelable?
  Resolution: `pending` and `running` only.
- How should the frontend confirm the action?
  Resolution: use the native browser confirmation flow.

### Deferred to Implementation

- Exact wording for the local action-error copy can be finalized during
  implementation as long as it stays readable and non-structured.
- Final placement and styling of the cancel controls can be decided during
  implementation as long as they remain scoped to active runs only.

## Test Strategy

- Extend backend HTTP coverage for:
  - successful cancellation of `pending` runs;
  - successful cancellation of `running` runs;
  - rejection of terminal reruns with `400`;
  - `404` for missing runs;
  - rejection of non-empty payloads;
  - queue removal for cancelled pending work;
  - terminal-state consistency when cancel races with the normal completion
    path.
- Extend frontend route tests for:
  - cancel controls shown only for active runs on `/runs`;
  - cancel control shown only for active runs on `/runs/:id`;
  - native confirmation gating the request;
  - in-flight button disabling;
  - immediate refetch after success;
  - local action-error rendering without losing ready-state content.

## Risks and Rollback Notes

- Risk: cancel and natural completion race into conflicting terminal writes.
  Mitigation: keep one winning terminalization path and suppress any second
  terminal write.
- Risk: a cancelled queued run could still execute if queue removal and
  pre-execution guards drift apart.
  Mitigation: remove the queued id eagerly and preserve the existing reload
  guard before execution starts.
- Risk: frontend mutation feedback could blank the page on action failure.
  Mitigation: scope cancel errors to local action UI and keep current page data
  visible.
- Rollback: remove the cancel endpoint and page controls while leaving the
  existing read-only runs surfaces intact.
