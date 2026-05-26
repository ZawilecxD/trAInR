# F-01: Database schema, RLS, and role-aware middleware

## Overview

Implement the foundation data layer for trAInR: all **13 MVP tables** from `docs/ERD.md`, row-level security for trainer/client isolation, profile provisioning on signup, and Astro middleware that exposes `locals.role` with route guards for trainer and client areas. This unblocks roadmap slices S-01 through S-13.

## Current State Analysis

- **Auth only:** `src/lib/supabase.ts` and `src/middleware.ts` resolve `auth.users` via cookies; no `public` schema tables.
- **No migrations:** `supabase/migrations/` absent; `seed.sql` referenced in `supabase/config.toml` but missing.
- **No domain types:** `src/types.ts` does not exist; `src/env.d.ts` only types `locals.user`.
- **Signup:** `src/pages/api/auth/signup.ts` calls `auth.signUp` only — no profile insert.
- **Protection:** Only `/dashboard` requires login; PRD expects broader gating over time.
- **CI:** `.github/workflows/ci.yml` runs lint/build — no `supabase db push`.

### Key Discoveries

- ERD resolves Q1–Q5 (flat `phase` enum, `set_logs` table, soft client removal, no exercise tags, single-use invites) — `docs/ERD.md:496-505`
- Business rules table states RLS intent — `docs/ERD.md:484-494`
- AGENTS.md requires RLS on every table and migration naming `YYYYMMDDHHmmss_short_description.sql`
- Roadmap F-01 outcome — `context/foundation/roadmap.md:71-82`

## Desired End State

1. Local `npx supabase db reset` applies 4–5 migrations + `seed.sql` without error.
2. All 13 MVP tables exist in `public` with **RLS enabled** and policies for `authenticated` role (trainer vs client via helpers).
3. New `auth.users` row automatically gets `profiles` row (`role` default `trainer`).
4. `context.locals.role` is `'trainer' | 'client' | null` after middleware runs.
5. Unauthenticated access to `/dashboard`, `/trainer/*`, `/client/*` redirects to `/auth/signin`.
6. Authenticated user with wrong role on `/trainer/*` or `/client/*` redirects (e.g. client → `/dashboard` or future client home).
7. `src/types.ts` exports MVP interfaces matching ERD.
8. Documented manual step applies migrations to hosted Supabase.

### Verification (spot-check)

```sql
-- As trainer A (auth.uid = A): cannot see trainer B's exercises
SELECT * FROM exercises WHERE trainer_id != auth.uid(); -- expect 0 rows

-- profiles row exists after signup
SELECT id, role FROM profiles WHERE id = auth.uid();
```

## What We're NOT Doing

- Post-MVP tables (`goals`, `notifications`, `subscriptions`, `audit_events`, etc.)
- Invite link registration page, anon token validation RPC, or `invite_links` consumer paths (S-03)
- Google OAuth configuration
- T3 enforcement: deny `set_logs` UPDATE when `workout_sessions.locked_at` is set (S-13)
- Exercise/session CRUD UI or services (S-01+)
- CI job for `supabase db push`
- `supabase gen types` codegen
- Full PRD “all routes gated” allowlist (only agreed prefixes in F-01)

## Implementation Approach

1. **SQL first, app second** — land schema + RLS in domain-ordered migrations; verify with `db reset` and SQL spot-checks before touching middleware.
2. **Security at the database** — app uses anon key; isolation must hold even if a future route forgets a check.
3. **Helpers over copy-paste** — `is_trainer_for_client(client_id)`, `is_assigned_trainer(trainer_id)`, etc., reused in policies.
4. **Thin app layer** — one `profiles` SELECT per request for `role`; no service_role in Astro routes.

## Critical Implementation Details

**Profile trigger:** Use a `SECURITY DEFINER` function `handle_new_user()` on `auth.users` AFTER INSERT. Set `role` from `(new.raw_user_meta_data->>'role')::text`, default `'trainer'`. Grant execute only to `supabase_auth_admin` / service role as per Supabase conventions. S-03 must pass `role: 'client'` in signup metadata for invite registrations.

**Helper functions:** Mark isolation helpers `STABLE` and `SECURITY DEFINER` only when they must read across RLS (prefer `SECURITY INVOKER` where possible). Document each helper in migration comments for security review.

**Middleware role fetch:** After `getUser()`, if user present, `select role from profiles where id = user.id` (single column). On missing profile (should not happen post-trigger), treat as `null` and log in dev — do not create profile in middleware.

