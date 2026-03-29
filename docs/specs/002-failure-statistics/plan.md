# Failure Statistics Plan

Companion docs: [`spec.md`](./spec.md), [`tasks.md`](./tasks.md)

## Implementation Approach

- Keep the backend implementation small: one shared Prisma service plus a
  focused statistics controller/service path.
- Read the relevant `case_results` rows in one deterministic ordered query, then
  aggregate in application code instead of introducing a repository layer.
- Keep the backend response recency-first and make tie-breakers explicit rather
  than relying on database row order.
- Treat the `test_lib_case_code ASC` tie-breaker as locale-independent plain
  string comparison, not locale-aware collation.
- Keep the frontend routing explicit with `BrowserRouter`, `Routes`, and
  `Route`, and use a simple redirect from `/` to `/statistics/failures`.
- Use a Vite `/api` proxy so the frontend can call relative `/api/...`
  endpoints without adding backend CORS in this slice.
- Keep the `/runs/:id` route as a placeholder only; do not implement run detail
  fetching here.

## Affected Files or Modules

- Backend runtime area: `apps/server/src/**`
- Frontend runtime area: `apps/web/src/**`
- Frontend dev proxy: `apps/web/vite.config.ts`
- Backend Nest app bootstrap for the global `/api` prefix
- Shared Prisma access plumbing in the backend

## DB or Migration Impact

- None.
- Do not add schema changes or migration assets.
- Read existing `case_results` and related run fields only.

## API Impact

- Add `GET /api/statistics/failures`.
- Preserve the existing error shape `{ "error": { "message": "string" } }`.
- Do not add CORS handling in this slice.

## Frontend Impact

- Add the `/statistics/failures` route.
- Add the `/` redirect.
- Add a placeholder `/runs/:id` route.
- Keep all API calls relative so the Vite proxy handles dev and preview traffic.

## Test Strategy

- Backend Nest HTTP tests should cover:
  - empty results,
  - one grouped case code,
  - multiple case code groups,
  - tie resolution by larger `run_id`,
  - latest-row metadata consistency,
  - raw-row ties within one case code resolved by larger `id`,
  - plain-string `test_lib_case_code` tie resolution for punctuation-bearing
    codes,
  - response sorting by `last_failed_at DESC`, then `last_run_id DESC`, then
    `test_lib_case_code ASC`.
- Frontend Vitest plus React Testing Library should cover:
  - loading state,
  - empty state,
  - error state,
  - populated state,
  - `last_run_id` link navigation.

## Verification Commands

- `pnpm --filter server test`
- `pnpm --filter server build`
- `pnpm --filter web build`
- `pnpm lint`
- `pnpm --filter server db:check`
- `pnpm --filter server db:migrate:status`
- If a usable local database is not available, record the DB-gate commands and
  any live seeded-data verification as blocked or maintainer-run instead of
  claiming them as passed.

## Risks and Rollback Notes

- Risk: aggregation drift if the ordered read or tie-break rules are changed
  later.
  Mitigation: keep the sort and grouping rules encoded in tests.
- Risk: the placeholder `/runs/:id` route could be mistaken for full run detail
  support.
  Mitigation: keep its implementation minimal and explicit.
- Rollback: remove the route and API wiring while leaving existing runtime
  behavior unchanged.
