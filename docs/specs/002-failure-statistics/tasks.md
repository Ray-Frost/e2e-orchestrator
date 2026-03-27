# Failure Statistics Tasks

Companion docs: [`spec.md`](./spec.md), [`plan.md`](./plan.md)

## Preconditions

- Implement on the current branch without adding backend or frontend runtime
  features outside this slice.
- Keep the work limited to the failures statistics API and page, plus the
  minimal routing and dev-proxy plumbing they need.

## Ordered Tasks

1. Add the backend statistics endpoint and minimal Prisma plumbing in
   `apps/server/src/**`.
   Validation: Nest HTTP tests cover empty, grouped, `run_id` / `id` /
   plain-string `test_lib_case_code` tie-breaks, and recency-first
   `last_failed_at DESC` / `last_run_id DESC` / `test_lib_case_code ASC`
   responses for `GET /api/statistics/failures`.
2. Add the frontend router, redirect, placeholder run route, and failures page
   in `apps/web/src/**`.
   Validation: React Testing Library covers loading, empty, error, populated,
   and link-navigation states.
3. Wire the frontend dev and preview proxy in `apps/web/vite.config.ts` and
   keep API calls relative.
   Validation: dev and preview/build-time configuration resolve `/api/...`
   requests to the server port without adding backend CORS.
4. Re-run the documented verification commands and compare the implemented
   behavior to `spec.md`.
   Validation: confirm the docs and tests still match the locked endpoint,
   route, error shape, and aggregation rules.
