# Plan Assignment (S-04) Implementation Plan

## Overview

Implement trainer-side plan assignment: drill into a client from `/trainer/clients`, view a month-grid calendar, place `workout_sessions` on specific days (from a template or blank), personalize exercises in a pre-save editor, and persist an atomic exercise snapshot via SECURITY DEFINER RPCs. Auto-create an active `client_plans` container on first assignment. Resolve the S-14 follow-up by adding `session_exercise_sets` and aligning session prescription with the per-round template model.

## Current State Analysis

- **DB foundation exists:** `client_plans`, `workout_sessions`, flat `session_exercises`, full RLS chain (`can_access_client_plan`, `can_access_workout_session`, etc.) — `supabase/migrations/20260526120300_templates_and_plans.sql`, `20260526120400_sessions_logging_comments.sql`.
- **Templates fully built (S-02 + S-14):** per-round `template_exercise_sets`, service/API/UI in `src/lib/session-templates/`, `src/pages/api/session-templates/`, `TemplateForm`.
- **No app layer for plans/sessions:** zero references to `client_plans` / `workout_sessions` / `session_exercises` under `src/` except types in `src/types.ts` and placeholder copy on dashboards.
- **Schema drift:** `session_exercises` still has flat `prescribed_*` columns; `session_exercise_sets` table does not exist. `SessionExercise` type and `docs/ERD.md` still show flat prescription.
- **Client roster exists:** `src/pages/trainer/clients.astro` + `InviteClientPanel` — natural entry point for per-client drill-down.
- **No calendar component:** no shadcn Calendar / `react-day-picker` in repo yet.
- **RLS integration tests** seed flat `session_exercises` directly — will need updating after migration.

### Key Discoveries:

- `session-templates/service.ts` uses sequential supabase-js inserts without transactions — acceptable for templates but roadmap and test-plan lessons favor RPC for atomic session snapshots.
- `workout_sessions.locked_at` and `started_at` columns exist for future immutability (S-06/S-13); S-04 edit gate is `status = 'not_started'` AND `started_at IS NULL`.
- `client_plans_one_active_per_client_idx` partial unique index enforces one active plan per client — auto-create must upsert-or-select, not blind insert.
- Load semantics in ERD: `0` = bodyweight, negative = assisted (`docs/ERD.md:305-306`); template zod currently rejects negative (`schemas.ts:20`).

## Desired End State

Trainer opens `/trainer/clients`, clicks a client → `/trainer/clients/[clientId]/plan`:

- Sees a **month-grid calendar** with sessions shown on their scheduled days (multiple sessions per day allowed).
- Clicks a day → sees that day's sessions + "Add session" CTA.
- Chooses **From template** (picker listing their templates) or **Blank session** equally.
- Opens a **session editor** (fork of `TemplateForm`) pre-filled from template or empty; can reorder/add/remove exercises and edit per-round prescription.
- Saves → RPC atomically creates/updates `workout_sessions` + `session_exercises` + `session_exercise_sets`; auto-creates active `client_plans` on first assignment if none exists.
- Can **edit** any `not_started` session afterward (same editor); blocked once client starts (`started_at` set).
- Client list rows link to the plan view; navigation is discoverable without knowing URLs.

### Verification

- Trainer completes full flow: client → calendar → template assign → personalize → save → session appears on correct day → edit → save again.
- `npm run lint` and `npm run build` pass.
- Integration tests cover new RPC and `session_exercise_sets` RLS.
- Supabase Studio verification SQL passes for snapshot RPC and cross-trainer isolation.

## What We're NOT Doing

- Client-facing calendar (S-05) — trainer calendar ships now; client view adapts it later.
- Guided workout / set logging (S-06).
- Trainer dashboard session readout (S-07).
- Session comments (S-09).
- Plan rename / complete / archive UI (plan stays auto-named "Training plan" unless edited later).
- Drag-and-drop exercise reorder (Up/Down buttons, matching templates).
- Duplicate session / copy session workflows.
- Notifications when sessions are assigned.
- Bulk assign (multiple days at once).
- `locked_at` enforcement (T3 — 24h edit seal).

