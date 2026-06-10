---
date: 2026-06-07T09:33:00+02:00
researcher: agent
git_commit: 5025f986344bff9152b82f439ea3c1f28ea558b4
branch: m3l1-test-plan
repository: trAInR
topic: "RLS isolation harness — what needs to be tested, how the DB is structured, and what the integration test setup looks like"
tags: [research, rls, supabase, integration-testing, isolation, security]
status: complete
last_updated: 2026-06-07
last_updated_by: agent
---

# Research: RLS Isolation Harness (Phase 1)

**Date**: 2026-06-07T09:33:00+02:00
**Git Commit**: 5025f98
**Branch**: m3l1-test-plan
**Repository**: trAInR

## Research Question

What is the full scope of the RLS isolation harness for Phase 1 (`context/changes/testing-rls-isolation-harness/`)? Specifically:

- What tables and policies need to be covered?
- How is the Supabase client initialized and is `service_role` used anywhere?
- What does the tenant graph look like?
- What does the existing test infrastructure look like, and what is greenfield for Phase 1?
- Are there any SECURITY DEFINER RPCs that bypass RLS and need special attention?

## Summary

All 14 public tables have RLS enabled. The entire app uses a single Supabase SSR client factory with the **anon key only** — `service_role` is absent from `src/`. Tenant isolation is anchored on `auth.uid()` and the `trainer_clients` assignment bridge; downstream tables (`client_plans`, session graph) inherit isolation via helper functions (`is_trainer_for_client`, `can_access_client_plan`, etc.).

The integration test harness is **fully greenfield**: no pgTAP, no Vitest `globalSetup`, no DB fixtures beyond `seed.sql` muscle groups. The local Supabase CLI is already a dev dependency; the harness must stand up two real trainer identities and exercise every table's read/write/delete isolation.

Six `SECURITY DEFINER` functions exist; two have noteworthy security properties that require specific harness attention: `replace_exercise_muscle_groups` (no `auth.uid()` check inside the function body) and `complete_client_invite` (grants `anon` execute but does not verify `p_client_id = auth.uid()`).

## Detailed Findings

### 1. Supabase Client — Key Usage

A single SSR factory is defined at `src/lib/supabase.ts:4-23`. It uses `SUPABASE_KEY` from `astro:env/server`. Every API route and every Astro page calls this factory — no alternate client creation path exists.

- **`service_role` key**: absent from all of `src/`. The only mentions are in docs and test-plan planning files.
- **Auth mechanism**: cookie-based; `createServerClient` from `@supabase/ssr` reads/writes session cookies. No `setSession` or `setAuth` calls anywhere.
- **Env schema** (`astro.config.mjs:17-22`): both `SUPABASE_URL` and `SUPABASE_KEY` are declared `context: "server", access: "secret"` — not available client-side.
- **Implication for harness**: the harness must simulate real authenticated sessions (signed-in users) to trigger cookie-bound RLS. The simplest approach is to use the Supabase JS client with `signInWithPassword` to obtain a session token, then use that token to construct a service client scoped to that user's JWT — OR use `supabase.auth.admin.createUser()` + direct JWT injection via `setAuth` in integration tests.

**Key routes using Supabase** (`src/pages/api/`):

| Route                        | Lines      | Client | Guard                           |
| ---------------------------- | ---------- | ------ | ------------------------------- |
| `exercises/index.ts`         | 21, 52     | anon   | `requireTrainer`                |
| `exercises/[id].ts`          | 27, 70     | anon   | `requireTrainer`                |
| `session-templates/index.ts` | 14, 45     | anon   | `requireTrainer`                |
| `session-templates/[id].ts`  | 27, 70, 99 | anon   | `requireTrainer`                |
| `invites/index.ts`           | 15         | anon   | manual `getUser()` + role check |
| `trainer-clients/[id].ts`    | 22         | anon   | manual `getUser()` + role check |

Service layer (`src/lib/exercises/service.ts`, `src/lib/session-templates/service.ts`) accepts a `SupabaseClient` parameter — they do not create clients independently.

### 2. Tenant Graph & Table Inventory

All 14 public tables have RLS enabled. Isolation flows through two paths:

**Trainer-direct tables** — `trainer_id = auth.uid()` enforced in every operation:

