# RLS Isolation Harness — Plan Brief

> Full plan: `context/changes/testing-rls-isolation-harness/plan.md`
> Research: `context/changes/testing-rls-isolation-harness/research.md`

## What & Why

Stand up a Vitest integration test harness that proves cross-tenant data isolation for all 14 RLS-enabled tables in trAInR. Risk #1 in the test plan — "Trainer A reads or writes Trainer B's data because RLS is the sole enforcement" — is mitigated only by proving isolation with real DB identities, not mocks.

## Starting Point

All 14 tables have RLS enabled with full policy coverage (audited across 10 migrations). Vitest 4.x is wired and `npm run test` runs 6 unit tests in CI. No integration harness, `globalSetup`, DB fixture helpers, or `tests/` directory exists. The Supabase CLI is already in devDependencies.

## Desired End State

A `tests/integration/` suite and `vitest.integration.config.ts` that can be run locally with `npm run test:integration` and in CI via a dedicated `test-integration` job. Every table's SELECT, INSERT, UPDATE, and DELETE isolation between Trainer A and Trainer B is asserted. Known SECURITY DEFINER gaps are documented as labelled test cases. `npm run test` (unit path) is completely untouched.

## Key Decisions Made

| Decision               | Choice                                                       | Why (1 sentence)                                                                                                   | Source   |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------- |
| Test runner            | Vitest integration (TypeScript, `@supabase/supabase-js`)     | Same runner as existing unit tests; JS client mirrors the production auth path exactly — no new tooling            | Plan     |
| File placement         | `tests/integration/` + `vitest.integration.config.ts`        | Keeps integration tests out of `src/` unit glob; separate config avoids any collision with existing `npm run test` | Plan     |
| CI strategy            | Separate `test-integration` job (needs: test)                | Supabase Docker start is slow; isolating it keeps the unit feedback loop fast                                      | Plan     |
| User provisioning      | `auth.admin.createUser` (service_role) in helpers only       | Service_role never appears in test assertions — preserves the invariant that tests mirror production auth          | Research |
| SECURITY DEFINER gaps  | Test and label gaps as "KNOWN GAP"                           | Documents the existing behaviour so a future hardening PR knows exactly what to flip                               | Research |
| Post-removal isolation | Tested in Phase 3 (client_plans) and Phase 4 (session graph) | `20260605120000` tightened policies to require active assignment — this must be verified                           | Research |

## Scope

**In scope:**

- Vitest integration project config + `tests/integration/` directory
- Admin fixture helpers (service_role for setup only, never in assertions)
- All 14 RLS-enabled tables — SELECT, INSERT, UPDATE, DELETE isolation
- `profiles` cross-visibility policy (active assignment path)
- Post-removal access denial (`remove_trainer_client` → trainer loses plan/session access)
- SECURITY DEFINER gap documentation: `replace_exercise_muscle_groups`, `complete_client_invite`
- CI `test-integration` job with Supabase start/stop

**Out of scope:**

- App route authorization tests (Phase 2 of rollout)
- Partial-write failure injection (Phase 3 of rollout)
- Invite expiry/reuse tests (Phase 4 of rollout)
- pgTAP (decision: Vitest for consistency)
- E2e tests (deliberately deferred, `test-plan.md §7`)
- Hardening `replace_exercise_muscle_groups` (separate ticket)

## Architecture / Approach

Each test file creates a fresh, isolated trainer pair via `auth.admin.createUser` (admin client in `helpers/admin.ts`), seeds what it needs, and cleans up in `afterAll`. All assertions use anon-key `@supabase/supabase-js` clients signed in with `signInWithPassword` — the same key and identity chain as production. RLS silently filters unauthorised rows (expect `data: []`, not an error) for SELECT; mutations expect an error or empty affected rows. The CI job uses `supabase/setup-cli` to start a fresh local instance, runs the suite, and always stops Supabase even on failure.

## Phases at a Glance

| Phase                           | What it delivers                                                                              | Key risk                                                                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Harness infrastructure       | Config, env helpers, admin factory, fixture helpers, smoke test                               | Setup tooling is greenfield — `globalSetup` or env loading misconfiguration fails everything                                               |
| 2. Trainer-direct isolation     | `exercises`, `session_templates`, `invite_links`, `exercise_muscle_groups` write side         | Assertions must distinguish RLS empty-result (expected) from a connectivity failure (both return empty)                                    |
| 3. Assignment-bridged isolation | `trainer_clients`, `client_plans`, `template_exercises`, `template_exercise_sets`, `profiles` | `can_access_client_plan` requires active assignment — post-removal scenario must be seeded carefully                                       |
| 4. Session graph + post-removal | `workout_sessions`, `session_exercises`, `set_logs`, `session_comments` end-to-end            | Deep helper chain (`can_access_client_plan` → `can_access_workout_session` → `can_access_session_exercise`) — fixture must seed all layers |
| 5. SECURITY DEFINER + CI        | Gap tests for DEFINER functions, CI `test-integration` job                                    | `supabase/setup-cli` key extraction syntax may need verification against the action's current README                                       |

**Prerequisites:** `npx supabase start` running locally; `.env` populated with the three `INTEGRATION_*` vars from `npx supabase status`.
**Estimated effort:** ~3–4 sessions across 5 phases.

## Open Risks & Assumptions

- `supabase/setup-cli` GitHub Action key extraction syntax (`steps.supabase.outputs.anon_key`) must be verified during Phase 5 — the action's output format may have changed.
- `replace_exercise_muscle_groups` is SECURITY DEFINER without `search_path = public` — behaviour under a non-standard `search_path` is untested; Phase 5 documents the gap but does not fix it.
- The plan assumes `npx supabase start` applies all migrations and `seed.sql` automatically; if the local instance is stale, the fixture helpers may get FK violations — the globalSetup ping check will catch a down instance but not a stale schema.

## Success Criteria (Summary)

- `npm run test:integration` passes all phases on a clean local Supabase instance
- CI `test-integration` job is green and runs independently of the unit test job
- Every table's isolation is proven by at least one SELECT and one mutation assertion with two distinct trainer identities