## Implementation Approach

Four incremental phases mirroring prior slices (S-02, S-14):

1. **Data model** — add `session_exercise_sets`, migrate off flat `session_exercises` columns, DB checks, RLS, types, ERD.
2. **RPC + API** — atomic create/update RPCs, zod schemas, thin service wrappers, REST routes with `requireTrainer`.
3. **Trainer calendar & assignment UI** — client drill-down, month grid, assign flow, `SessionForm`, navigation.
4. **Testing & hardening** — integration tests, unit tests, RLS verification SQL, fix existing RLS tests for new schema.

Bottom-up: schema before RPC before UI. Reuse `TemplateForm` / `ExercisePickerModal` patterns; extract shared prescription editor pieces only if duplication becomes unmaintainable in implementation (not required upfront).

## Critical Implementation Details

- **Edit eligibility:** `update_workout_session_snapshot` RPC must reject when `workout_sessions.status <> 'not_started'` OR `started_at IS NOT NULL`. UI should hide/disable edit for in-progress sessions; API is the enforcement boundary.
- **Auto plan creation:** `ensure_active_client_plan(p_client_id)` runs inside create RPC — verify `is_trainer_for_client(p_client_id)`, select existing active plan or insert with `name = 'Training plan'`, `start_date = current_date`, `status = 'active'`.
- **Calendar month data:** SSR or API fetch sessions where `scheduled_date` falls in visible month range for the client's active plan; handle "no plan yet" as empty calendar (first save creates plan).
- **Month grid reuse for S-05:** Build `ClientPlanCalendar` (or similar) as a React island accepting `role="trainer" | "client"` prop or separate thin wrappers — keep session chip rendering and month navigation reusable; role-specific actions (assign vs open workout) stay in wrapper pages.

---

## Phase 1: Data model & migration

### Overview

Add `session_exercise_sets` mirroring `template_exercise_sets`, backfill any existing flat `session_exercises` rows, drop flat prescription columns, add DB-level prescription checks, enable RLS, update TypeScript types and ERD.

### Changes Required:

#### 1. Migration — `session_exercise_sets` + column cleanup

**File**: `supabase/migrations/YYYYMMDDHHmmss_session_exercise_sets.sql`

**Intent**: Bring assigned-session prescription in line with S-14 per-round model; no flat columns on `session_exercises`.

**Contract**:

- Create `session_exercise_sets` with columns matching `template_exercise_sets` (`session_exercise_id` FK, `set_number`, `prescribed_reps`, `prescribed_duration_seconds`, `prescribed_load_kg`, `rest_after_seconds`).
- Constraints: `set_number > 0`, `UNIQUE (session_exercise_id, set_number)`.
- Check: each row has `prescribed_reps IS NOT NULL OR prescribed_duration_seconds IS NOT NULL`.
- Load: allow any numeric (`prescribed_load_kg` nullable; no `min(0)` check — ERD bodyweight/assisted semantics).
- Backfill: if any `session_exercises` rows exist with flat columns, expand via `generate_series(1, greatest(prescribed_sets, 1))` (same pattern as `20260605130000_per_round_template_prescription.sql`).
- Drop from `session_exercises`: `prescribed_sets`, `prescribed_reps`, `prescribed_duration_seconds`, `prescribed_load_kg`, `rest_after_seconds`.
- Index on `session_exercise_id`.

#### 2. Migration — RLS for `session_exercise_sets`

**File**: same migration file

**Intent**: Tenant isolation via parent chain `session_exercise_sets → session_exercises → workout_sessions → client_plans`.

**Contract**:

- Enable RLS; grant `select, insert, update, delete` to `authenticated`.
- SELECT/INSERT/UPDATE/DELETE policies: trainer owns plan (`client_plans.trainer_id = auth.uid()`) AND `can_access_workout_session(session_id)` for reads; for mutate policies also require `is_trainer_for_client(client_plans.client_id)` on insert/update/delete (align with post-S-11 tightening).
- Client SELECT allowed via `can_access_session_exercise` chain (read-only for clients).

