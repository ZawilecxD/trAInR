# Route Authorization Coverage — Plan Brief

> Full plan: `context/changes/testing-route-authorization-coverage/plan.md`
> Research: ZAW-44 plus `context/foundation/test-plan.md` §2, §3, §6.3

## What & Why

This change implements test-plan rollout phase 2: protected API route authorization coverage. The risk is that a route can drift away from the shared guard helpers and accidentally allow unauthenticated or wrong-role callers, even though the guard helpers themselves have unit tests.

## Starting Point

`src/lib/api/guards.test.ts` proves `requireTrainer` and `requireClient` return 401/403/ok correctly, but no test imports API route handlers to prove each route actually calls a guard. The protected route inventory contains 21 guard-helper handlers plus two inline trainer-only routes.

## Desired End State

Every protected API handler returns 401 for no session and 403 for the wrong role before protected data work happens. The tests are part of the normal Vitest unit gate, and `context/foundation/test-plan.md` explains the route-auth pattern for future endpoints.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Test layer | Handler-level Vitest tests | The risk is route wiring, so direct handler imports are the cheapest useful signal. | Test plan / Plan |
| Route inventory | Explicit table in one test file | ZAW-44 requires an enumerated protected-route inventory, not assumptions. | Linear / Plan |
| Guard-helper failure proof | Mock `createClient` and assert it is not called | This proves auth rejection happens before Supabase or service work. | Research / Plan |
| Inline auth routes | Test with dedicated Supabase mocks | These routes do not use `context.locals` guards and intentionally call `createClient` first. | Research / Plan |
| CI gate | Standard `npm run test` plus lint/check/build | CI already runs unit tests before lint/check/build; no new dependency is needed. | Repo / Plan |

## Scope

**In scope:**

- 401/403 tests for all 21 guard-helper protected handlers.
- 401/403 tests for `POST /api/invites` and `DELETE /api/trainer-clients/:id`.
- Assertions that protected data work is not reached on auth failure.
- Test-plan cookbook/status updates for rollout phase 2.

**Out of scope:**

- Browser E2E coverage.
- Real Supabase/RLS assertions.
- Refactoring inline routes unless required to make coverage viable.
- New production dependencies.

## Architecture / Approach

A single table-driven Vitest file under `src/pages/api/` imports the route handlers, fabricates minimal `APIContext` values, and controls `@/lib/supabase` through Vitest mocks. Guard-helper routes assert `createClient` is not called; inline routes use mocked `auth.getUser()` and profile lookups to prove 401/403 happen before invite insert or trainer-client RPC work.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Guard-helper route authorization matrix | Shared handler-test helper and 21 guard-helper route entries | Import/mocking setup must not mask data access before auth failure |
| 2. Inline route coverage and test-plan cookbook | Inline trainer-route tests plus master test-plan updates | Inline routes use a different auth/error shape than guard-helper routes |

**Prerequisites:** Existing Vitest setup and route handlers importable under the `@` alias.
**Estimated effort:** Small, focused test-suite addition across route handlers and test-plan docs.

## Open Risks & Assumptions

- Handler imports may need an `astro:env/server` or `@/lib/supabase` mock because `src/lib/supabase.ts` imports Astro virtual env.
- Inline routes currently use capitalized error strings; tests should document current behavior rather than silently normalizing it.

## Success Criteria (Summary)

- Every protected API handler has 401 and 403 coverage.
- Tests prove auth failure occurs before Supabase/service mutation work.
- `npm run test`, `npm run lint`, `npm run check`, and `npm run build` pass.
