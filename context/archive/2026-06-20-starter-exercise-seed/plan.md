# Starter Exercise Seed Implementation Plan

## Overview

Implement S-17: every new trainer receives a curated starter exercise library on signup. The starter exercises must be true trainer-owned rows in `public.exercises`, linked to the existing global `public.muscle_groups`, so trainers can edit, delete, filter, and use them in templates exactly like manually created exercises.

## Current State Analysis

The exercise library schema already supports trainer-owned exercises and global muscle groups. `public.exercises.trainer_id` owns each exercise, `public.exercise_muscle_groups` links exercises to canonical muscle groups, and RLS limits exercise CRUD to the owning trainer.

Signup provisioning currently stops at profile creation. `public.handle_new_user()` resolves the signup role from `auth.users.raw_user_meta_data`, inserts `public.profiles`, and returns. Trainer signup through `src/pages/api/auth/signup.ts` passes `role: "trainer"`; invite signup passes `role: "client"`.

Local seed data already proves the shape for sample exercises, but only for dev fixtures. There is no production starter catalog, no signup-time clone, and no marker showing that starter exercises have been provisioned for a trainer.

## Desired End State

When a new trainer account is created, the auth trigger provisions a medium curated starter set of 15-25 exercises into that trainer's own library and records that provisioning happened. When a client account is created, no starter exercises are added.

Verification should prove that seeded rows behave like ordinary trainer exercises, remain isolated by RLS between trainers, and are not duplicated if the seeding function is invoked again for the same trainer.

### Key Discoveries:

- `context/foundation/roadmap.md:312-322` defines S-17 as `starter-exercise-seed`, requires per-trainer clones, and calls out seed source, backfill, count, and muscle-group scope as unknowns.
- `supabase/migrations/20260526120000_enums_profiles_helpers.sql:77-117` contains the SECURITY DEFINER `handle_new_user()` trigger that provisions profiles on auth user creation.
- `supabase/migrations/20260526120200_exercise_library.sql:19-50` defines trainer-owned exercises and the exercise-to-muscle junction table.
- `supabase/migrations/20260526120200_exercise_library.sql:73-100` enforces trainer-only exercise CRUD through RLS.
- `supabase/seed.sql:4-19` seeds canonical global `muscle_groups` with stable UUIDs.
- `scripts/seed-dev-users.sql:139-198` shows the existing local fixture pattern for inserting exercises and muscle-group links.
- `tests/integration/helpers/fixtures.ts:29-47` creates trainers via Supabase admin auth, which should exercise the auth trigger and is the right integration-test entry point.

## What We're NOT Doing

- No shared global exercise rows visible to all trainers.
- No trainer-scoped copies of `muscle_groups`; S-17 reuses the existing global lookup table.
- No admin-maintained starter catalog table or catalog management UI.
- No app-layer RPC call from `src/pages/api/auth/signup.ts`; provisioning lives in the DB signup path.
- No retroactive backfill for existing trainers.
- No UI redesign for the exercise list or empty state beyond relying on existing library behavior.
- No preloaded session templates or plans.

## Implementation Approach

Add a database migration that introduces an explicit `profiles.starter_exercises_seeded_at` marker, defines a SECURITY DEFINER seeding function, and updates `handle_new_user()` to call it only when `resolved_role = 'trainer'`. The starter catalog should live as static SQL inside the seeding function: versioned in migrations, deterministic, and intentionally small enough to review.

The starter set should target 15-25 common exercises across upper body, lower body, core, full-body, and at least one non-strength metric where appropriate. Each starter exercise should be inserted as a fresh trainer-owned row with generated UUIDs/default timestamps, then linked to existing canonical muscle groups by stable IDs or names. The function should be safe to re-invoke: if `starter_exercises_seeded_at` is already set for the trainer, it exits without inserting.

## Critical Implementation Details

### Signup Trigger Context

`handle_new_user()` runs as SECURITY DEFINER after `auth.users` insert and does not rely on `auth.uid()`. The seeding function must accept `p_trainer_id uuid` explicitly and must not call RLS-dependent trainer APIs that assume a JWT-authenticated user.

### Idempotency Marker