**Route guards:** Define `ROLE_PROTECTED_PREFIXES`: `{ prefix: '/trainer', role: 'trainer' }`, `{ prefix: '/client', role: 'client' }`. `/dashboard` requires any authenticated user. Wrong role → redirect to `/dashboard` (until slice-specific homes exist).

## Phase 1: Profiles, enums & RLS helpers

### Overview

Establish Postgres types, `profiles`, auth sync trigger, shared RLS helper functions, and profiles policies. Fix local Supabase auth URL port mismatch.

### Changes Required

#### 1. Enums and profiles table

**File**: `supabase/migrations/20260526120000_enums_profiles_helpers.sql`

**Intent**: Create enum types used across MVP (`user_role`, `exercise_type`, `exercise_metric`, `muscle_region`, `muscle_role`, `exercise_phase`, `trainer_client_status`, `client_plan_status`, `session_status`) and `profiles` table (`id` PK references `auth.users` on delete cascade, `role`, `display_name`, timestamps).

**Contract**: `profiles.id` = `auth.uid()` for self-access; `role` NOT NULL check in (`trainer`, `client`); `updated_at` trigger optional.

#### 2. Auth trigger

**File**: same migration

**Intent**: `handle_new_user()` inserts into `profiles` on new auth user; `display_name` from metadata or email local-part.

**Contract**: `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE ...`

#### 3. RLS helper functions

**File**: same migration

**Intent**: Functions such as `public.is_trainer_for_client(p_client_id uuid)` (active `trainer_clients` row), `public.current_user_role()` returning `user_role`, used by later policies.

**Contract**: Functions live in `public` schema; `GRANT EXECUTE` to `authenticated` where policies invoke them.

#### 4. Profiles RLS

**File**: same migration

**Intent**: Enable RLS; policies: user SELECT/UPDATE own row; trainer cannot UPDATE another user's profile.

**Contract**: No INSERT policy for `authenticated` (trigger/service only); DELETE disallowed for MVP.

#### 5. Supabase config

**File**: `supabase/config.toml`

**Intent**: Set `[auth] site_url` and `additional_redirect_urls` to `http://127.0.0.1:4321` (match Astro dev).

**Contract**: Align with `README.md` dev server port.

### Success Criteria

#### Automated Verification

- `npx supabase db reset` completes without error
- `\d profiles` shows RLS enabled in local Studio or `psql`
- `npm run lint` passes (no app changes required in this phase)

#### Manual Verification

- Sign up a test user locally; `profiles` row exists with `role = trainer`
- Attempt direct INSERT into `profiles` as authenticated user fails (except via trigger path)

**Implementation Note**: Pause for human confirmation after manual checks before Phase 2.

---

## Phase 2: Onboarding & exercise library

### Overview

Add trainer–client relationship and invite tables, exercise library tables, and muscle group seed data.

### Changes Required

#### 1. Trainer onboarding tables

**File**: `supabase/migrations/20260526120100_trainer_onboarding.sql`

**Intent**: Create `trainer_clients` (`status` active/removed, `removed_at`) and `invite_links` (`token` unique, `used_at`, `used_by_client_id`).

**Contract**: Unique partial index on active assignments if needed later; FKs to `profiles`.

#### 2. Onboarding RLS

**File**: same migration

**Intent**: `trainer_clients`: trainer manages rows where `trainer_id = auth.uid()`; client SELECT where `client_id = auth.uid()`. `invite_links`: trainer full CRUD on own `trainer_id` only; no anon policies.

**Contract**: Removed clients (`status = removed'`) invisible to trainer dashboard queries via RLS (SELECT policies filter `status = active'`).

#### 3. Exercise library tables

**File**: `supabase/migrations/20260526120200_exercise_library.sql`

**Intent**: `muscle_groups`, `exercises`, `exercise_muscle_groups` (composite PK on `exercise_id`, `muscle_group_id`, `role`).

**Contract**: `exercises.trainer_id` FK; `is_archived` default false.

#### 4. Exercise library RLS

**File**: same migration

**Intent**: Trainer full access to own `exercises`; clients no access to `exercises` table directly in MVP (they see copies via `session_exercises` later). `muscle_groups` / `exercise_muscle_groups`: read for authenticated (lookup data).

**Contract**: `exercises` policies use `trainer_id = auth.uid()`.

#### 5. Seed file

**File**: `supabase/seed.sql`

**Intent**: Insert canonical `muscle_groups` rows (upper/lower/core/full_body regions) sufficient for FR-009 filtering demos.

**Contract**: Idempotent `INSERT ... ON CONFLICT DO NOTHING` on `name` or fixed UUIDs.

### Success Criteria

#### Automated Verification

