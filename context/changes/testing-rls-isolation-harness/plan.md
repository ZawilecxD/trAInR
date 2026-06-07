# RLS Isolation Harness — Implementation Plan

## Overview

Stand up a Vitest integration test harness that proves cross-tenant data isolation for all 14 RLS-enabled tables in trAInR. "Trainer A ≠ Trainer B" must hold for every SELECT, INSERT, UPDATE, and DELETE path, including derived and assignment-bridged tables and all SECURITY DEFINER RPCs.

This is Phase 1 of the four-phase test rollout described in `context/foundation/test-plan.md`. The harness conventions it establishes — project config, fixture helpers, user provisioning pattern, CI job — are reused by Phases 2–4.

## Current State Analysis

All 14 public tables have RLS enabled and every operation is covered by at least one policy. The app uses a single anon-key `@supabase/ssr` client factory (`src/lib/supabase.ts:4–23`); `service_role` is absent from all of `src/`. Vitest 4.x is installed and `npm run test` runs 6 unit tests in CI — but no integration harness, `globalSetup`, DB fixture helpers, or `tests/` directory exists yet.

### Key Discoveries

- All 14 tables have RLS enabled; policies documented in `context/changes/testing-rls-isolation-harness/research.md`
- No service_role client anywhere in `src/` — isolation is tested purely via anon-key sessions (matches production exactly)
- Supabase CLI (`supabase ^2.23.4`) is already a devDependency; local DB runs on port `54322`, API on `54321` (`supabase/config.toml:27-36`)
- `@supabase/supabase-js ^2.99.1` is a runtime dependency — available for integration test clients without new installs
- `vitest.config.ts` currently points to `src/**/*.test.ts` only — a separate integration config avoids any collision with existing unit tests
- Session graph isolation chain: `can_access_client_plan` → `can_access_workout_session` → `can_access_session_exercise` (all SECURITY INVOKER, tested end-to-end via the JS client)
- `replace_exercise_muscle_groups` is SECURITY DEFINER with no `auth.uid()` ownership check — a deliberate gap to document
- `complete_client_invite` grants `anon` execute but does not verify `p_client_id = auth.uid()`

## Desired End State

A `tests/integration/rls/` test suite and supporting helpers that:
1. Can be run locally against a `npx supabase start` instance with `npm run test:integration`
2. Covers all 14 tables: SELECT, INSERT, UPDATE, and DELETE isolation between two trainer identities, plus client-side access where applicable
3. Covers SECURITY DEFINER RPCs — expected behavior and documented gaps
4. Is gated by a new CI job (`test-integration`) that starts Supabase, runs the suite, stops it
5. Leaves `npm run test` (unit path) untouched in timing and scope

### Key Discoveries

- `tests/integration/helpers/admin.ts` must use service_role for user provisioning — this is the ONLY place service_role appears, never in test assertions
- Each test file creates its own isolated trainer pair and cleans up in `afterAll` — no shared mutable fixture state between files
- `.env.example` must be updated with the three integration env vars so new developers know what to add

## What We're NOT Doing

- **No pgTAP** — Vitest integration tests using the JS client mirror the production auth path; pgTAP would require a separate runner and would not exercise the same identity-binding chain
- **No app route tests** — Phase 2 of the rollout; the harness built here will be reused
- **No partial-write failure injection** — Phase 3 of the rollout
- **No invite expiry/reuse tests** — Phase 4 of the rollout
- **No e2e tests** — deliberately deferred per `test-plan.md §7`
- **Not testing `set_logs` DELETE** — no GRANT exists; there is nothing to test
- **Not hardening `replace_exercise_muscle_groups`** — the plan documents and tests the existing gap; fixing it is a separate hardening ticket

## Implementation Approach

Vitest integration tests using `@supabase/supabase-js` with real user JWT sessions. A separate `vitest.integration.config.ts` points to `tests/integration/**/*.test.ts` with a `globalSetup` file. `npm run test:integration` runs only integration tests; `npm run test` (unit path) is unchanged.