Use `profiles.starter_exercises_seeded_at` as the once-per-trainer invariant. The migration should update this marker only after both `exercises` and `exercise_muscle_groups` inserts complete; because the trigger runs in one transaction, any failure should roll back profile creation and avoid partial starter state.

### Catalog Ownership

Do not add an `is_seeded`, `system`, or `catalog_id` column unless implementation proves it is required. The product decision is that starter rows are ordinary trainer-owned exercises after creation.

## Phase 1: Catalog and Provisioning Migration

### Overview

Add the database contract for signup-time starter exercise provisioning.

### Changes Required:

#### 1. Profile Seed Marker

**File**: `supabase/migrations/YYYYMMDDHHmmss_starter_exercise_seed.sql`

**Intent**: Add an explicit marker recording that starter exercises have been provisioned for a trainer. This gives the seeding function a durable idempotency guard without inferring state from exercise names or counts.

**Contract**: Add nullable `starter_exercises_seeded_at timestamptz` to `public.profiles`. Existing profiles remain `null`; S-17 does not backfill existing trainers.

#### 2. Starter Seeding Function

**File**: `supabase/migrations/YYYYMMDDHHmmss_starter_exercise_seed.sql`

**Intent**: Define a SECURITY DEFINER function that clones a curated starter catalog into one trainer's exercise library. The function owns the DB-level behavior and can be invoked from the auth trigger or integration tests.

**Contract**: Create `public.seed_starter_exercises_for_trainer(p_trainer_id uuid)` returning `void`, with `security definer` and `set search_path = public`. It exits immediately when the trainer profile does not exist, is not role `trainer`, or already has `starter_exercises_seeded_at` set. Otherwise, it inserts 15-25 exercise rows into `public.exercises`, inserts their `public.exercise_muscle_groups` links, and sets `starter_exercises_seeded_at = now()`.

#### 3. Static Starter Catalog

**File**: `supabase/migrations/YYYYMMDDHHmmss_starter_exercise_seed.sql`

**Intent**: Store the curated catalog in versioned SQL so the starter list changes through reviewed migrations rather than ad hoc runtime configuration.

**Contract**: Catalog entries include `name`, `exercise_type`, `default_metric`, `notes`, and one or more muscle-group links. The set targets 15-25 exercises and should cover major muscle regions using existing global `muscle_groups` entries from `supabase/seed.sql`.

#### 4. Auth Trigger Wiring

**File**: `supabase/migrations/YYYYMMDDHHmmss_starter_exercise_seed.sql`

**Intent**: Update trainer signup provisioning so every new trainer gets the starter catalog through the same DB path used by app signup and admin-created users.

**Contract**: Replace `public.handle_new_user()` with a version that preserves existing profile provisioning behavior and calls `public.seed_starter_exercises_for_trainer(new.id)` only when `resolved_role = 'trainer'`. Client signups through invites must keep creating only the profile/client assignment flow, not starter exercises.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly with `npx supabase db reset` or the repo's local Supabase migration flow.
- New trainer auth-user creation inserts a profile, starter exercises, and muscle-group links in one transaction.
- Client auth-user creation inserts a profile but no starter exercises.
- Re-invoking `seed_starter_exercises_for_trainer` for the same trainer does not duplicate starter rows.

#### Manual Verification:

- A newly signed-up trainer sees the starter exercises in the existing trainer exercise library.
- Seeded rows can be edited/deleted through the existing exercise UI like manual rows.
- Existing trainer accounts are not modified by the migration.

**Implementation Note**: After completing this phase and automated verification, pause for manual confirmation before moving to Phase 2.

---

## Phase 2: Test Coverage and Local Verification

### Overview

Add regression coverage for signup seeding, client exclusion, RLS isolation, and the idempotency marker. Provide a copy-paste Supabase Studio script for manual DB verification.

### Changes Required:

#### 1. Signup Seed Integration Tests

**File**: `tests/integration/starter-exercise-seed.test.ts`

**Intent**: Prove the auth-trigger behavior through the same admin user creation path used by existing integration fixtures.

**Contract**: Tests create a trainer and assert the expected starter count range, required exercise fields, and at least one muscle-group link per seeded exercise. Tests create a client and assert zero starter exercises for that user.

#### 2. Idempotency Test

**File**: `tests/integration/starter-exercise-seed.test.ts`

