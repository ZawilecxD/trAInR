# Harden replace_exercise_muscle_groups RPC — Implementation Plan

## Overview

Close the documented SECURITY DEFINER gap in `replace_exercise_muscle_groups`: any authenticated trainer can currently mutate another trainer's `exercise_muscle_groups` rows because the RPC bypasses RLS and performs no `auth.uid()` ownership check. This change adds an in-function ownership guard, pins `search_path`, schema-qualifies table references, and flips the KNOWN GAP integration test to assert rejection.

## Current State Analysis

- `replace_exercise_muscle_groups` is defined in `supabase/migrations/20260529183853_replace_muscle_groups_rpc.sql` as `SECURITY DEFINER` with no ownership check and no `set search_path = public`.
- RLS on `exercise_muscle_groups` correctly blocks direct cross-trainer INSERT/UPDATE/DELETE, but the RPC deletes and re-inserts rows without invoking those policies.
- `src/lib/exercises/service.ts` calls the RPC from `createExercise` / `updateExercise` after the trainer already owns the exercise via normal insert/update flows — app-layer guards exist but are not a substitute for DB enforcement.
- `tests/integration/security-definer/replace-exercise-muscle-groups.test.ts` documents the gap: Trainer B's RPC call on Trainer A's exercise expects `error` to be null (KNOWN GAP).
- Reference pattern: `remove_trainer_client` in `supabase/migrations/20260605120000_remove_trainer_client.sql` — `security definer`, `set search_path = public`, `auth.uid()` guard, `raise exception` on failure, schema-qualified `public.*` tables.

## Desired End State

- `replace_exercise_muscle_groups` rejects any call where the target exercise is not owned by `auth.uid()` (including non-existent exercise IDs).
- Function body uses `set search_path = public` and `public.`-qualified table names.
- Integration test asserts cross-trainer RPC call returns an error; test name no longer contains `KNOWN GAP`.
- Owner happy-path RPC call still succeeds; rejected cross-trainer call leaves existing muscle group rows unchanged.
- `npm run test:integration` passes locally and in CI.

### Key Discoveries

- `remove_trainer_client` is the canonical ownership-guard pattern for authenticated SECURITY DEFINER RPCs in this repo (`20260605120000:7-41`).
- Direct RLS tests in `tests/integration/rls/exercise-muscle-groups.test.ts` already cover table-level isolation; this change closes the RPC bypass only.
- No app-layer changes are required — `requireTrainer` + exercise ownership via RLS on `exercises` already gates API routes; hardening is DB-only plus test updates.

## What We're NOT Doing

- Hardening `complete_client_invite` (separate change `harden-complete-client-invite`).
- Changing RLS policies on `exercise_muscle_groups` or `exercises`.
- Adding new API routes or UI changes.
- Wrapping exercise create/update in a new composite RPC.
- Asserting a specific Postgres error code string in tests (follow existing `expect(error).not.toBeNull()` convention).

## Implementation Approach

Ship a single new migration that `create or replace`s the function with ownership enforcement, then flip and extend the existing security-definer integration test. Keep the generic error message (`Exercise not found or not authorized`) so callers cannot distinguish missing exercises from unauthorized access — matching `remove_trainer_client`'s opaque failure mode.

## Phase 1: Harden RPC

### Overview

Replace `replace_exercise_muscle_groups` with a hardened definition in a new migration.

### Changes Required

#### 1. New migration — hardened function

**File**: `supabase/migrations/<timestamp>_harden_replace_exercise_muscle_groups.sql`

**Intent**: Add an `auth.uid()` ownership guard before any mutation, pin `search_path`, and schema-qualify all table references so the RPC cannot be abused cross-tenant.

**Contract**: `create or replace function public.replace_exercise_muscle_groups(p_exercise_id uuid, p_muscle_groups jsonb) returns void` with `security definer` and `set search_path = public`. At function entry, verify ownership:

```sql
if not exists (
  select 1 from public.exercises e
  where e.id = p_exercise_id and e.trainer_id = auth.uid()
) then
  raise exception 'Exercise not found or not authorized';
end if;
```

Then perform the existing delete/insert logic against `public.exercise_muscle_groups` (unchanged semantics). Preserve existing grants: `revoke all` from `public`, `grant execute` to `authenticated`. Add a `comment on function` noting the ownership guard.

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `npx supabase db reset`
- Lint passes: `npm run lint`
- Unit tests pass: `npm run test`

#### Manual Verification

- Supabase Studio SQL script (see Testing Strategy) confirms owner can replace muscle groups and non-owner receives an error with rows unchanged

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Flip integration test & verify

### Overview

Close the KNOWN GAP test, add owner happy-path coverage, and confirm data integrity after rejection.

### Changes Required

#### 1. Security-definer integration test