User provisioning uses `supabase.auth.admin.createUser` (service_role admin client) **in helpers only**, never in test assertions. Test assertions always use an anon-key client signed in with `signInWithPassword`. This mirrors the production path exactly — the same key, the same cookie-bound identity resolution, the same RLS enforcement.

Each test file is self-contained: it creates a fresh trainer pair (and clients when needed) in `beforeAll`, seeds the rows it needs, runs its assertions, and cleans up in `afterAll`. No shared mutable state between files.

## Critical Implementation Details

**Service-role key is used only in `tests/integration/helpers/admin.ts`** — never imported in test files. Any file under `tests/integration/rls/` or `tests/integration/security-definer/` must only hold anon-key clients obtained via `signInWithPassword`. This boundary is the key invariant of the harness; violating it would make the tests meaningless as isolation probes.

**`can_access_client_plan` was replaced in migration `20260605120000`** — the current version requires an active `trainer_clients` assignment for trainer SELECT access. Tests that seed a `client_plans` row but no active `trainer_clients` row will return empty (not an error) for the trainer — assert `.data` is empty, not that an error was thrown.

**Vitest's default `testTimeout` (5 s) is too short for DB round-trips.** `vitest.integration.config.ts` must set `testTimeout: 30_000` and `hookTimeout: 60_000`.

---

## Phase 1: Harness Infrastructure

### Overview

Wire the integration test project config, env helpers, admin client factory, fixture helpers, and a smoke test that confirms the harness can connect and provision a trainer.

### Changes Required

#### 1. Integration Vitest config

**File**: `vitest.integration.config.ts`

**Intent**: Separate Vitest project for integration tests; does not affect the existing unit config or `npm run test`.

**Contract**: `environment: "node"`, `include: ["tests/integration/**/*.test.ts"]`, `globalSetup: ["tests/integration/setup.ts"]`, `testTimeout: 30_000`, `hookTimeout: 60_000`, `resolve.alias` `@` → `./src` (same as unit config).

#### 2. `test:integration` script

**File**: `package.json`

**Intent**: Add a script that runs only integration tests; keep `test` pointing at unit tests only.

**Contract**: `"test:integration": "vitest run --config vitest.integration.config.ts"`. No changes to the existing `"test"` script.

#### 3. Env helper

**File**: `tests/integration/helpers/env.ts`

**Intent**: Centralise the three integration env vars with a startup-time validation that gives a clear error message if any are missing — prevents silent `undefined` keys reaching test assertions.

**Contract**:
```ts
export const SUPABASE_URL = process.env.INTEGRATION_SUPABASE_URL
export const SUPABASE_ANON_KEY = process.env.INTEGRATION_SUPABASE_ANON_KEY
export const SUPABASE_SERVICE_ROLE_KEY = process.env.INTEGRATION_SUPABASE_SERVICE_ROLE_KEY

export function assertEnv() {
  const missing = ['INTEGRATION_SUPABASE_URL', 'INTEGRATION_SUPABASE_ANON_KEY', 'INTEGRATION_SUPABASE_SERVICE_ROLE_KEY']
    .filter(k => !process.env[k])
  if (missing.length) throw new Error(`Integration env vars missing: ${missing.join(', ')}`)
}
```

#### 4. Admin client helper

**File**: `tests/integration/helpers/admin.ts`

**Intent**: Provide a pre-configured service-role Supabase client for use **only** in test fixture setup (creating/deleting test users). Never imported in test assertion files.

**Contract**: `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` from `@supabase/supabase-js`. Export both the client and a `deleteUser(id)` helper for `afterAll` teardown.

#### 5. Trainer fixture factory

**File**: `tests/integration/helpers/fixtures.ts`

**Intent**: Provide typed factory functions for creating test trainer/client users and linking them. Each factory call creates a unique user (email derived from `crypto.randomUUID()`) so test files don't collide.