- `exercises` (`src/supabase/migrations/20260526120200_exercise_library.sql:77-100`)
- `session_templates` (`20260526120300_templates_and_plans.sql:34-57`)
- `invite_links` (`20260526120100_trainer_onboarding.sql:123-146`)

**Assignment-bridged tables** — access derived via `is_trainer_for_client()` / `can_access_client_plan()`:

- `trainer_clients` — the primary assignment bridge (`20260526120100_trainer_onboarding.sql:87-113`)
- `client_plans` — holds both `trainer_id` + `client_id`; SELECT for trainer now requires `is_trainer_for_client(client_id)` (tightened in `20260605120000_remove_trainer_client.sql:86-93`)
- `workout_sessions` — access via `can_access_client_plan()` (`20260526120400_sessions_logging_comments.sql:183-187`)
- `session_exercises` — via `can_access_workout_session()` (`:284-288`)
- `set_logs` — via `can_access_session_exercise()` (`:365-369`); client INSERT/UPDATE only (no DELETE grant)
- `session_comments` — via `can_access_workout_session()` (`:434-438`)

**Derived-trainer tables** (ownership via parent join):

- `template_exercises` — owner verified via `session_templates.trainer_id` JOIN (`20260526120300_templates_and_plans.sql:90-160`)
- `template_exercise_sets` — ownership chain via `template_exercises` → `session_templates.trainer_id` (`20260605130000_per_round_template_prescription.sql:62-125`)
- `exercise_muscle_groups` — write policies check `exercises.trainer_id` via EXISTS (`20260526120200_exercise_library.sql:116-161`); SELECT is open to all authenticated

**Global / non-tenant tables**:

- `muscle_groups` — intentional global catalog, SELECT open to all authenticated (`USING true`); no INSERT/UPDATE/DELETE for authenticated

### 3. Full RLS Policy Coverage (post-migration final state)

| Table                    | SELECT                                                    | INSERT                                           | UPDATE                                | DELETE                           |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------ | ------------------------------------- | -------------------------------- |
| `profiles`               | own row + cross-visibility for assigned pairs             | —                                                | own row                               | —                                |
| `trainer_clients`        | trainer side (active only) OR client side                 | trainer only                                     | trainer only                          | —                                |
| `invite_links`           | trainer only                                              | trainer only                                     | trainer only                          | trainer only                     |
| `muscle_groups`          | all authenticated (`USING true`)                          | —                                                | —                                     | —                                |
| `exercises`              | `trainer_id = auth.uid()`                                 | same                                             | same                                  | same                             |
| `exercise_muscle_groups` | all authenticated                                         | trainer (via exercise ownership)                 | trainer (via exercise ownership)      | trainer (via exercise ownership) |
| `session_templates`      | `trainer_id = auth.uid()`                                 | same                                             | same                                  | same                             |
| `template_exercises`     | via `session_templates.trainer_id`                        | same + exercise ownership                        | same                                  | via template ownership           |
| `template_exercise_sets` | via `template_exercises` → `session_templates.trainer_id` | same                                             | same                                  | same                             |
| `client_plans`           | trainer (active assignment) OR client (own history)       | trainer + active assignment                      | trainer + active assignment           | trainer + active assignment      |
| `workout_sessions`       | via `can_access_client_plan()`                            | trainer + active assignment                      | trainer (active) OR client (own plan) | trainer + active assignment      |
| `session_exercises`      | via `can_access_workout_session()`                        | trainer + active assignment + exercise ownership | trainer + active assignment           | trainer + active assignment      |
| `set_logs`               | via `can_access_session_exercise()`                       | client only (+ active assignment)                | client only                           | — (no grant)                     |
| `session_comments`       | via `can_access_workout_session()`                        | own author + session access                      | own author + session access           | own author                       |

### 4. SECURITY DEFINER Functions — Harness Implications

Six functions bypass RLS at the Postgres layer. Each needs specific consideration for the test harness:

| Function                                      | File:lines              | Grants to             | Security concern                                                                                                                                                                                                         |
| --------------------------------------------- | ----------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `handle_new_user()`                           | `20260526120000:77-108` | `supabase_auth_admin` | Trigger — auto-creates profile; safe (signup-only)                                                                                                                                                                       |
| `replace_exercise_muscle_groups(uuid, jsonb)` | `20260529183853:1-22`   | `authenticated`       | **No `auth.uid()` ownership check inside function body.** RLS on `exercise_muscle_groups` bypassed. Relies on app flow to prevent cross-trainer calls. Also not schema-qualified (`public.`) — `search_path` not pinned. |
| `validate_invite_token(text)`                 | `20260604120000:7-40`   | `anon, authenticated` | Intentional anon access; reads `invite_links` + `profiles` safely (returns display name only)                                                                                                                            |
| `complete_client_invite(text, uuid)`          | `20260604120000:49-80`  | `anon, authenticated` | **Does not verify `p_client_id = auth.uid()`.** Relies on caller passing the freshly signed-up user's own UUID. If called with a different UUID by a malicious actor, it would create a fraudulent assignment.           |
| `get_my_assigned_trainer()`                   | `20260604193000:3-31`   | `authenticated`       | Reads `trainer_clients` + `profiles` for `auth.uid()`. Intentional bypass for client dashboard.                                                                                                                          |
| `remove_trainer_client(uuid)`                 | `20260605120000:7-41`   | `authenticated`       | Checks `trainer_id = auth.uid()` inside the function before operating. Safe.                                                                                                                                             |

### 5. Existing Test Infrastructure

**Test runner**: Vitest 4.x (`^4.1.7`), node environment, `include: ["src/**/*.test.ts"]`

**Config file**: `vitest.config.ts:1-14` — no `globalSetup`, no `setupFiles`, no coverage, no pool settings.

**Existing tests (6 files, all unit)**:

| File                                                | What it tests                                    |
| --------------------------------------------------- | ------------------------------------------------ |
| `src/lib/session-templates/schemas.test.ts`         | Zod create/update/id schemas                     |
| `src/lib/session-templates/form-validation.test.ts` | Form helpers (entry factories, payload assembly) |
| `src/lib/exercises/schemas.test.ts`                 | Exercise Zod schemas                             |
| `src/lib/exercises/form-validation.test.ts`         | Exercise form validation                         |
| `src/lib/exercises/filter-url.test.ts`              | URL ↔ filter round-trips                         |
| `src/lib/api/guards.test.ts`                        | `requireTrainer` 401/403/200                     |

No Supabase imports in any test. No shared test utils or fixture helpers. No `vi.mock`.

**CI** (`github/workflows/ci.yml:18-25`): `npm run test` runs between lint and build. Note: `test-plan.md:110` says "CI runs lint + build only today" — this is **stale**, `npm test` is already wired.

**Supabase local** (`supabase/config.toml`):

- DB on port `54322` (`postgres:postgres@127.0.0.1:54322/postgres`)
- API on port `54321`
- Auth `site_url = "http://127.0.0.1:4321"`
- Seed: `seed.sql` inserts 13 muscle groups (idempotent)

**Integration harness — what must be built from scratch**:

- `vitest.config.ts` needs either a new project config or extended `include` glob to pick up integration tests outside `src/`
- A `globalSetup` file to start/stop local Supabase (or assume `npx supabase start` is pre-running)
- A fixture helper to create two trainer users (`auth.admin.createUser`) and seed per-test data
- A test Supabase client that uses real user JWTs (via `auth.setSession` or by calling `signInWithPassword` with test credentials)
- CI must add `supabase start` before `npm test` when integration tests land

## Code References

- `src/lib/supabase.ts:4-23` — single SSR client factory (anon key, cookie-based)
- `src/middleware.ts:11-31` — middleware user resolution via `getUser()`
- `astro.config.mjs:17-22` — env schema (SUPABASE_URL, SUPABASE_KEY as server secrets)
- `vitest.config.ts:1-14` — test runner config (no globalSetup, no setupFiles)
- `supabase/config.toml:27-36` — local DB port 54322
- `supabase/seed.sql:3-18` — muscle groups seed (only existing fixture data)
- `supabase/migrations/20260526120100_trainer_onboarding.sql:44-74` — `is_trainer_for_client()`, `is_assigned_trainer()` helpers
- `supabase/migrations/20260526120400_sessions_logging_comments.sql:8-30` — `can_access_client_plan()` (updated in `20260605120000`)
- `supabase/migrations/20260605120000_remove_trainer_client.sql:53-78` — revised `can_access_client_plan()` requiring active assignment
- `supabase/migrations/20260529183853_replace_muscle_groups_rpc.sql:1-22` — `replace_exercise_muscle_groups` SECURITY DEFINER, no ownership check
- `supabase/migrations/20260604120000_invite_rpcs.sql:49-80` — `complete_client_invite` SECURITY DEFINER, no `auth.uid()` match on `p_client_id`
- `src/lib/api/guards.ts:6-16` — `requireTrainer` guard (reads `context.locals.user` / `role` from middleware)