#### 3. Optional hardening — template load check alignment

**File**: same migration or follow-up migration

**Intent**: Align DB constraints with ERD load semantics for templates too (roadmap note).

**Contract**: Drop any implicit non-negative assumption on `template_exercise_sets.prescribed_load_kg` if added later; no new min constraint. (Template zod alignment deferred to Phase 2 session schemas — document if template zod left unchanged in v1.)

#### 4. TypeScript types

**File**: `src/types.ts`

**Intent**: Mirror template nested shape for assigned sessions.

**Contract**:

- Add `SessionExerciseSet` interface (parallel to `TemplateExerciseSet` with `session_exercise_id`).
- Update `SessionExercise`: remove flat `prescribed_*` fields; add `sets: SessionExerciseSet[]` (nested type optional on list views).
- Export types used by schemas/service.

#### 5. ERD documentation

**File**: `docs/ERD.md`

**Intent**: Reflect per-round session prescription and relationship diagram.

**Contract**:

- Mermaid: add `session_exercise_sets` entity; remove flat fields from `session_exercises`; add `session_exercises ||--o{ session_exercise_sets`.
- TypeScript section: update `SessionExercise` to nested `sets[]`; add `SessionExerciseSet`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset` (or `supabase migration up` on local)
- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- In Supabase Studio: `\d session_exercise_sets` shows expected columns and FKs
- Flat columns absent from `session_exercises`
- RLS enabled on `session_exercise_sets`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: RPC + API layer

### Overview

SECURITY DEFINER RPCs for atomic session snapshot create/update and active plan ensure; zod schemas; thin service module; REST API routes following session-templates pattern.

### Changes Required:

#### 1. RPC — `ensure_active_client_plan`

**File**: `supabase/migrations/YYYYMMDDHHmmss_workout_session_rpcs.sql`

**Intent**: Idempotent active plan container for a trainer–client pair.

**Contract**:

- Signature: `ensure_active_client_plan(p_client_id uuid) returns uuid`
- `SECURITY DEFINER`, `set search_path = public`
- Verify `auth.uid()` is trainer with `is_trainer_for_client(p_client_id)`
- Return existing active plan id or insert new row (`trainer_id = auth.uid()`, `name = 'Training plan'`, `status = 'active'`, `start_date = current_date`)
- Handle unique-index race with `ON CONFLICT` or re-select pattern
- `GRANT EXECUTE` to `authenticated`

#### 2. RPC — `create_workout_session`

**File**: same migration

**Intent**: Atomically create session + exercise snapshot from trainer-provided payload.

**Contract**:

- Signature: `create_workout_session(p_client_id uuid, p_scheduled_date date, p_name text, p_source_template_id uuid, p_exercises jsonb) returns uuid`
- Call `ensure_active_client_plan(p_client_id)` → `v_plan_id`
- Verify each exercise in `p_exercises` json array: `exercises.trainer_id = auth.uid()` for each `exercise_id`
- If `p_source_template_id` not null: verify template owned by `auth.uid()`
- Insert `workout_sessions` (`client_plan_id`, `scheduled_date`, `name`, `source_template_id`, `status = 'not_started'`)
- For each exercise in payload: insert `session_exercises` (phase, sort_order, notes); bulk insert `session_exercise_sets` with 1-based `set_number`
- Return new session id
- Reject empty `p_name` (trimmed non-empty string)

JSON exercise shape (document in migration comment):

```json
[{ "exercise_id": "uuid", "phase": "main", "sort_order": 0, "notes": null,
   "sets": [{ "prescribed_reps": 10, "prescribed_duration_seconds": null,
              "prescribed_load_kg": 50, "rest_after_seconds": 120 }] }]