**Contract**:
```ts
// All functions use the admin client internally; callers get back:
// { id, email, password, client: SupabaseClient }
// where `client` is an anon-key instance already signed in as this user

export async function createTrainer(): Promise<TestUser>
export async function createClient_(trainer: TestUser): Promise<TestUser>
// createClient_ links the client to trainer via the trainer's client
// by inserting a trainer_clients row directly (admin bypass) so
// RLS tests start from a known clean assignment state

export async function deleteUser(id: string): Promise<void>
```

The returned `client` in each `TestUser` is an anon-key Supabase client (`SUPABASE_ANON_KEY`) that has already called `signInWithPassword` — this is the client test assertions must use.

#### 6. Global setup

**File**: `tests/integration/setup.ts`

**Intent**: Validate env vars before any test runs; optionally ping the DB to give a clear "Supabase is not running" error instead of a cryptic connection timeout.

**Contract**: Export a `setup()` function (Vitest `globalSetup` convention). Call `assertEnv()` from env helper. Make one admin `from("muscle_groups").select("count")` to confirm DB is reachable; throw with `npx supabase start` instructions if it fails.

#### 7. Env example update

**File**: `.env.example`

**Intent**: Document the three integration env vars so new developers know what to add. Values point to the local Supabase defaults.

**Contract**: Append:
```
# Integration tests (requires `npx supabase start`)
INTEGRATION_SUPABASE_URL=http://localhost:54321
INTEGRATION_SUPABASE_ANON_KEY=<anon key from `npx supabase status`>
INTEGRATION_SUPABASE_SERVICE_ROLE_KEY=<service_role key from `npx supabase status`>
```

#### 8. Smoke test

**File**: `tests/integration/smoke.test.ts`

**Intent**: Confirm the harness wires up correctly — admin can provision a trainer, trainer can sign in, trainer can read their own exercises (empty list), trainer can't read without a session.

**Contract**: `describe("smoke")` with three `it` blocks: (a) admin can call `auth.admin.listUsers()`, (b) a provisioned trainer's anon-key client returns an authenticated `getUser()`, (c) an unauthenticated client gets no rows from `exercises`. Cleanup `afterAll`.

### Success Criteria

#### Automated Verification

- `npm run test:integration` exits 0 with the smoke test passing (requires `npx supabase start` first)
- `npm run test` still passes (6 unit tests, unchanged)
- `npm run lint` passes on all new files

#### Manual Verification

- Running `npm run test:integration` without the env vars set prints a clear error naming the missing variables
- Running without `npx supabase start` first prints a clear "Supabase is not running" message
- `npx supabase start && npm run test:integration` passes on a fresh clone

---

## Phase 2: Trainer-Direct Table Isolation

### Overview

Prove that Trainer A's rows in `exercises`, `session_templates`, `invite_links`, and `exercise_muscle_groups` (write side) are invisible and immutable to Trainer B in every supported operation.

### Changes Required

#### 1. Exercises isolation test

**File**: `tests/integration/rls/exercises.test.ts`

**Intent**: Assert that Trainer B cannot SELECT, UPDATE, or DELETE Trainer A's exercises, and that Trainer A cannot UPDATE/DELETE Trainer B's exercises. Also assert INSERT requires `trainer_id = auth.uid()` (INSERT with wrong trainer_id is rejected).

**Contract**: Two trainer fixtures. Trainer A creates two exercises. Each assertion block uses Trainer B's authenticated client and expects either empty `.data` (SELECT returns `[]`) or an error/empty-response for mutations. Follows the pattern: seed under Trainer A → assert Trainer B gets nothing → vice versa for Trainer B's rows.

#### 2. Session templates isolation test

**File**: `tests/integration/rls/session-templates.test.ts`

**Intent**: Same four-operation cross-tenant isolation proof for `session_templates`.

**Contract**: Same pattern as exercises. Trainer A creates a template; assert Trainer B SELECT, PATCH, DELETE all return empty or error.

#### 3. Invite links isolation test

**File**: `tests/integration/rls/invite-links.test.ts`

**Intent**: Assert that Trainer B cannot SELECT, UPDATE, or DELETE Trainer A's invite links. Also assert an unauthenticated client (no session) cannot SELECT the table directly.

