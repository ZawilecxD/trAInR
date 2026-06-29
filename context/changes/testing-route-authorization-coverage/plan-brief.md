# Route Authorization Coverage — Plan Brief

> Full plan: `context/changes/testing-route-authorization-coverage/plan.md`

## What & Why

Prove every protected API route returns 401 (no session) and 403 (wrong role) before any data work. Closes test-plan Risk #3 — the gap between "guard helper has unit tests" and "every route actually calls it."

## Starting Point

22 protected handlers (20 Pattern A via `requireTrainer`/`requireClient`, 2 Pattern B inline in `invites` and `trainer-clients`). Phase 1 integration harness and CI `test-integration` job exist. No route-level auth tests.

## Desired End State

Parametric integration tests driven by a route inventory; `npm run test:integration` enforces 401/403 on all protected handlers; test-plan Phase 2 marked complete with §6.3 cookbook.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Test layer | Handler-level integration (not more guard unit tests) | Cheapest signal per test-plan Risk Response Guidance | Plan |
| Pattern A strategy | Fabricated `locals` only — no DB for negative cases | Guards read `context.locals`; fast and deterministic | Plan |
| Pattern B strategy | Real session cookies via Phase 1 fixtures | Inline guards call `supabase.auth.getUser()` — needs real cookies | Plan |
| Error body assertions | Status codes only (401/403) | Pattern A/B use different error string casing | Plan |
| Inventory | `tests/integration/route-auth/inventory.ts` | Prevents drift when new routes ship | Plan |
| CI change | Add `astro sync` to test-integration job | Route imports need `astro:env/server` resolution | Plan |

## Scope

**In scope:** 22 protected handlers, inventory, helpers, Pattern A + B tests, test-plan §6.3 update, CI astro sync.

**Out of scope:** Refactoring Pattern B to shared guards, middleware tests, e2e, public auth routes.

## Architecture / Approach

`inventory.ts` lists every protected handler. Pattern A tests import handlers directly and pass fabricated `APIContext` with null/wrong-role `locals`. Pattern B tests wire `SUPABASE_URL`/`SUPABASE_KEY` from integration env, build requests with SSR session cookies from `createTrainer()`/`createBareClient()`, and assert 401/403. All tests send invalid payloads to confirm guards run before validation/DB work.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Inventory and harness | `inventory.ts`, `api-context`, env + session helpers | `astro:env/server` import resolution in Vitest |
| 2. Pattern A tests | 20 handler 401/403 + guard-before-data | Inventory drift if routes change |
| 3. Pattern B + closure | 2 inline routes, CI sync, test-plan update | Cookie serialization for SSR client |

**Prerequisites:** Phase 1 harness; local Supabase for full integration run.

## Open Risks & Assumptions

- `astro:env/server` in Vitest requires `astro sync` and env var mapping — verified in Phase 3 CI step.
- Pattern B error messages differ from Pattern A — tests assert status only.

## Success Criteria (Summary)

- All 22 protected handlers return 401 and 403 in integration tests
- `npm run test:integration` green in CI
- Test-plan Phase 2 complete with cookbook pattern documented