```

#### 3. RPC — `update_workout_session_snapshot`

**File**: same migration

**Intent**: Replace-all exercise snapshot for editable sessions.

**Contract**:

- Signature: `update_workout_session_snapshot(p_session_id uuid, p_scheduled_date date, p_name text, p_exercises jsonb) returns void`
- Verify session's plan belongs to `auth.uid()` and `is_trainer_for_client` active
- Reject if `status <> 'not_started'` OR `started_at IS NOT NULL`
- Update session metadata (`scheduled_date`, `name`) when provided
- Delete existing `session_exercises` for session (cascade deletes sets)
- Re-insert exercises + sets from `p_exercises` (same shape as create)

#### 4. RPC — `delete_workout_session` (optional but recommended)

**File**: same migration

**Intent**: Allow trainer to remove mistaken assignments.

**Contract**:

- Only when `status = 'not_started'` and `started_at IS NULL`
- Verify plan ownership + active assignment
- Delete session row (cascade)

#### 5. Zod schemas

**File**: `src/lib/workout-sessions/schemas.ts`

**Intent**: Validate API payloads; mirror template round rules with ERD load semantics.

**Contract**:

- `sessionExerciseSetInputSchema`: reps/duration nullable ints ≥1; `prescribed_load_kg` nullable number (no min(0) — allow negative assisted); `rest_after_seconds` ≥0 nullable; refine: reps OR duration required per round
- `sessionExerciseInputSchema`: exercise_id uuid, phase enum, sort_order ≥0, sets array min 1 max 20, notes nullable
- `createWorkoutSessionBodySchema`: `{ client_id, scheduled_date (ISO date string), name, source_template_id uuid|null, exercises[] }` — exercises may be empty array for blank shell (trainer adds in editor before save)
- `updateWorkoutSessionBodySchema`: `{ scheduled_date?, name?, exercises? }` — at least one field
- `listSessionsQuerySchema`: `{ client_id, from: date, to: date }`
- Export `formatZodIssues` (reuse pattern from templates)

#### 6. Service module

**File**: `src/lib/workout-sessions/service.ts`

**Intent**: Encapsulate Supabase RPC calls and read queries.

**Contract**:

- `listSessionsForClient(supabase, trainerId, clientId, from, to)` — join active plan, return sessions in date range with id, name, scheduled_date, status, source_template_id
- `getSessionWithExercises(supabase, sessionId)` — nested select `session_exercises` + `session_exercise_sets` + exercise name/metric join (mirror `getTemplate`)
- `createWorkoutSession(supabase, body)` — `rpc('create_workout_session', ...)`
- `updateWorkoutSession(supabase, sessionId, body)` — `rpc('update_workout_session_snapshot', ...)`
- `deleteWorkoutSession(supabase, sessionId)` — `rpc('delete_workout_session', ...)`
- Export `SessionWithExercises` type

#### 7. API routes

**Files**:

- `src/pages/api/workout-sessions/index.ts` — `GET` (list by query), `POST` (create)
- `src/pages/api/workout-sessions/[id].ts` — `GET`, `PATCH`, `DELETE`

**Intent**: Trainer-only REST surface matching exercises/templates conventions.

**Contract**:

- All exports: `const prerender = false`
- `requireTrainer` guard on all methods
- GET list: validate query zod; verify trainer has active assignment to `client_id`
- POST/PATCH: zod body → service → 201/200; map RPC exceptions to 400/403/404
- DELETE: 204 on success
- GET single: 404 if session not accessible via RLS

#### 8. Client plan helper (read-only)

**File**: `src/lib/client-plans/service.ts` (minimal)

**Intent**: SSR helper for plan page — fetch active plan metadata if exists.

**Contract**:

- `getActivePlanForClient(supabase, trainerId, clientId)` → `{ id, name, start_date } | null`

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset`
- Unit tests for zod schemas: `src/lib/workout-sessions/schemas.test.ts`
- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Supabase Studio: call `create_workout_session` as trainer JWT with sample payload → session + exercises + sets rows appear atomically
- Cross-trainer call with another trainer's `client_id` fails
- Update rejected after manually setting `started_at`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Trainer calendar & assignment UI