**Contract**: Trainer A creates an invite link. Trainer B's client attempts SELECT (expects empty), UPDATE (expects empty), DELETE (expects error or empty). Unauthenticated client (fresh `createClient` with no `signInWithPassword`) expects empty on SELECT.

#### 4. Exercise muscle groups — write-side isolation test

**File**: `tests/integration/rls/exercise-muscle-groups.test.ts`

**Intent**: Assert that Trainer B cannot INSERT, UPDATE, or DELETE muscle group links on Trainer A's exercises. Also assert that SELECT is open to all authenticated (global catalog behavior — expected).

**Contract**: Trainer A creates an exercise and links a muscle group. Trainer B tries: INSERT a link on Trainer A's exercise (expect error), DELETE the existing link (expect error or empty), SELECT all links (expect success — global). Assert Trainer A can SELECT their own links.

### Success Criteria

#### Automated Verification

- `npm run test:integration` passes all Phase 2 tests
- `npm run lint` passes on new test files

#### Manual Verification

- Test output names each table and operation explicitly (describe/it nesting matches `table > operation > cross-tenant scenario`)
- Trainer A's rows appear in Trainer A's SELECT results and are absent from Trainer B's results (and vice versa)

---

## Phase 3: Assignment-Bridged Table Isolation

### Overview

Prove isolation for tables whose access is mediated by the `trainer_clients` assignment bridge: `trainer_clients` itself, `client_plans`, `template_exercises`, and `template_exercise_sets`. Also confirm the `profiles` cross-visibility policy (trainer can see their clients' profiles, not unrelated users').

### Changes Required

#### 1. Trainer clients isolation test

**File**: `tests/integration/rls/trainer-clients.test.ts`

**Intent**: Assert that Trainer A cannot SELECT Trainer B's assignments, and that Trainer B cannot UPDATE Trainer A's assignments. Verify that a client can SELECT their own assignment row but not another client's.

**Contract**: Two trainer fixtures, each with one client. Trainer A's client tries to SELECT Trainer B's assignments (expects empty). Trainer B tries to SELECT Trainer A's `trainer_clients` rows where `trainer_id = trainerA.id` (expects empty — the SELECT policy filters to `trainer_id = auth.uid()`).

#### 2. Client plans isolation test

**File**: `tests/integration/rls/client-plans.test.ts`

**Intent**: Assert that Trainer B cannot SELECT, UPDATE, or DELETE Trainer A's client plans. Also assert that after `remove_trainer_client` is called (soft-remove), Trainer A loses SELECT access to plans for that client (the post-removal tightening from `20260605120000`).

**Contract**: Two trainer fixtures; Trainer A has an active client and a `client_plans` row. Trainer B tries SELECT (expects empty), UPDATE (expects empty/error), DELETE (expects empty/error). Then Trainer A calls `remove_trainer_client` for the assignment; Trainer A's subsequent SELECT of the plan expects empty (assignment is no longer active, `is_trainer_for_client` returns false).

#### 3. Template exercises + sets isolation test

**File**: `tests/integration/rls/template-exercises.test.ts`

**Intent**: Assert that Trainer B cannot SELECT, INSERT, UPDATE, or DELETE template exercises or sets that belong to Trainer A's templates. Covers both `template_exercises` and `template_exercise_sets` (same ownership chain).

**Contract**: Trainer A creates a template, a template_exercise, and a template_exercise_set. Trainer B's client attempts SELECT on both tables (expects empty), INSERT with `template_id` pointing to Trainer A's template (expects error — the WITH CHECK `EXISTS(session_templates where trainer_id = auth.uid())` blocks it), DELETE (expects error/empty).

#### 4. Profiles cross-visibility test

**File**: `tests/integration/rls/profiles.test.ts`

**Intent**: Assert that Trainer A cannot SELECT Trainer B's profile directly (only via the assignment path), and that a trainer can SELECT their active clients' profiles.