- `npx supabase db reset` applies migrations + seed
- `SELECT count(*) FROM muscle_groups` > 0 after reset

#### Manual Verification

- Trainer A cannot SELECT exercises where `trainer_id` = trainer B (use second test user or SQL `set request.jwt`)
- `invite_links` not readable by unauthenticated role

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: Templates & client plans

### Overview

Session template tables and client plan container with one-active-plan constraint.

### Changes Required

#### 1. Template tables

**File**: `supabase/migrations/20260526120300_templates_and_plans.sql`

**Intent**: `session_templates`, `template_exercises` with `phase`, `sort_order`, prescription columns per ERD.

**Contract**: FK `template_id`, `exercise_id`; cascade delete from template to template_exercises.

#### 2. Client plans

**File**: same migration

**Intent**: `client_plans` with `status`, `start_date`; partial unique index `UNIQUE (client_id) WHERE status = 'active'`.

**Contract**: Implements ERD rule “one active plan per client” — `docs/ERD.md:489`

#### 3. RLS

**File**: same migration

**Intent**: Templates: trainer owns via `trainer_id`. `client_plans`: trainer via `trainer_id`; client SELECT via `client_id = auth.uid()` and active assignment helper.

**Contract**: Archived/removed plans policies align with soft-removal (trainer sees archived; client may see own history — document behavior for S-11).

### Success Criteria

#### Automated Verification

- `npx supabase db reset` succeeds
- Second `client_plans` insert with `status = active` for same `client_id` fails

#### Manual Verification

- Client user cannot SELECT another client's `client_plans` row

**Implementation Note**: Pause for human confirmation before Phase 4.

---

## Phase 4: Sessions, logging & comments

### Overview

Workout session graph (`workout_sessions` → `session_exercises` → `set_logs`) plus `session_comments`; complete RLS audit across all 13 tables.

### Changes Required

#### 1. Session tables

**File**: `supabase/migrations/20260526120400_sessions_logging_comments.sql`

**Intent**: `workout_sessions`, `session_exercises`, `set_logs`, `session_comments` with all ERD columns including `locked_at`, `is_warmup` (defaults: `locked_at` null, `is_warmup` false).

**Contract**: FK chain `client_plans` → `workout_sessions` → `session_exercises` → `set_logs`; `session_comments` on `workout_sessions`.

#### 2. Session RLS

**File**: same migration

**Intent**: Access derived via `client_plans`: trainer uses `is_trainer_for_client`; client uses `client_id = auth.uid()`. `set_logs` / `session_comments` policies join through `session_exercises` / `workout_sessions`.

**Contract**: No UPDATE denial on `set_logs` when `locked_at` set (deferred S-13); column exists only.

#### 3. RLS audit

**File**: same migration (comments) + manual checklist in plan

