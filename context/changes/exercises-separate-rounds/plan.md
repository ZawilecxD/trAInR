# Per-Round Exercise Prescription (S-14) Implementation Plan

## Overview

Today a template exercise carries a single uniform prescription (`prescribed_sets` + one `prescribed_reps`/`prescribed_duration_seconds`/`prescribed_load_kg`/`rest_after_seconds`) applied to every set. S-14 lets a trainer prescribe **each round/set separately** — e.g. Bench Press round 1: 10×50 kg + 2 min rest, round 2: 8×60 kg + 2 min, round 3: 6×70 kg + 3 min.

We introduce a `template_exercise_sets` child table (one row per round), extend the template stack (zod → service → API → form) to read/write the nested collection, and backfill existing templates into N identical rounds. Set count becomes a derived fact (number of round rows), so the flat `prescribed_*` columns on `template_exercises` are removed.

## Current State Analysis

S-02 (`session-templates`) is **implemented** (the roadmap row still says "proposed" — stale). The full vertical slice exists and is the thing we extend:

- **DB:** `template_exercises` holds flat prescription columns (`supabase/migrations/20260526120300_templates_and_plans.sql:63`). RLS is derived from `session_templates` ownership via `exists(...)` subqueries (`:90-160`).
- **Types:** `TemplateExercise` / `SessionExercise` carry identical flat fields (`src/types.ts:89`, `:131`).
- **Zod:** `templateExerciseInputSchema` is one flat object; `createTemplateBodySchema` / `updateTemplateBodySchema` embed `exercises: [...]` (`src/lib/session-templates/schemas.ts:16-40`).
- **Service:** `createTemplate` / `updateTemplate` use **replace-all** semantics — delete all `template_exercises` for the template, then bulk-insert (`src/lib/session-templates/service.ts:117-185`). `getTemplate` reads via join `template_exercises(*, exercises(name, default_metric))` (`:63-94`).
- **API:** `GET/POST /api/session-templates`, `GET/PATCH/DELETE /api/session-templates/[id]` (no PUT). Validation errors return `{ error: "validation_error", details: { issues } }`.
- **Form:** `TemplateForm.tsx` (the most complex React component in the repo) renders one input each for Sets / Reps-or-Duration / Load / Rest / Notes per exercise (`:388-482`). Reps-vs-Duration is a per-exercise toggle (`metricMode`) seeded from `exercise.default_metric` (`form-validation.ts:41-66`).
- **Tests:** `schemas.test.ts`, `form-validation.test.ts`. RLS verified by a copy-paste Studio script `context/changes/session-templates/verification.sql`.

The **downstream cascade is dormant**: `SessionExercise` mirrors the flat fields, but **no app code creates sessions from templates yet** (S-04 plan-assignment and S-06 guided-logging are unbuilt — grep finds zero `session_exercises` writers under `src/`). So we can redesign the template prescription shape freely.

## Desired End State

A trainer opens `/trainer/templates/new` (or edits an existing template), adds an exercise to a phase, and sees a **per-round editor**: an ordered list of round rows, each with its own reps-or-duration / load / rest inputs, plus "Add round" and "Duplicate last round" controls. They save in one request; reloading the edit page renders every round exactly as saved. Existing templates created before this change show their previous prescription expanded into identical rounds. Trainer B still cannot see or mutate trainer A's templates or rounds (RLS verification SQL passes).

Verify by: creating a 3-round-per-exercise template through the UI, editing it (add/remove/duplicate rounds), reloading, and running the new RLS Studio script — all checks PASS, all unit tests green, lint + typecheck + build clean.

### Key Discoveries:

- Replace-all update already deletes `template_exercises` per template (`service.ts:160`); a `template_exercise_sets` table with `on delete cascade` from `template_exercises` means rounds are cleaned up automatically on that delete — no extra delete step needed.
- `set_logs` already demonstrates the per-set + RLS-via-parent-chain pattern we mirror (`supabase/migrations/20260526120400_sessions_logging_comments.sql`), so the convention exists in-repo.
- Metric (reps vs duration) is **inferred** from which column is non-null — no `metric` column exists. We keep inference at the exercise level (all rounds of one exercise share a metric mode), matching today's UX.
- The Supabase JS client has no transaction API; create/update must insert parents, read back their ids via `.select()`, then insert children — a genuine ordering constraint (see Critical Implementation Details).

## What We're NOT Doing

- **Not** restructuring `session_exercises` / assigned-session snapshots — deferred to S-04 (plan-assignment). Flat `session_exercises` columns stay as-is; S-14 is template-only per the roadmap (Prereq: S-02 only). This is called out as a follow-up below.
- **Not** building session creation, guided logging, or any client-facing view.
- **Not** adding drag-and-drop for rounds (Up/Down reorder only, matching the existing exercise reorder pattern).
- **Not** introducing a `metric` column or per-round metric switching — metric stays per-exercise.
- **Not** allowing per-round notes — notes remain at the exercise level.
- **Not** adding round templates / "apply to all rounds" bulk presets beyond "Duplicate last round".

## Implementation Approach

Three phases, bottom-up, each independently verifiable: (1) data model + migration + types, (2) API contracts (schema/service/routes/tests), (3) per-round editor UI + form-validation + RLS verification. The replace-all create/update path is preserved but upgraded to a two-step nested insert. Existing templates are migrated by expanding their flat prescription into round rows before the flat columns are dropped, so no template loses data.

## Critical Implementation Details

- **Per-exercise nested insert (no transactions):** `createTemplate`/`updateTemplate` must persist the nested collection with an **explicit id↔sets binding** — do NOT rely on PostgREST returning bulk-inserted rows in input order (that ordering is not contractually guaranteed; a mismatch would silently attach rounds to the wrong exercise). For each input exercise, insert its `template_exercises` row with `.select().single()` to obtain the generated id, then immediately insert that exercise's `sets[]` as `template_exercise_sets` rows carrying the returned `template_exercise_id` (with `set_number` = index+1). This is O(2N) round-trips, negligible at MVP scale, and removes the correlation risk entirely. On any insert failure during create, the existing rollback (delete the template) cleans everything via cascade; surface the error to the caller.
- **Backfill must precede column drop:** the migration inserts `template_exercise_sets` rows generated from existing `template_exercises` (one per set 1..`prescribed_sets`, copying reps/duration/load/rest) **before** `alter table ... drop column`. Use `generate_series(1, prescribed_sets)` to expand.
- **RLS for the new table** is derived two levels up: `template_exercise_sets` → `template_exercises` → `session_templates.trainer_id = auth.uid()`. Insert policy does not need to re-check exercise ownership (the parent `template_exercises` insert policy already enforces `exercises.trainer_id = auth.uid()`).

## Phase 1: Data model, migration, and types

### Overview

Create the `template_exercise_sets` table with RLS, backfill existing prescriptions into round rows, drop the now-redundant flat columns from `template_exercises`, and update the shared TypeScript types.

### Changes Required:

#### 1. New migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_per_round_template_prescription.sql` (timestamp > `20260605120000`)

**Intent**: Add per-round prescription storage, migrate existing data, then remove the flat per-exercise prescription columns.

**Contract**:
- Create `public.template_exercise_sets`:
  - `id uuid pk default gen_random_uuid()`
  - `template_exercise_id uuid not null references public.template_exercises(id) on delete cascade`
  - `set_number integer not null` (1-based)
  - `prescribed_reps integer`, `prescribed_duration_seconds integer`, `prescribed_load_kg numeric(10,2)`, `rest_after_seconds integer`
  - `unique (template_exercise_id, set_number)`
  - index on `template_exercise_id`