### Overview

Per-client plan page with month-grid calendar, session list per day, template/blank assignment entry, `SessionForm` editor (pre-save personalize), navigation from Clients list.

### Changes Required:

#### 1. shadcn Calendar component

**File**: `src/components/ui/calendar.tsx` (via `npx shadcn@latest add calendar`)

**Intent**: Month-grid primitive for trainer (and future client) calendars.

**Contract**:

- Adds `react-day-picker` dependency
- Styled with project Tailwind tokens; use `cn()` for class merging

#### 2. Shared calendar island

**File**: `src/components/plans/PlanCalendar.tsx`

**Intent**: Reusable month view showing sessions on days; trainer variant supports day click + session chips.

**Contract**:

- Props: `sessions: { id, scheduled_date, name, status }[]`, `selectedDate: Date`, `onSelectDate`, `onSelectSession?`, `month`, `onMonthChange`
- Render session indicators on days with assignments (support multiple chips/count badge)
- Selected day highlights; mobile-friendly touch targets

#### 3. Client plan page (Astro)

**File**: `src/pages/trainer/clients/[clientId]/plan.astro`

**Intent**: Main S-04 hub — calendar + day detail panel.

**Contract**:

- Frontmatter: verify `clientId` param; confirm active `trainer_clients` assignment; load client profile display name; load active plan via `getActivePlanForClient`; load sessions for current month via `listSessionsForClient`
- Render `PlanCalendar` island + day panel listing sessions on selected date
- CTAs: "Add from template", "Add blank session" → navigate to session editor routes with `date` query param
- Breadcrumb/back link to `/trainer/clients`
- 404/redirect if client not assigned to trainer

#### 4. Session editor pages

**Files**:

- `src/pages/trainer/clients/[clientId]/sessions/new.astro`
- `src/pages/trainer/clients/[clientId]/sessions/[sessionId].astro`

**Intent**: Create and edit session snapshots.

**Contract**:

- **New:** query params `date` (required), optional `templateId`. If `templateId`, SSR `getTemplate` and map to initial `SessionForm` state; else empty exercises. Preload trainer exercise list for picker (same as template pages).
- **Edit:** SSR `getSessionWithExercises`; reject/warn if session not editable (`status !== 'not_started'` or `started_at` set) — show read-only message or redirect.
- Both host `SessionForm` React island.

#### 5. SessionForm component

**File**: `src/components/workout-sessions/SessionForm.tsx`

**Intent**: Pre-save personalization editor; fork of `TemplateForm` for assigned sessions.

**Contract**:

- Fields: session name (default from template name or "Workout"), scheduled date (date input, pre-filled from query)
- Phase sections (warm_up/main/cool_down): reuse `ExercisePickerModal`, Up/Down reorder, per-round editor (same UX as template rounds)
- Client validation via `src/lib/workout-sessions/form-validation.ts` (mirror templates)
- Submit: POST (create) or PATCH (edit) to `/api/workout-sessions`
- Success redirect: `/trainer/clients/[clientId]/plan?date=YYYY-MM-DD&assigned=1` flash
- Delete button on edit page (confirmed) → DELETE API → redirect to plan page
- Empty exercises allowed on create form only if user explicitly saves blank shell (discourage with validation warning if 0 exercises on save)

#### 6. Form validation (client)

**File**: `src/lib/workout-sessions/form-validation.ts`

**Intent**: Client-side mirror of zod rules for immediate feedback.

**Contract**:

- `validateSessionForm(state)` → field errors map
- Same round rules as templates: ≥1 round, reps or duration per round, max 20 rounds

#### 7. Template picker modal

**File**: `src/components/workout-sessions/TemplatePickerModal.tsx`

**Intent**: Choose template when adding session from plan page.

**Contract**:

- Lists trainer templates (name, description snippet); select → navigate to `sessions/new?date=&templateId=`
- "Blank session" button → `sessions/new?date=` without templateId

#### 8. Clients list navigation