**Contract**: Two trainer fixtures with no assignment between them. Trainer A tries `from("profiles").select().eq("id", trainerB.id)` — expects empty. Then add an active client under Trainer A; Trainer A tries `from("profiles").select().eq("id", clientA.id)` — expects the client's profile row. Cross-verify: Trainer A cannot SELECT a client of Trainer B even if they know the UUID.

### Success Criteria

#### Automated Verification

- `npm run test:integration` passes all Phase 3 tests
- `npm run lint` passes

#### Manual Verification

- Post-removal scenario confirmed: after `remove_trainer_client`, Trainer A's SELECT of the client's plans returns empty
- Assignment cross-visibility confirmed: Trainer A sees their own clients' profiles and nothing else

---

## Phase 4: Session Graph + Post-Removal Isolation

### Overview

Prove isolation for the full session graph (`workout_sessions`, `session_exercises`, `set_logs`, `session_comments`) via the `can_access_client_plan` → `can_access_workout_session` → `can_access_session_exercise` helper chain. Include post-removal access denial end-to-end.

### Changes Required

#### 1. Workout sessions isolation test

**File**: `tests/integration/rls/workout-sessions.test.ts`

**Intent**: Assert that Trainer B cannot SELECT, INSERT, UPDATE, or DELETE workout sessions belonging to Trainer A's client plan. Also assert a client can UPDATE a session status (allowed) but cannot DELETE it (not allowed).

**Contract**: Trainer A has an active assignment and a `client_plans` row; creates a `workout_sessions` row. Trainer B tries SELECT (expects empty), INSERT with `client_plan_id` pointing to Trainer A's plan (expects error — `can_access_client_plan` returns false for Trainer B). Client fixture tries DELETE (expects error — no DELETE policy for clients).

#### 2. Session exercises isolation test

**File**: `tests/integration/rls/session-exercises.test.ts`

**Intent**: Assert that Trainer B cannot SELECT or mutate session exercises under Trainer A's sessions.

**Contract**: Trainer A seeds a session exercise. Trainer B's SELECT returns empty; Trainer B's DELETE returns error. Also assert that an exercise from Trainer B cannot be used in Trainer A's session (INSERT WITH CHECK: exercise must belong to the plan's trainer).

#### 3. Set logs isolation test

**File**: `tests/integration/rls/set-logs.test.ts`

**Intent**: Assert that Trainer B cannot INSERT set logs for Trainer A's session exercises. Assert that the client can INSERT/UPDATE their own logs. Assert that a trainer can SELECT their client's logs but cannot INSERT or UPDATE them.

**Contract**: Trainer A's client tries INSERT on a set_log for their session exercise (expects success). Trainer B tries INSERT on the same session exercise (expects error). Trainer A (trainer) tries INSERT on client's set_log (expects error — INSERT policy is client-only). Trainer A SELECT returns the log row (trainer can read).

#### 4. Session comments isolation test

**File**: `tests/integration/rls/session-comments.test.ts`

**Intent**: Assert that Trainer B cannot SELECT or INSERT comments on Trainer A's sessions. Assert that comment UPDATE/DELETE is limited to the author.

**Contract**: Trainer A creates a comment on one of their client's sessions. Trainer B SELECT returns empty. Trainer A's client creates a comment; Trainer A (trainer) tries UPDATE on client's comment (expects error — `author_id = auth.uid()` check fails).

#### 5. Post-removal end-to-end test

**File**: `tests/integration/rls/post-removal.test.ts`

**Intent**: After `remove_trainer_client` is invoked, confirm that the trainer loses access to all session graph data for that client in a single end-to-end scenario.

**Contract**: Full scenario: create trainer + client + active assignment + client_plan + workout_session + session_exercise. Confirm trainer can SELECT all. Call `remove_trainer_client`. Confirm trainer's SELECT on `client_plans`, `workout_sessions`, `session_exercises` all return empty. Confirm client can still SELECT their own historical `client_plans` row (the client history SELECT policy allows this for non-active plans).

### Success Criteria

#### Automated Verification

- `npm run test:integration` passes all Phase 4 tests
- `npm run lint` passes

#### Manual Verification