**Intent**: Confirm `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on every MVP table; no table without policies for SELECT/INSERT/UPDATE/DELETE as appropriate.

**Contract**: AGENTS.md granular per-operation policies — at minimum SELECT/INSERT/UPDATE for trainer-owned writes; clients read/write own session data only.

### Success Criteria

#### Automated Verification

- `npx supabase db reset` succeeds
- Query `pg_tables` / Supabase Studio: 13 tables in `public`, RLS on for each

#### Manual Verification

- Client can SELECT own `workout_sessions`; cannot SELECT another client's sessions
- Trainer can SELECT assigned client's sessions; cannot SELECT unassigned client

**Implementation Note**: Pause for human confirmation before Phase 5.

---

## Phase 5: App layer, docs & remote apply

### Overview

Wire TypeScript types and middleware; add route guards; fix API route exports; update docs; apply to remote Supabase manually.

### Changes Required

#### 1. Domain types

**File**: `src/types.ts` (create)

**Intent**: Export MVP interfaces and string union types from `docs/ERD.md` TypeScript section (`Profile`, `Exercise`, `UserRole`, etc.).

**Contract**: Types align with migration column names; no Post-MVP interfaces.

#### 2. Locals typing

**File**: `src/env.d.ts`

**Intent**: Add `role: import('@/types').UserRole | null` to `App.Locals`.

**Contract**: `role` null when unauthenticated or profile missing.

#### 3. Middleware

**File**: `src/middleware.ts`

**Intent**: After `getUser()`, fetch `profiles.role`; set `context.locals.role`. Implement `PROTECTED_ROUTES`, `TRAINER_PREFIXES`, `CLIENT_PREFIXES` with redirects.

**Contract**: Single Supabase client per request; no `service_role` key.

#### 4. Auth API routes

**Files**: `src/pages/api/auth/signin.ts`, `signup.ts`, `signout.ts`

**Intent**: Add `export const prerender = false` per AGENTS.md.

**Contract**: No behavior change to auth flows in F-01.

#### 5. Signup metadata (optional minimal)

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Pass `options: { data: { role: 'trainer' } }` on `signUp` so metadata matches trigger default (explicit, not relied upon alone).

**Contract**: Document S-03 will pass `role: 'client'`.

#### 6. Documentation

**Files**: `context/supabase_setup.md`, `README.md` (data section)

**Intent**: Replace “auth only” wording; document `db reset`, `db push`, seed, migration order, manual remote apply checklist.

**Contract**: Link to `docs/ERD.md` and this change folder.

#### 7. Remote migration apply

**File**: `context/changes/database-schema-and-rls/change.md` (notes) or checklist in plan Progress manual step

**Intent**: Human runs `npx supabase link` (if needed) and `npx supabase db push` against hosted project after review.

**Contract**: Not automated in CI in F-01.

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- `npm run build` passes
- `npx supabase db reset` still passes after any config edits

#### Manual Verification

- Log in as trainer; `locals.role` available on dashboard (log or temporary display)
- Request `/trainer/foo` unauthenticated → redirect sign-in
- Request `/client/foo` as trainer → redirect away
- Hosted Supabase: `db push` applied; Studio shows 13 tables

**Implementation Note**: Final human sign-off before marking change implemented.

---

## Testing Strategy

### Unit Tests

- No new unit test framework in F-01; schema verified via SQL and `db reset`.

### Integration Tests

- Deferred; optional future pgTAP or Supabase test helpers.

### Manual Testing Steps

1. `npx supabase start` && `npx supabase db reset`
2. Register trainer via `/auth/signup`; verify `profiles` in Studio
3. SQL: verify cross-trainer isolation on `exercises`
4. `npm run dev`; hit `/dashboard` logged in/out
5. Hit non-existent `/trainer/test` and `/client/test` with wrong role
6. `npx supabase db push` to remote; repeat spot-check in hosted Studio

## Performance Considerations

- One extra `profiles` SELECT per authenticated request — acceptable for MVP; cache in middleware only within single request.
- RLS helper functions should use indexed FK columns (`trainer_clients.trainer_id`, `client_plans.client_id`).

## Migration Notes

- **Order is strict** — do not reorder migration timestamps.
- **Remote:** `db push` is forward-only; test locally first.
- **Rollback:** Restore from Supabase backup or write down migration; no automated rollback in Vercel deploy.
- **S-03:** Adding invite RPC later must not weaken `invite_links` RLS; prefer SECURITY DEFINER RPC over anon SELECT.

## References

- `docs/ERD.md` — schema source of truth
- `context/foundation/roadmap.md` — F-01 slice definition
- `context/foundation/prd.md` — Access Control, NFR privacy
- `AGENTS.md` — RLS and migration conventions
- `context/supabase_setup.md` — local/remote Supabase workflow

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Profiles, enums & RLS helpers

#### Automated

- [x] 1.1 `npx supabase db reset` completes without error
- [x] 1.2 `npm run lint` passes

#### Manual

- [x] 1.3 Signup creates `profiles` row with `role = trainer`
- [x] 1.4 Direct `profiles` INSERT as authenticated user is denied

### Phase 2: Onboarding & exercise library

#### Automated

- [ ] 2.1 `npx supabase db reset` applies migrations and seed
- [ ] 2.2 `muscle_groups` count > 0 after reset

#### Manual

- [ ] 2.3 Trainer A cannot read Trainer B exercises
- [ ] 2.4 `invite_links` not readable unauthenticated

### Phase 3: Templates & client plans

#### Automated

- [ ] 3.1 `npx supabase db reset` succeeds
- [ ] 3.2 Duplicate active `client_plans` for same client fails

#### Manual

- [ ] 3.3 Client cannot read another client's plan

### Phase 4: Sessions, logging & comments

#### Automated

- [ ] 4.1 `npx supabase db reset` succeeds
- [ ] 4.2 All 13 MVP tables have RLS enabled

#### Manual

- [ ] 4.3 Client session isolation verified
- [ ] 4.4 Trainer only sees assigned client sessions

### Phase 5: App layer, docs & remote apply

#### Automated

- [ ] 5.1 `npm run lint` passes
- [ ] 5.2 `npm run build` passes
- [ ] 5.3 `npx supabase db reset` still passes

#### Manual

- [ ] 5.4 Middleware role and route guards behave correctly
- [ ] 5.5 Hosted `supabase db push` applied and verified in Studio