- Enable RLS; `grant select, insert, update, delete ... to authenticated`; four policies (select/insert/update/delete) each gated by `exists (select 1 from template_exercises te join session_templates st on st.id = te.template_id where te.id = template_exercise_sets.template_exercise_id and st.trainer_id = auth.uid())`.
- Backfill: `insert into template_exercise_sets (template_exercise_id, set_number, prescribed_reps, prescribed_duration_seconds, prescribed_load_kg, rest_after_seconds) select te.id, gs, te.prescribed_reps, te.prescribed_duration_seconds, te.prescribed_load_kg, te.rest_after_seconds from template_exercises te cross join lateral generate_series(1, greatest(te.prescribed_sets, 1)) as gs;`
- After backfill: `alter table public.template_exercises drop column prescribed_sets, drop column prescribed_reps, drop column prescribed_duration_seconds, drop column prescribed_load_kg, drop column rest_after_seconds;`
- Add `comment on table public.template_exercise_sets is 'Per-round prescription for a template exercise.'`.

#### 2. Shared types

**File**: `src/types.ts`

**Intent**: Replace `TemplateExercise`'s flat prescription fields with a nested `sets` collection; add a `TemplateExerciseSet` interface. Leave `SessionExercise` untouched (deferred to S-04).

**Contract**: New `TemplateExerciseSet { id; template_exercise_id; set_number; prescribed_reps: number | null; prescribed_duration_seconds: number | null; prescribed_load_kg: number | null; rest_after_seconds: number | null }`. `TemplateExercise` drops `prescribed_sets`, `prescribed_reps`, `prescribed_duration_seconds`, `prescribed_load_kg`, `rest_after_seconds`; keeps `id`, `template_id`, `exercise_id`, `phase`, `sort_order`, `notes`, and gains `sets: TemplateExerciseSet[]`.

#### 3. ERD documentation

**File**: `docs/ERD.md`

**Intent**: Keep the canonical schema diagram in sync — S-04 will read it when designing the `session_exercises` per-round mirror.