- Post-removal end-to-end scenario confirmed: trainer sees data, remove, trainer sees nothing
- Client retains historical plan access after removal

---

## Phase 5: SECURITY DEFINER Coverage + CI Wiring

### Overview

Document the two known SECURITY DEFINER security gaps via explicit tests that assert the current (unprotected) behavior. Wire integration tests into CI as a separate job that starts Supabase, runs the suite, and stops it.

### Changes Required

#### 1. `replace_exercise_muscle_groups` gap test

**File**: `tests/integration/security-definer/replace-exercise-muscle-groups.test.ts`

**Intent**: Document that calling `replace_exercise_muscle_groups` with another trainer's `exercise_id` **succeeds** — the function is SECURITY DEFINER with no `auth.uid()` ownership check inside. This test is a **known-gap marker**: it asserts the gap exists so a future hardening PR knows it must flip this assertion.

**Contract**: Trainer A creates an exercise. Trainer B calls `rpc("replace_exercise_muscle_groups", { p_exercise_id: trainerA.exerciseId, p_muscle_groups: [] })` and the test expects **no error** (gap confirmed). Add a comment: `// KNOWN GAP: this call should be rejected — harden in a follow-up PR`. The test name must include "KNOWN GAP" so it's visible in CI output.

#### 2. `complete_client_invite` gap test

**File**: `tests/integration/security-definer/complete-client-invite.test.ts`

**Intent**: Document the `complete_client_invite` behavior when `p_client_id` does not match the caller's `auth.uid()`. This is a pre-auth RPC (called by an anon caller during signup), so the `p_client_id` mismatch is an inherent design constraint — document as accepted risk, not a blocking gap.

**Contract**: A signed-in client (User A) calls `complete_client_invite` with a valid token but `p_client_id = userB.id`. Expect this to either succeed (confirmed gap, mark `// KNOWN GAP`) or error due to the invite's `used_by_client_id` check. Document whichever behaviour the DB currently exhibits. Note: this gap is lower risk than `replace_exercise_muscle_groups` because the caller must have a valid, unused invite token.

#### 3. CI integration test job

**File**: `.github/workflows/ci.yml`

**Intent**: Add a `test-integration` job that starts a local Supabase instance (via `supabase/cli` Docker-based), runs `npm run test:integration`, then stops it. The job runs after the existing `test` job passes so it doesn't block fast unit feedback.

**Contract**:

```yaml
test-integration:
  needs: [test]   # wait for unit tests to pass first
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '22' }
    - run: npm ci
    - uses: supabase/setup-cli@v1
      with: { version: latest }
    - run: supabase start
    - run: npm run test:integration
      env:
        INTEGRATION_SUPABASE_URL: http://localhost:54321
        INTEGRATION_SUPABASE_ANON_KEY: ${{ steps.supabase.outputs.anon_key }}
        INTEGRATION_SUPABASE_SERVICE_ROLE_KEY: ${{ steps.supabase.outputs.service_role_key }}
    - run: supabase stop
      if: always()
```

The exact key extraction method depends on `supabase/setup-cli` action output format — verify against the action's README during implementation; the pattern above is the intended approach.

### Success Criteria

#### Automated Verification