**File**: `tests/integration/security-definer/replace-exercise-muscle-groups.test.ts`

**Intent**: Assert the hardened RPC rejects cross-trainer calls and still works for the owning trainer.

**Contract**:

- Rename/describe cross-tenant test to remove `KNOWN GAP` — e.g. `"Trainer B cannot call replace_exercise_muscle_groups on Trainer A exercise"`.
- Flip assertion: `expect(error).not.toBeNull()` on Trainer B's RPC with `p_muscle_groups: []`.
- After the rejected call, Trainer A SELECT on `exercise_muscle_groups` for `exerciseAId` still returns the seeded primary link (proves delete did not run).
- Add owner happy-path test: Trainer A calls RPC with a valid `p_muscle_groups` payload (e.g. same muscle group, `role: 'secondary'`) — `expect(error).toBeNull()` and SELECT confirms updated role.

#### 2. Update change metadata

**File**: `context/changes/harden-replace-exercise-muscle-groups/change.md`

**Intent**: Mark planning complete.

**Contract**: `status: planned`, `updated: 2026-06-09`.

### Success Criteria

#### Automated Verification

- Integration tests pass: `npm run test:integration`
- Typecheck passes: `npx astro sync` (if types touched — unlikely)
- Full CI-equivalent: `npm run lint && npm run test && npm run test:integration`

#### Manual Verification

- Re-run Studio SQL script post-test to confirm behaviour matches integration assertions

---

## Testing Strategy

### Unit Tests

- No new unit tests required — behaviour is DB-enforced; existing `src/lib/exercises/*.test.ts` cover app schemas only.

### Integration Tests

- **Cross-tenant rejection**: Trainer B RPC on Trainer A exercise → error, rows unchanged (`tests/integration/security-definer/replace-exercise-muscle-groups.test.ts`).
- **Owner happy path**: Trainer A RPC with replacement payload → success, junction rows updated.
- **Regression**: existing `tests/integration/rls/exercise-muscle-groups.test.ts` continues to pass unchanged.

### Manual Testing Steps (Supabase Studio SQL)

Deliver a single copy-paste script per `context/foundation/lessons.md`:

1. `begin`
2. Look up two trainer user UUIDs and one exercise owned by trainer A (or insert fixtures inline).
3. `set local role authenticated` + `set_config('request.jwt.claim.sub', '<trainer_a_uuid>', true)` — call `select public.replace_exercise_muscle_groups(...)` with valid payload → expect success.
4. Switch JWT sub to trainer B, call same RPC on trainer A's exercise → expect `Exercise not found or not authorized`.
5. `select` muscle group rows for the exercise → unchanged after step 4.
6. `rollback`

## Performance Considerations

Negligible — one indexed lookup on `exercises(id)` (PK) before the existing delete/insert. No change to call frequency.

## Migration Notes

- New migration only; do not edit `20260529183853_replace_muscle_groups_rpc.sql`.
- `npx supabase db reset` applies all migrations including the new one — no backfill needed (function replacement is stateless).
- Rollback: revert migration file and reset DB.

## References

- Change notes: `context/changes/harden-replace-exercise-muscle-groups/change.md`
- Gap documentation: `context/archive/2026-06-07-testing-rls-isolation-harness/plan.md` (Phase 5)
- Research: `context/archive/2026-06-07-testing-rls-isolation-harness/research.md`
- Current RPC: `supabase/migrations/20260529183853_replace_muscle_groups_rpc.sql`
- Ownership pattern: `supabase/migrations/20260605120000_remove_trainer_client.sql:7-41`
- App caller: `src/lib/exercises/service.ts:42-56`
- KNOWN GAP test: `tests/integration/security-definer/replace-exercise-muscle-groups.test.ts:57-66`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Harden RPC

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — d3bb9f6
- [x] 1.2 Lint passes: `npm run lint` — d3bb9f6
- [x] 1.3 Unit tests pass: `npm run test` — d3bb9f6

#### Manual

- [x] 1.4 Supabase Studio SQL script confirms owner success and non-owner rejection with rows unchanged — d3bb9f6

### Phase 2: Flip integration test & verify

#### Automated

- [x] 2.1 Integration tests pass: `npm run test:integration` — 3a47911
- [x] 2.2 Full CI-equivalent: `npm run lint - [x] 2.2 Full CI-equivalent: `npm run lint && npm run test && npm run test:integration`- [x] 2.2 Full CI-equivalent: `npm run lint && npm run test && npm run test:integration` npm run test - [x] 2.2 Full CI-equivalent: `npm run lint && npm run test && npm run test:integration`- [x] 2.2 Full CI-equivalent: `npm run lint && npm run test && npm run test:integration` npm run test:integration` — 3a47911

#### Manual

- [x] 2.3 Studio SQL re-run confirms behaviour matches integration assertions — 3a47911