**Contract**: In the `template_exercises` entity (lines ~84-96), remove the `prescribed_sets`/`prescribed_reps`/`prescribed_duration_seconds`/`prescribed_load_kg`/`rest_after_seconds` fields. Add a `template_exercise_sets` entity (id, template_exercise_id FK, set_number, prescribed_reps, prescribed_duration_seconds, prescribed_load_kg, rest_after_seconds) and a `template_exercises ||--o{ template_exercise_sets` relationship line. Leave `session_exercises` unchanged (S-04 follow-up).

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset`
- Type checking passes: `npm run lint` (ESLint type-checked rules; this is the typecheck gate)
- Build passes: `npm run build`

#### Manual Verification:

- Backfill verified by migrating onto a populated DB (`db reset` alone CANNOT test it — it runs the migration against an empty DB, so `generate_series` sees zero rows): (1) with this migration file temporarily moved out of `supabase/migrations/`, run `npx supabase db reset`; (2) in Studio, insert a `session_template` + a `template_exercises` row with `prescribed_sets = 3` and known `prescribed_reps`/`prescribed_load_kg`/`rest_after_seconds`; (3) move the migration file back and run `npx supabase migration up`; (4) assert `template_exercise_sets` has exactly 3 rows for that exercise with `set_number` 1..3 and reps/load/rest matching the legacy values.
- `template_exercises` no longer has the flat prescription columns (verify in Studio).
- `docs/ERD.md` reflects the new schema (flat fields removed from `template_exercises`; `template_exercise_sets` entity + relationship added).

**Implementation Note**: After this phase, `src/types.ts` changes will break the service/form layers (compile errors expected until Phase 2/3). Pause for manual confirmation that the migration + backfill are correct (run the backfill recipe above — not just `db reset`) before proceeding.

---

## Phase 2: API contracts — schema, service, routes, tests

### Overview

Make the API accept and return the nested round collection, with replace-all semantics upgraded to a two-step nested insert.

### Changes Required:

#### 1. Zod schemas

**File**: `src/lib/session-templates/schemas.ts`

**Intent**: Replace the flat prescribed fields on `templateExerciseInputSchema` with a `sets` array; each set carries reps/duration/load/rest. Enforce per-round validity.

**Contract**: New `templateExerciseSetInputSchema = z.object({ prescribed_reps: int≥1 nullable, prescribed_duration_seconds: int≥1 nullable, prescribed_load_kg: gt(0) nullable, rest_after_seconds: int≥0 nullable }).refine(reps != null || duration != null, "each round needs reps or duration")`. `templateExerciseInputSchema` keeps `exercise_id`, `phase`, `sort_order`, `notes`; drops the flat `prescribed_*`; adds `sets: z.array(templateExerciseSetInputSchema).min(1, "at least one round").max(20, "too many rounds")`. Update inferred type exports (`TemplateExerciseInput`, add `TemplateExerciseSetInput`).

#### 2. Service layer

**File**: `src/lib/session-templates/service.ts`

**Intent**: Read sets via the join, and write them through a two-step nested insert in both create and update.

**Contract**:
- `TemplateExerciseWithName` = updated `TemplateExercise` (now with `sets`) + `exercise_name` + `exercise_default_metric`.
- `getTemplate` join becomes `*, template_exercises(*, exercises(name, default_metric), template_exercise_sets(*))`; `mapTemplateExerciseRow` maps nested `template_exercise_sets` into `sets` sorted by `set_number`.
- `createTemplate` / `updateTemplate`: persist exercises with a per-exercise loop — for each input exercise insert its `template_exercises` row via `.select().single()`, then insert that exercise's `sets[]` as `template_exercise_sets` rows using the returned id and `set_number` = index+1 (explicit id↔sets binding; never zip-by-index, see Critical Implementation Details). Update keeps the existing `delete template_exercises` step (sets cascade away); on any error return `{ error }`. Create keeps template-rollback on child-insert failure.

#### 3. API routes

**File**: `src/pages/api/session-templates/index.ts`, `src/pages/api/session-templates/[id].ts`

**Intent**: No handler-shape change beyond inheriting the new schema; confirm GET-by-id returns nested `sets`.

**Contract**: Request bodies validate against the updated `create`/`update` schemas. `GET /api/session-templates/[id]` response `{ template: TemplateWithExercises }` now includes `exercises[].sets`. Error envelope unchanged.

#### 4. Schema unit tests

**File**: `src/lib/session-templates/schemas.test.ts`

**Intent**: Cover the new nested structure and round-level validation.

**Contract**: Cases for: valid multi-round exercise; `sets: []` rejected (min 1); round with both reps and duration null rejected; `>20` rounds rejected; load `≤0` rejected.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test` (or the repo's vitest command) for `schemas.test.ts`
- Lint/typecheck passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- `POST`/`PATCH` a template with 3 differing rounds via curl or the UI returns 201/200; `GET /api/session-templates/[id]` returns the rounds in order.

**Implementation Note**: Pause for manual confirmation that round persistence + read-back works end-to-end via the API before building the UI.

---

## Phase 3: Per-round editor UI, form-validation, and RLS verification

### Overview

Grow `TemplateForm` from single-value inputs to a per-round editor, update the form-validation mapping layer, and ship a fresh RLS verification script for the new table.

### Changes Required:

#### 1. Form-validation helpers

**File**: `src/lib/session-templates/form-validation.ts`

**Intent**: Move per-round numeric fields into a `rounds` array on the form entry; map to/from the API `sets` shape; keep `metricMode` and `notes` at the exercise level.

**Contract**:
- New `TemplateExerciseSetFormEntry { prescribedReps: number | null; prescribedDuration: number | null; prescribedLoadKg: number | null; restAfterSeconds: number | null }`.
- `TemplateExerciseFormEntry` drops the single `prescribedSets`/`prescribedReps`/`prescribedDuration`/`prescribedLoadKg`/`restAfterSeconds`; keeps `exerciseId`, `exerciseName`, `exerciseDefaultMetric`, `phase`, `metricMode`, `notes`; adds `rounds: TemplateExerciseSetFormEntry[]`.
- `exerciseToFormEntry`: seed `rounds` with one default round (reps 10 or duration 30 per `defaultMetricMode`).
- `templateExerciseToFormEntry`: build `rounds` from `sets`; infer `metricMode` from the first round's non-null field (fallback to `exercise_default_metric`).
- `exerciseEntryToPayload`: emit `sets[]`, nulling reps or duration per `metricMode` for every round; drop `prescribed_sets`.
- Add helpers: `addRound(entry)` (duplicate last round's values, or default if none), `removeRound(entry, i)`, `updateRound(entry, i, patch)`.

#### 2. TemplateForm component

**File**: `src/components/session-templates/TemplateForm.tsx`

**Intent**: Replace the single Sets/Reps/Duration/Load/Rest input grid with a per-round table; add round add/duplicate/remove controls.

**Contract**: Per exercise row: keep name header, reorder/remove exercise buttons, the Reps|Duration metric toggle (now applies to all rounds), and Notes. Below, render `entry.rounds` as numbered rows (Round 1, 2, …), each with reps-or-duration / load / rest inputs and a per-round remove button; footer has "Add round" and "Duplicate last round" buttons. Wire to the new form-validation helpers. Preserve existing styling (`inputClass`, phase sections, submit/cancel/delete). Validation error mapping (`mapApiIssues`) should surface round-level issues to `errors.form`.

#### 3. Edit page hydration

**File**: `src/pages/trainer/templates/[id].astro`

**Intent**: Confirm the SSR `getTemplate` result (now with nested `sets`) flows into `initialTemplate.exercises` unchanged.

**Contract**: No structural change expected — `template.exercises` already passed as prop; verify the type now includes `sets`.

#### 4. Form-validation unit tests

**File**: `src/lib/session-templates/form-validation.test.ts`

**Intent**: Cover the rounds mapping both directions and the add/duplicate/remove helpers.

**Contract**: Cases for: `exerciseToFormEntry` seeds one round; `templateExerciseToFormEntry` rebuilds rounds + infers metricMode; `exerciseEntryToPayload` emits per-round `sets` with correct nulling; `addRound` duplicates last round; `removeRound` keeps ≥1 round invariant (or surfaces error if removing the last).

#### 5. RLS verification SQL

**File**: `context/changes/exercises-separate-rounds/verification.sql`

**Intent**: Prove trainer isolation reaches the new `template_exercise_sets` table.

**Contract**: Adapt `context/changes/session-templates/verification.sql` — same two-trainer fixture, but insert a `template_exercise_sets` row under trainer A's template exercise; assert trainer A reads/updates/deletes its rounds, trainer B sees 0 rounds and cannot mutate them. Single transaction, `set local role authenticated`, transaction-scoped `set_config` for `request.jwt.claim.sub`/`role`, explicit PASS/FAIL per check, `rollback` at the end (per lessons.md).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test`
- Lint/typecheck passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Create a template where one exercise has 3 rounds with different reps/load/rest; save; reload edit page → all rounds render correctly in order.
- "Add round" / "Duplicate last round" / per-round remove behave as expected; cannot save an exercise with 0 rounds.
- Legacy template (migrated) opens in edit with its prescription shown as N identical rounds.
- Paste `verification.sql` into Supabase Studio → every check shows PASS.

**Implementation Note**: After automated checks pass, pause for manual confirmation of the round editor UX and the RLS script before closing the change.

---

## Testing Strategy

### Unit Tests:

- `schemas.test.ts`: nested `sets` validation, min/max rounds, reps-or-duration refinement, load bounds.
- `form-validation.test.ts`: round mapping (both directions), metricMode inference, add/duplicate/remove round helpers, payload nulling.

### Integration Tests:

- None automated (repo has no integration harness). Covered by manual API round-trip + UI verification.

### Manual Testing Steps:

1. `npx supabase db reset`; seed/inspect a legacy template → confirm backfill produced identical rounds.
2. In the UI, create a multi-round template, save, reload, edit (add/remove/duplicate rounds), save again, reload → state persists.
3. Run `context/changes/exercises-separate-rounds/verification.sql` in Studio → all PASS.

## Performance Considerations

Round counts are tiny (≤20 per exercise, a handful of exercises per template). The extra join (`template_exercise_sets(*)`) adds negligible cost; the two-step insert is two round-trips instead of one — acceptable for single-trainer authoring.

## Migration Notes

- Backfill runs inside the migration before the column drop; `greatest(prescribed_sets, 1)` guards against any zero/null count. Existing templates become N identical rounds — semantically equivalent to the old uniform prescription.
- Backfill correctness cannot be proven by `npx supabase db reset` (that migrates an empty DB). Verify it by migrating onto a populated DB — see the Phase 1 manual verification recipe (apply prior migrations → insert a legacy `template_exercises` row → run `supabase migration up` for this migration → assert expanded rows).
- Irreversible: dropping the flat columns means a down-migration would lose per-round data. Acceptable for pre-launch MVP with no production data.
- **Follow-up for S-04:** when plan-assignment is built, `session_exercises` must adopt the same per-round model (a `session_exercise_sets` table) and the session-creation/snapshot logic must copy `template_exercise_sets` → `session_exercise_sets`. Logged data already lives per-set in `set_logs`; only the *prescription* snapshot needs the parallel structure.

## References

- Roadmap slice: `context/foundation/roadmap.md` S-14 (`:243`)
- Existing S-02 plan: `context/changes/session-templates/plan.md`
- Service replace-all: `src/lib/session-templates/service.ts:117-185`
- Form inputs to replace: `src/components/session-templates/TemplateForm.tsx:388-482`
- RLS-via-parent precedent: `supabase/migrations/20260526120400_sessions_logging_comments.sql` (`set_logs`)
- RLS verification template: `context/changes/session-templates/verification.sql`
- Lessons: `context/foundation/lessons.md` (copy-paste Studio SQL; nav for new routes — N/A here)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data model, migration, and types

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — e0895e4
- [x] 1.2 Type checking passes: `npm run lint` — 0abdf9c
- [x] 1.3 Build passes: `npm run build` — e0895e4

#### Manual

- [x] 1.4 Backfill produced one round row per original set with matching reps/load/rest (verified via migrate-onto-populated-DB recipe) — e0895e4
- [x] 1.5 Flat prescription columns removed from `template_exercises` — e0895e4
- [x] 1.6 `docs/ERD.md` updated to new schema (template_exercise_sets entity + relationship) — e0895e4

### Phase 2: API contracts — schema, service, routes, tests

#### Automated

- [x] 2.1 Schema unit tests pass: `npm run test` — 0abdf9c
- [x] 2.2 Lint/typecheck passes: `npm run lint` — 0abdf9c
- [x] 2.3 Build passes: `npm run build` — 0abdf9c

#### Manual

- [x] 2.4 POST/PATCH + GET-by-id round-trip returns rounds in order — 0abdf9c

### Phase 3: Per-round editor UI, form-validation, and RLS verification

#### Automated

- [x] 3.1 Form-validation unit tests pass: `npm run test` — f6a0146
- [x] 3.2 Lint/typecheck passes: `npm run lint` — f6a0146
- [x] 3.3 Build passes: `npm run build` — f6a0146

#### Manual

- [x] 3.4 Create/edit multi-round template; reload persists all rounds in order — f6a0146
- [x] 3.5 Add/Duplicate/Remove round controls behave correctly; cannot save 0 rounds — f6a0146
- [x] 3.6 Legacy migrated template opens with N identical rounds — f6a0146
- [x] 3.7 `verification.sql` shows every check PASS in Supabase Studio — f6a0146