- `npm run test:integration` passes all Phase 5 tests
- The `KNOWN GAP` tests pass (they assert the gap exists, not that it's closed)
- CI `test-integration` job passes on a push to the branch
- `npm run lint` passes

#### Manual Verification

- CI job is visible in GitHub Actions with a distinct `test-integration` name
- `replace_exercise_muscle_groups` gap test is labelled clearly in test output — a reviewer can immediately see it documents a known defect
- `supabase stop` runs even when tests fail (`if: always()`)

---

## Testing Strategy

### Integration Tests

Each phase above produces test files under `tests/integration/`. The harness design principles:

- **One trainer pair per test file** — `beforeAll` / `afterAll` bracket fixture creation and cleanup
- **Anon-key assertions only** — all RLS assertions use authenticated `@supabase/supabase-js` clients (`SUPABASE_ANON_KEY` + `signInWithPassword`); the admin client is isolated in `helpers/admin.ts`
- **Empty-result = isolation held** — for SELECT assertions, expect `data` to be an empty array (not `null` and not an error); RLS silently filters, it does not 401
- **Error = mutation blocked** — for INSERT/UPDATE/DELETE assertions where the operation should be blocked, expect either an error code or an empty affected rows response
- **Name tests for failure archaeology** — `it("Trainer B cannot SELECT Trainer A exercises")` over vague `it("isolation holds")`

### Manual Testing Steps

1. `npx supabase start` — confirm API is at `http://localhost:54321`
2. Add integration env vars to `.env` (from `npx supabase status`)
3. `npm run test:integration` — all tests pass
4. `npm run test` — unit tests still pass (smoke check for no regression)
5. Manually confirm one end-to-end scenario in Supabase Studio SQL Editor using the `BEGIN / SET LOCAL ROLE / set_config / ROLLBACK` pattern from `context/foundation/lessons.md`

## Migration Notes

No new SQL migrations. The harness tests existing schema and policies; it does not modify them.

## References

- Research: `context/changes/testing-rls-isolation-harness/research.md`
- Test plan: `context/foundation/test-plan.md` (§3 Phase 1, §4 Stack, §6.2)
- Supabase client factory: `src/lib/supabase.ts:4–23`
- Vitest config: `vitest.config.ts:1–14`
- Local DB config: `supabase/config.toml:27–36`
- Lessons: `context/foundation/lessons.md` (manual SQL verification pattern)
- RLS migration files: `supabase/migrations/` (10 files, fully audited)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Harness Infrastructure

#### Automated

- [x] 1.1 `npm run test:integration` exits 0 with smoke test passing (requires `npx supabase start`)
- [x] 1.2 `npm run test` still passes — 6 unit tests unchanged
- [x] 1.3 `npm run lint` passes on all new files

#### Manual

- [x] 1.4 Running `npm run test:integration` without env vars set prints a clear error naming the missing variables
- [x] 1.5 Running without `npx supabase start` first prints a clear "Supabase is not running" message
- [x] 1.6 `npx supabase start && npm run test:integration` passes on a fresh clone with env vars set

### Phase 2: Trainer-Direct Table Isolation

#### Automated

- [ ] 2.1 `npm run test:integration` passes all Phase 2 tests
- [ ] 2.2 `npm run lint` passes on new test files

#### Manual

- [ ] 2.3 Test output names each table and operation explicitly in describe/it nesting
- [ ] 2.4 Trainer A's rows appear in Trainer A's SELECT and are absent from Trainer B's SELECT (and vice versa)

### Phase 3: Assignment-Bridged Table Isolation

#### Automated

- [ ] 3.1 `npm run test:integration` passes all Phase 3 tests
- [ ] 3.2 `npm run lint` passes

#### Manual

- [ ] 3.3 Post-removal scenario confirmed: after `remove_trainer_client`, Trainer A's SELECT of client plans returns empty
- [ ] 3.4 Trainer A sees their own clients' profiles and nothing else

### Phase 4: Session Graph + Post-Removal Isolation

#### Automated

- [ ] 4.1 `npm run test:integration` passes all Phase 4 tests
- [ ] 4.2 `npm run lint` passes

#### Manual

- [ ] 4.3 Post-removal end-to-end: trainer sees data → remove → trainer sees nothing → client still sees historical plan
- [ ] 4.4 Client cannot DELETE their own set_logs (no grant — expect error)

### Phase 5: SECURITY DEFINER Coverage + CI Wiring

#### Automated

- [ ] 5.1 `npm run test:integration` passes all Phase 5 tests including KNOWN GAP tests
- [ ] 5.2 CI `test-integration` job passes on a push to the branch
- [ ] 5.3 `npm run lint` passes

#### Manual

- [ ] 5.4 `replace_exercise_muscle_groups` gap test is clearly labelled "KNOWN GAP" in CI output
- [ ] 5.5 `supabase stop` runs even when tests fail (`if: always()` confirmed in workflow)