## Architecture Insights

1. **Single-path isolation**: every route uses the same anon-key factory — there is no service_role bypass in app code. RLS is the sole data-layer enforcement and must be tested at the DB level, not mocked.

2. **Helper function chain for derived tables**: the session graph (`workout_sessions` → `session_exercises` → `set_logs`) relies on `can_access_client_plan` → `can_access_workout_session` → `can_access_session_exercise` SECURITY INVOKER helpers. All are subject to RLS; the chain must be verified end-to-end.

3. **Post-removal tightening**: `20260605120000_remove_trainer_client.sql` tightened trainer SELECT/UPDATE/DELETE on `client_plans`, `workout_sessions`, and `session_exercises` to require an active assignment. The harness must test both: (a) active assignment allows access, (b) after `remove_trainer_client`, access is denied.

4. **`replace_exercise_muscle_groups` gap**: this SECURITY DEFINER function bypasses `exercise_muscle_groups` RLS and has no internal ownership check. The test should confirm that Trainer A cannot call it with Trainer B's exercise ID (the defense is only the app-layer check that the exercise belongs to the calling trainer — but that check lives in the app, not the DB function). This is a risk the harness should document explicitly.

5. **`complete_client_invite` gap**: `p_client_id` is caller-supplied with no `= auth.uid()` enforcement inside the RPC. This is acceptable for the pre-auth signup flow (user doesn't have a session yet when they call it) but should be noted as a precondition the harness cannot close — it's a future hardening candidate.

6. **Template create/update is app-level multi-step**: unlike `remove_trainer_client`, template create/update is NOT wrapped in a single RPC. The service (`src/lib/session-templates/service.ts:65-98`) inserts `session_templates` → `template_exercises` → `template_exercise_sets` as sequential awaits — no DB transaction. This is Risk #2 territory (partial-write corruption), scoped to Phase 3.

## Historical Context (from prior changes)

- `context/archive/2026-05-26-database-schema-and-rls/` — the original schema + RLS implementation; reference for policy intent and the "no service_role in Astro routes" constraint.
- `context/foundation/test-plan.md:40-56` — Risk Map anchoring this phase: Risk #1 (cross-tenant isolation breach), with explicit guidance to verify the anon key is used (not service_role) and to test SECURITY DEFINER RPCs specifically.
- `context/foundation/lessons.md:5-9` — "Deliver copy-paste Supabase Studio SQL for local manual verification" — relevant for pre-harness manual gates in Phase 1.

## Open Questions

1. **Harness placement**: should integration tests live in `src/` (picked up by existing `vitest.config.ts`) or in a top-level `tests/integration/` directory with a separate Vitest project config? The latter avoids `include` glob conflicts and allows a different environment/timeout for DB tests.

2. **User provisioning in tests**: `supabase.auth.admin.createUser` requires a service-role key at test setup time. Is it acceptable to use service_role _only_ in test setup (fixture creation), then test with anon-key clients? This is the standard pgTAP/integration pattern and is consistent with the principle that service_role never appears in app code.

3. **CI Supabase start**: when integration tests land, CI must run `npx supabase start` (slow, requires Docker). Should integration tests be gated behind a separate CI job or a `--project` flag so they don't block the fast lint+unit+build pipeline?

4. **`replace_exercise_muscle_groups` ownership gap**: should the harness include a test that actively tries to call this function with another trainer's exercise ID (to document the missing guard), or only test the happy path and flag as a separate hardening ticket?

5. **pgTAP vs Vitest**: the test plan leaves the choice open to Phase 1 research. Vitest integration tests (using `@supabase/supabase-js` with real user sessions) are more natural given the existing Vitest stack and allow TypeScript fixtures; pgTAP is closer to the DB and catches pure SQL policy bugs without app-layer interference. The key question for the plan: do we need to test policies in isolation from the app client, or is testing via the app client sufficient?