**File**: `src/pages/trainer/clients.astro` and/or `src/components/trainer/InviteClientPanel.tsx`

**Intent**: Discoverable entry to plan assignment (lessons.md: plan navigation in same slice).

**Contract**:

- Each active client row links to `/trainer/clients/[clientId]/plan` (client name or "View plan" action)
- Optional: show session count or "No sessions yet" hint

#### 9. Flash / empty states

**Files**: plan page, clients page

**Intent**: Feedback after assign and guidance for new clients.

**Contract**:

- `?assigned=1` success banner on plan page
- Empty calendar copy: "No sessions yet — pick a day and add your first session"
- No active plan state handled transparently (calendar works before first save)

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Full happy path: Clients → client plan → pick day → from template → personalize rounds → save → session on calendar
- Blank session path: add exercises manually → save
- Edit not_started session: change exercise list → save → calendar reflects changes
- Multiple sessions same day: both visible on calendar day
- Mobile viewport: calendar usable one-handed (scroll/tap targets)
- Unassigned client URL returns 404 or redirect

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Testing & hardening

### Overview

Integration tests for RPCs and new RLS; update existing RLS tests for per-round schema; unit tests; Supabase Studio verification SQL.

### Changes Required:

#### 1. Integration — RPC tests

**File**: `tests/integration/security-definer/create-workout-session.test.ts`

**Intent**: Prove atomic create and authorization boundaries.

**Contract**:

- Seed trainer + client + assignment + template with exercises/sets
- Trainer A creates session via RPC → returns id; rows in all three tables
- Trainer B same client_id → fails
- Update snapshot on not_started → succeeds; after `started_at` set → fails

#### 2. Integration — RLS for `session_exercise_sets`

**File**: `tests/integration/rls/session-exercise-sets.test.ts`

**Intent**: Cross-tenant isolation on new table.

**Contract**:

- Seed session graph with sets
- Trainer A SELECT own sets → data; Trainer B → empty
- Client SELECT own session sets → data; other client → empty

#### 3. Update existing RLS tests

**Files**: `tests/integration/rls/session-exercises.test.ts`, `workout-sessions.test.ts`, `set-logs.test.ts`, `post-removal.test.ts`, etc.

**Intent**: Replace flat `prescribed_*` inserts with nested `session_exercise_sets` inserts.

**Contract**:

- Session exercise seed helper creates exercises + sets rows
- All existing assertions still pass

#### 4. Unit tests

**Files**:

- `src/lib/workout-sessions/schemas.test.ts`
- `src/lib/workout-sessions/form-validation.test.ts`

**Intent**: Cover validation edge cases (negative load, missing reps+duration, empty name, 21 rounds).

#### 5. Verification SQL

**File**: `context/changes/plan-assignment/verification.sql`

**Intent**: Copy-paste Supabase Studio script per lessons.md.

**Contract**:

- `begin` / `set local role authenticated` / JWT claim setup for trainer + client fixtures
- Exercises: create session via RPC, verify row counts, attempt cross-trainer read (expect empty)
- `select auth.uid()` sanity checks; `rollback` at end

#### 6. Tighten `session_exercises` INSERT policy (if gap found)

**File**: optional small migration

**Intent**: Align insert policy with post-S-11 active-assignment requirement.

**Contract**:

- `session_exercises_trainer_insert` adds `is_trainer_for_client(cp.client_id)` if not already present

### Success Criteria:

#### Automated Verification:

- Integration tests pass: `npm run test:integration` (or project equivalent)
- Unit tests pass: `npm run test` / vitest
- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Run `verification.sql` in Supabase Studio — all checks PASS
- Spot-check: trainer removed from client cannot create new sessions for that client

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Zod: valid/invalid payloads for create/update session
- Form validation: round rules, load negative allowed, phase ordering
- Payload mapping: template → session initial state (if extracted helper)

### Integration Tests:

- RPC create/update/delete authorization
- `session_exercise_sets` RLS isolation
- Updated session graph RLS tests with nested sets