**Intent**: Lock down the duplicate-protection behavior so retries or manual calls cannot create repeated starter catalogs.

**Contract**: After creating a trainer, call `seed_starter_exercises_for_trainer(trainer.id)` again through an allowed test/admin path and assert the exercise count remains unchanged and `profiles.starter_exercises_seeded_at` stays non-null.

#### 3. RLS Isolation Test

**File**: `tests/integration/starter-exercise-seed.test.ts`

**Intent**: Verify seeded starter exercises remain trainer-owned and isolated exactly like manual exercises.

**Contract**: Create two trainers. Assert trainer A can list their seeded exercises, trainer B cannot select trainer A's `exercises` rows, and cross-trainer update/delete attempts on seeded exercises behave consistently with existing RLS tests.

#### 4. Manual Studio Verification Script

**File**: `context/changes/starter-exercise-seed/verification.sql`

**Intent**: Give the implementer and reviewer a single copy-paste Supabase Studio script that checks trainer seed, client exclusion, idempotency, and RLS expectations without inventing JWT setup.

**Contract**: The script uses `begin`, transaction-scoped `set local role authenticated`, `set_config` for `request.jwt.claim.sub` / `role` where needed, sanity-checks `auth.uid()`, labels expected pass/fail results, and ends with `rollback`.

### Success Criteria:

#### Automated Verification:

- `npm run test:integration -- tests/integration/starter-exercise-seed.test.ts` passes against local Supabase.
- `npm run test:integration` passes or documented local DB prerequisites are satisfied.
- `npm run lint` passes.

#### Manual Verification:

- `context/changes/starter-exercise-seed/verification.sql` produces the documented pass/fail results in Supabase Studio.
- A browser signup check confirms a new trainer lands with a populated exercise library.
- A client invite signup check confirms clients do not get starter exercises.

**Implementation Note**: After completing this phase and automated verification, pause for manual confirmation before moving to Phase 3.

---

## Phase 3: Docs and Planning Alignment

### Overview

Update product and planning artifacts so S-17 is represented as an active planned slice with its Linear linkage and verified behavior.

### Changes Required:

#### 1. Change Metadata

**File**: `context/changes/starter-exercise-seed/change.md`

**Intent**: Mark the change as planned and preserve the Linear issue linkage.

**Contract**: Set `status: planned`, keep `linear_issue: ZAW-34`, and update `updated` when the plan lands.

#### 2. Roadmap Notes

**File**: `context/foundation/roadmap.md`

**Intent**: Resolve S-17's planning unknowns so future readers do not re-open decisions already made here.

**Contract**: Update S-17 notes to record static SQL catalog, signup-only rollout, 15-25 exercise target, global muscle groups, and `profiles.starter_exercises_seeded_at` idempotency. Keep implementation status unchanged until code lands.

#### 3. PRD Note

**File**: `context/foundation/prd.md`

**Intent**: Clarify that the original "no pre-populated exercise database" non-goal has been promoted into S-17.

**Contract**: Add a brief note near FR-007 or Non-Goal #14 pointing to roadmap S-17; do not rewrite the whole PRD.

#### 4. Linear Sync

**External**: Linear issue `ZAW-34`

**Intent**: Keep the external tracker aligned with the plan artifact.

**Contract**: After the plan lands, add or update the issue comment/description with plan path and summary if using `/linear-sync`; at minimum ensure `change.md` carries `linear_issue: ZAW-34`.

### Success Criteria:

#### Automated Verification:

- `context/changes/starter-exercise-seed/plan.md` and `context/changes/starter-exercise-seed/plan-brief.md` exist.
- `change.md` has `status: planned` and `linear_issue: ZAW-34`.
- Markdown formatting is readable and links/references point to existing files.

#### Manual Verification:

- Roadmap S-17 no longer contains unresolved decisions that conflict with this plan.
- Linear issue `ZAW-34` describes the same scope as this plan.

**Implementation Note**: After completing this phase and automated verification, pause for manual confirmation before closing the plan work.

---

## Testing Strategy

### Unit Tests:

- No new unit tests are expected unless implementation extracts SQL-building helpers or TypeScript validation around starter metadata. The core behavior is database-trigger behavior and belongs in integration tests.

### Integration Tests:

- Trainer auth creation provisions starter exercises.
- Client auth creation does not provision starter exercises.
- Every starter exercise has valid enum values and at least one global muscle-group link.
- Repeated seeding for the same trainer is idempotent.
- Trainer A cannot see, update, or delete Trainer B's seeded exercises.

### Manual Testing Steps:

1. Reset local Supabase and run the migration.
2. Sign up as a new trainer through the UI.
3. Open `/trainer/exercises` and confirm 15-25 starter exercises appear.
4. Edit one starter exercise and delete another to confirm ordinary ownership behavior.
5. Create or sign up a client and confirm no starter exercises are owned by that client.
6. Run `context/changes/starter-exercise-seed/verification.sql` in Supabase Studio and compare each section to its expected result.

## Performance Considerations

The seeding function runs once per trainer signup and inserts at most 25 exercises plus junction rows. This is acceptable for the current low-QPS signup path. Keep the function set-based rather than looping one insert at a time if possible, but correctness and clear catalog review matter more than micro-optimization.

## Migration Notes

This is a forward-only migration. Existing trainers are intentionally not backfilled. Rollback for local development is a DB reset; production rollback would require a compensating migration that stops the trigger call and optionally leaves already-created ordinary exercises in place, since they are user-owned rows after creation.

## References

- Roadmap slice: `context/foundation/roadmap.md:312-322`
- PRD original non-goal: `context/foundation/prd.md:89-90`, `context/foundation/prd.md:199`
- Auth trigger: `supabase/migrations/20260526120000_enums_profiles_helpers.sql:77-117`
- Exercise schema/RLS: `supabase/migrations/20260526120200_exercise_library.sql:19-50`, `supabase/migrations/20260526120200_exercise_library.sql:73-100`
- Muscle seed: `supabase/seed.sql:4-19`
- Dev exercise fixture pattern: `scripts/seed-dev-users.sql:139-198`
- Test fixture entry point: `tests/integration/helpers/fixtures.ts:29-47`
- Linear issue: `ZAW-34`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Catalog and Provisioning Migration

#### Automated

- [x] 1.1 Migration applies cleanly with `npx supabase db reset` or the repo's local Supabase migration flow. — 8a2a1eb
- [x] 1.2 New trainer auth-user creation inserts a profile, starter exercises, and muscle-group links in one transaction. — 8a2a1eb
- [x] 1.3 Client auth-user creation inserts a profile but no starter exercises. — 8a2a1eb
- [x] 1.4 Re-invoking `seed_starter_exercises_for_trainer` for the same trainer does not duplicate starter rows. — 8a2a1eb

#### Manual

- [ ] 1.5 A newly signed-up trainer sees the starter exercises in the existing trainer exercise library.
- [ ] 1.6 Seeded rows can be edited/deleted through the existing exercise UI like manual rows.
- [ ] 1.7 Existing trainer accounts are not modified by the migration.

### Phase 2: Test Coverage and Local Verification

#### Automated

- [x] 2.1 `npm run test:integration -- tests/integration/starter-exercise-seed.test.ts` passes against local Supabase. — 8a2a1eb
- [x] 2.2 `npm run test:integration` passes or documented local DB prerequisites are satisfied. — 8a2a1eb
- [x] 2.3 `npm run lint` passes. — 8a2a1eb

#### Manual

- [ ] 2.4 `context/changes/starter-exercise-seed/verification.sql` produces the documented pass/fail results in Supabase Studio.
- [ ] 2.5 A browser signup check confirms a new trainer lands with a populated exercise library.
- [ ] 2.6 A client invite signup check confirms clients do not get starter exercises.

### Phase 3: Docs and Planning Alignment

#### Automated

- [x] 3.1 `context/changes/starter-exercise-seed/plan.md` and `context/changes/starter-exercise-seed/plan-brief.md` exist. — 8a2a1eb
- [x] 3.2 `change.md` has `status: planned` and `linear_issue: ZAW-34`. — 8a2a1eb
- [x] 3.3 Markdown formatting is readable and links/references point to existing files. — 8a2a1eb

#### Manual

- [ ] 3.4 Roadmap S-17 no longer contains unresolved decisions that conflict with this plan.
- [ ] 3.5 Linear issue `ZAW-34` describes the same scope as this plan.