### Manual Testing Steps:

1. Trainer assigns template session to client on specific day; verify calendar chip and DB rows.
2. Trainer creates blank session, adds 2 exercises with different round prescriptions, saves.
3. Trainer edits not_started session (remove exercise, add another), saves.
4. Simulate started session (`started_at` set in Studio) — edit UI blocked, PATCH returns error.
5. Two sessions same day — both listed and distinct on calendar.
6. Trainer B cannot access Trainer A's client plan URL or API.

## Performance Considerations

- Month session list query scoped by `scheduled_date` range + single active plan — index `workout_sessions_scheduled_date_idx` already exists.
- Calendar SSR loads one month at a time; month navigation refetches (full page or client fetch — implementer's choice; prefer fetch API for snappier month changes if straightforward).
- Session editor preloads full exercise list server-side (same as templates); acceptable at MVP scale (5–30 clients, modest libraries).

## Migration Notes

- No production session data expected (no app writers yet); backfill is safety net for integration test seeds.
- Existing RLS tests using flat columns must be updated in Phase 4 — run tests after Phase 1 locally to catch breakages early.
- Template zod `prescribed_load_kg min(0)` may remain inconsistent with ERD until a small follow-up; session schemas MUST allow negative in S-04.

## References

- Roadmap S-04: `context/foundation/roadmap.md`
- PRD FR-012: `context/foundation/prd.md`
- S-14 plan brief (session mirror deferred): `context/archive/2026-06-05-exercises-separate-rounds/plan-brief.md`
- Template service pattern: `src/lib/session-templates/service.ts`
- Invite RPC pattern: `supabase/migrations/20260604120000_invite_rpcs.sql`
- ERD: `docs/ERD.md`
- Lessons: `context/foundation/lessons.md` (navigation, Studio SQL)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data model & migration

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — b78021c
- [x] 1.2 Linting passes: `npm run lint` — b78021c
- [x] 1.3 Production build passes: `npm run build` — b78021c

#### Manual

- [x] 1.4 In Supabase Studio: `\d session_exercise_sets` shows expected columns and FKs — b78021c
- [x] 1.5 Flat columns absent from `session_exercises` — b78021c
- [x] 1.6 RLS enabled on `session_exercise_sets` — b78021c

### Phase 2: RPC + API layer

#### Automated

- [x] 2.1 Migration applies cleanly: `npx supabase db reset` — ff23609
- [x] 2.2 Unit tests for zod schemas: `src/lib/workout-sessions/schemas.test.ts` — ff23609
- [x] 2.3 Linting passes: `npm run lint` — ff23609
- [x] 2.4 Production build passes: `npm run build` — ff23609

#### Manual

- [ ] 2.5 Supabase Studio: `create_workout_session` creates session + exercises + sets atomically
- [ ] 2.6 Cross-trainer call with another trainer's `client_id` fails
- [ ] 2.7 Update rejected after manually setting `started_at`

### Phase 3: Trainer calendar & assignment UI

#### Automated

- [ ] 3.1 Linting passes: `npm run lint`
- [ ] 3.2 Production build passes: `npm run build`

#### Manual

- [ ] 3.3 Full happy path: Clients → plan → template → personalize → save → calendar
- [ ] 3.4 Blank session path: add exercises manually → save
- [ ] 3.5 Edit not_started session → save → calendar reflects changes
- [ ] 3.6 Multiple sessions same day visible on calendar
- [ ] 3.7 Mobile viewport calendar usable
- [ ] 3.8 Unassigned client URL returns 404 or redirect

### Phase 4: Testing & hardening

#### Automated

- [ ] 4.1 Integration tests pass
- [ ] 4.2 Unit tests pass
- [ ] 4.3 Linting passes: `npm run lint`
- [ ] 4.4 Production build passes: `npm run build`

#### Manual

- [ ] 4.5 Run `verification.sql` in Supabase Studio — all checks PASS
- [ ] 4.6 Trainer removed from client cannot create new sessions for that client
