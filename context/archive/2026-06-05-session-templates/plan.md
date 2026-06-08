# Session Templates Implementation Plan

## Overview

Implement trainer-facing session template CRUD for MVP slice S-02. Trainers can create reusable session blueprints organized into Warm-up / Main / Cool-down phases with ordered exercises, prescribed sets/reps-or-duration/load/rest per exercise, and can edit or delete existing templates.

DB schema is already migrated (`session_templates`, `template_exercises`, RLS). Types are already in `src/types.ts`. All work is pure API + UI following S-01 exercise library patterns.

## Current State Analysis

- `session_templates` and `template_exercises` tables exist with full RLS (`supabase/migrations/20260526120300_templates_and_plans.sql`).
- `src/types.ts` already defines `SessionTemplate`, `TemplateExercise`, `ExercisePhase`.
- No service module, no API routes, no UI pages, no nav entry exists yet.
- `src/lib/exercises/` pattern (schemas.ts, service.ts, form-validation.ts) is the established blueprint.
- `src/lib/api/guards.ts` (`requireTrainer`), `src/lib/api/responses.ts` (`jsonError`, `jsonResponse`) are reusable.
- Middleware already protects `/trainer/*` routes by role.
- Trainer exercise list (needed for the picker) is available via `GET /api/exercises`.

### Key Discoveries:

- `template_exercises.exercise_id` references `exercises(id) ON DELETE RESTRICT` — templates cannot be deleted if their exercises were hard-deleted elsewhere (rare but notable; cascade is on template side only).
- `template_exercises` has no RLS policies of its own on update/insert that allow orphan rows: both policies check `session_templates.trainer_id = auth.uid()` AND (for insert) `exercises.trainer_id = auth.uid()` — a trainer cannot add another trainer's exercise to their template (`src/supabase/migrations/20260526120300_templates_and_plans.sql:103-121`).
- No `replace_template_exercises` RPC exists; replace-all must be done in service: delete existing rows, then bulk-insert new ones inside the same request handler.
- `exercise_phase` enum: `warm_up`, `main`, `cool_down` (PostgreSQL enum, already defined in migration).
- `ExerciseWithMuscleGroups` from `src/lib/exercises/service.ts` is already exported and provides exercise metadata needed for the picker.

## Desired End State

Trainer opens `/trainer/templates`, sees all their templates, clicks "New template" or an existing template name:

- Creates / edits template name and description.
- Organizes exercises into three phase sections (Warm-up / Main / Cool-down), each with a "Add exercise" button that opens a search modal listing their library.
- Each exercise row shows a toggle (Reps | Duration), plus sets, the active metric field, optional load (kg) and rest (s) fields, optional notes, and Up/Down reorder buttons.
- Saves template (single API call, exercises embedded). On create → redirect to list with success flash. On update → stay on edit page with flash.
- Deletes template from edit page (confirmed, hard delete, cascade).
- Templates link appears in Topbar trainer nav; trainer dashboard has a quick-link card.

## What We're NOT Doing

- Session assignment from templates (S-04 scope: assigning templates to client plans / sessions).
- Template duplication / copy workflow.
- Exercise reordering across phases (only within-phase reorder is supported).
- Drag-and-drop (Up/Down buttons only in this slice).
- Soft archive for templates (hard delete; no `is_archived` column added).
- Client-visible template views.
- Pagination / search of template list (MVP scale).

## Implementation Approach

Two-phase incremental delivery mirroring S-01:

1. Build API contracts with typed zod validation, a service layer using replace-all semantics for exercises, and SSR join queries for edit-page hydration.
2. Build trainer UI pages with TemplateForm (3 collapsible phase sections + per-phase ExercisePickerModal + Up/Down reorder) and wire navigation into Topbar + dashboard.

## Critical Implementation Details

- **Replace-all semantics for template_exercises**: On PATCH, the service deletes all existing `template_exercises` rows for the template and bulk-inserts the new list. This avoids needing individual row IDs from the client. The delete+insert must happen in the same Supabase query sequence; Supabase JS client does not natively support transactions, so we do delete then insert and accept the tiny window of inconsistency (acceptable for non-concurrent single-trainer MVP use).
- **sort_order is client-managed**: The client sends exercises with `sort_order` already set (0-indexed within each phase). The service trusts this order. Up/Down buttons in the form swap adjacent items' positions in the React state array before submit.
- **Exercise picker data flow**: Astro pages fetch the trainer's full exercise list server-side (via `listExercises`) and pass it as a prop to `TemplateForm`. The picker modal filters this prop array client-side — no additional network call on modal open.
- **Prescribed fields toggle**: Each exercise row has a `Reps | Duration` toggle that controls which field renders. Default is derived from `exercise.default_metric` when an exercise is first added (`reps_weight` → Reps; `time` or `distance` → Duration). Toggle is local React state per row; both fields remain nullable in the submitted payload.

---

## Phase 1: Template API contracts

### Overview

Create typed zod schemas, a service module with CRUD + join read, and two API endpoints. No UI changes in this phase.

### Changes Required:

#### 1. Session template zod schemas

**File**: `src/lib/session-templates/schemas.ts`

**Intent**: Define zod validation for template create/update payloads, template_exercise entries within those payloads, and the template UUID param — following the exact shape of `src/lib/exercises/schemas.ts`.

**Contract**:

- `templateExerciseInputSchema`: `{ exercise_id: uuid, phase: ExercisePhase enum, sort_order: int ≥ 0, prescribed_sets: int ≥ 1, prescribed_reps: int ≥ 1 | null, prescribed_duration_seconds: int ≥ 1 | null, prescribed_load_kg: number > 0 | null, rest_after_seconds: int ≥ 0 | null, notes: string | null }`
- `createTemplateBodySchema`: `{ name: string non-empty, description: string | null, exercises: templateExerciseInputSchema[] min-0 }` (empty array allowed — template shell without exercises is valid)
- `updateTemplateBodySchema`: same fields all optional, `exercises` if present replaces all
- `templateIdParamSchema`: UUID
- Export `CreateTemplateBody`, `UpdateTemplateBody`, `TemplateExerciseInput` types
- Export `formatZodIssues` (re-export or copy from exercises/schemas.ts)

#### 2. Session template service

**File**: `src/lib/session-templates/service.ts`

**Intent**: Encapsulate all Supabase operations for templates and their exercises: list, get (with exercises joined), create (with exercise bulk-insert), update (replace-all exercises), delete.

**Contract**:

- `listTemplates(supabase, trainerId): Promise<{ data: SessionTemplate[] | null, error: string | null }>`
- `getTemplate(supabase, templateId): Promise<{ data: TemplateWithExercises | null, error: string | null }>` — joins `template_exercises` and additionally fetches `exercises.name` and `exercises.default_metric` for display in the edit form
- `createTemplate(supabase, trainerId, body: CreateTemplateBody): Promise<{ data: SessionTemplate | null, error: string | null }>`
- `updateTemplate(supabase, templateId, body: UpdateTemplateBody): Promise<{ data: SessionTemplate | null, error: string | null }>` — if `body.exercises` present, delete all existing template_exercises then bulk-insert
- `deleteTemplate(supabase, templateId): Promise<{ error: string | null }>`
- Export `TemplateWithExercises = SessionTemplate & { exercises: TemplateExerciseWithName[] }` where `TemplateExerciseWithName` adds `exercise_name: string` and `exercise_default_metric: ExerciseMetric`

#### 3. Template list/create endpoint

**File**: `src/pages/api/session-templates/index.ts`

**Intent**: `GET` returns all trainer's templates (no filters needed at MVP scale); `POST` creates a new template with embedded exercises.

**Contract**: `GET` — trainer-only, returns `{ templates: SessionTemplate[] }`. No exercise count in list response; count is not shown on the list page (list shows name + description only). `POST` — validates body with `createTemplateBodySchema`, calls `createTemplate` service, returns `{ template: SessionTemplate }` with 201.

#### 4. Template detail/update/delete endpoint

**File**: `src/pages/api/session-templates/[id].ts`

**Intent**: `GET` returns template with full exercise detail for edit-page hydration; `PATCH` updates template (replace-all exercises if provided); `DELETE` hard-deletes with cascade.

**Contract**: All methods validate `id` param as UUID and enforce `requireTrainer`. `GET` returns `{ template: TemplateWithExercises }`. `PATCH` validates `updateTemplateBodySchema`, returns `{ template: SessionTemplate }`. `DELETE` returns 204 on success, 404 if not found.

#### 5. Schema unit tests

**File**: `src/lib/session-templates/schemas.test.ts`

**Intent**: Validate zod schema behavior for common edge cases: empty exercises array, invalid phase enum, sort_order boundary, prescribed field nullability.

**Contract**: Tests follow the pattern in `src/lib/exercises/schemas.test.ts`. Cover: valid create payload passes, missing required fields fail, invalid phase enum fails, both prescribed_reps and prescribed_duration_seconds null passes (both nullable), sort_order = 0 passes.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes after all API and schema additions.
- `npm run build` passes.
- `npm run test` passes including new schema unit tests.
- TypeScript strict-mode passes on all new files.

#### Manual Verification:

- Authenticated trainer can POST a template with exercises via curl/Postman and receive 201.
- PATCH with new exercises list replaces old exercises correctly.
- DELETE removes template and template_exercises (verify via GET returning 404).
- Non-trainer access returns 403; unauthenticated returns 401.
- Trainer B cannot read or modify trainer A's templates (RLS enforcement).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Template UI, navigation, and hardening

### Overview

Build trainer-facing pages (list / new / edit), the TemplateForm React component with per-phase sections, ExercisePickerModal, and wire navigation into Topbar + dashboard. Also add RLS verification SQL and update the dashboard entry point.

### Changes Required:

#### 1. Template form-validation helpers

**File**: `src/lib/session-templates/form-validation.ts`

**Intent**: Extract payload assembly, metricMode defaulting, and client-side validation into a separately testable module — following the `src/lib/exercises/form-validation.ts` pattern from S-01.

**Contract**:

- `TemplateExerciseFormEntry` type: the React state shape for one exercise row (`{ exerciseId, exerciseName, exerciseDefaultMetric, phase, prescribedSets, metricMode: "reps" | "duration", prescribedReps, prescribedDuration, prescribedLoadKg, restAfterSeconds, notes }`)
- `defaultMetricMode(exercise: ExerciseWithMuscleGroups): "reps" | "duration"` — returns "reps" for `reps_weight`, "duration" for `time` or `distance`
- `exerciseEntryToPayload(entry: TemplateExerciseFormEntry, sortOrder: number): TemplateExerciseInput` — maps form state to API payload shape
- `assembleTemplatePayload(name, description, phaseEntries): CreateTemplateBody | UpdateTemplateBody` — joins all phases with correct sort_order per phase
- Export types consumed by `TemplateForm.tsx`

#### 2. Template form-validation unit tests

**File**: `src/lib/session-templates/form-validation.test.ts`

**Intent**: Test payload assembly and metricMode defaulting edge cases.

**Contract**: Cover: `defaultMetricMode` for all three ExerciseMetric values, `exerciseEntryToPayload` with reps/duration modes, `assembleTemplatePayload` sort_order assignment per phase (each phase independently 0-indexed), empty exercises array passes.

#### 3. TemplateForm component

**File**: `src/components/session-templates/TemplateForm.tsx`

**Intent**: React form component supporting create and edit modes. Renders name + description fields, then three collapsible phase sections (Warm-up / Main / Cool-down), each with its exercise list and an "Add exercise" button that opens ExercisePickerModal. Each exercise row shows Up/Down reorder buttons, Reps/Duration toggle, prescribed fields, load, rest, notes, and a remove button.

**Contract**:

- Props: `mode: "create" | "edit"`, `templateId?: string`, `availableExercises: ExerciseWithMuscleGroups[]`, `initialTemplate?: { name, description, exercises: TemplateExerciseWithName[] }`
- Internal state: `name`, `description`, per-phase exercise arrays (each item: `{ exerciseId, exerciseName, defaultMetric, prescribedSets, metricMode: "reps" | "duration", prescribedReps, prescribedDuration, prescribedLoadKg, restAfterSeconds, notes }`)
- On submit: assemble payload with `sort_order` = index within each phase array; POST to `/api/session-templates` or PATCH to `/api/session-templates/:id`
- On create success: `window.location.assign("/trainer/templates?created=1")`
- On update success: `window.location.assign(`/trainer/templates/${templateId}?updated=1`)`
- Error handling: map API `validation_error` issues to field-level errors; generic form error for other failures

#### 2. ExercisePickerModal component

**File**: `src/components/session-templates/ExercisePickerModal.tsx`

**Intent**: Modal that receives the full `availableExercises` list as a prop, filters client-side by name search, excludes exercises already in the target phase, and calls `onPick(exercise)` when one is selected. No network call on open.

**Contract**:

- Props: `open: boolean`, `onClose: () => void`, `onPick: (exercise: ExerciseWithMuscleGroups) => void`, `availableExercises: ExerciseWithMuscleGroups[]`
- No exclusion: the same exercise can be added multiple times to the same phase or across phases (trainers may interleave identical exercises, e.g., ABCABC patterns)
- Search input filters `exercise.name` case-insensitively against the query
- Selecting an exercise calls `onPick` and closes the modal (picker does not close on its own — only on selection or explicit close)

#### 3. Template list page

**File**: `src/pages/trainer/templates/index.astro`

**Intent**: Server-rendered page showing all trainer templates in a table with name, description, and "Edit" link. Flash messages for created/updated/deleted.

**Contract**: Calls `listTemplates(supabase, user.id)` server-side. List shows name and description only (no exercise count). Flash via `?created=1`, `?updated=1`, `?deleted=1` query params.

#### 4. New template page

**File**: `src/pages/trainer/templates/new.astro`

**Intent**: Server-rendered page that fetches the trainer's exercise list and renders TemplateForm in create mode.

**Contract**: Calls `listExercises(supabase, {})` server-side (reuses S-01 service). Renders `<TemplateForm client:load mode="create" availableExercises={...} />`.

#### 5. Edit template page

**File**: `src/pages/trainer/templates/[id].astro`

**Intent**: Server-rendered page that fetches the template with exercises AND the full exercise list for the picker. Renders TemplateForm in edit mode with initial data.

**Contract**: Calls `getTemplate(supabase, id)` and `listExercises(supabase, {})` in parallel. 404 if template not found or `template.trainer_id !== user.id`. Passes `initialTemplate` and `availableExercises` to TemplateForm.

#### 6. Topbar navigation entry

**File**: `src/components/Topbar.astro`

**Intent**: Add "Templates" to the `trainerNav` array so it appears in the trainer's top navigation bar.

**Contract**: Insert `{ href: "/trainer/templates", label: "Templates" }` after "Clients" in the `trainerNav` array. Active-state highlighting already handled by `isActive()` via startsWith.

#### 7. Dashboard entry point

**File**: `src/pages/trainer/dashboard.astro`

**Intent**: Add a Templates quick-link card or section on the trainer dashboard so new trainers discover the feature without knowing the URL.

**Contract**: Add a card or list-item linking to `/trainer/templates` consistent with the dashboard's existing visual style. No data fetching needed — static link.

#### 8. RLS verification SQL

**File**: `context/changes/session-templates/verification.sql`

**Intent**: Copy-paste Studio script for manual local verification of RLS ownership isolation and CRUD behavior.

**Contract**: Single transaction using `begin`, `set local role authenticated`, scoped `set_config` for JWT claims; includes:

- Trainer A can insert/select/update/delete their own template and exercises
- Trainer A cannot select trainer B's templates or exercises
- Trainer A cannot insert template_exercises referencing trainer B's exercises
- `rollback` at end
  Follows the lesson from `context/foundation/lessons.md`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes for all new pages, components, form-validation module, and Topbar change.
- `npm run build` passes with new trainer template routes.
- `npm run test` passes (Phase 1 schema tests still green; new form-validation unit tests pass).

#### Manual Verification:

- Trainer sees "Templates" in Topbar navigation; active link highlights correctly on `/trainer/templates/*`.
- Trainer dashboard shows Templates entry/card.
- Trainer creates a template with exercises in all three phases, prescribed reps in one and duration in another, and sees it in the list.
- Trainer edits an existing template: changes description, adds exercise, reorders with Up/Down, saves — changes persist on re-load.
- Trainer deletes a template with confirmation; template disappears from list.
- Form error states render correctly: name required, empty exercise lists allowed, invalid fields highlight.
- RLS verification SQL confirms trainer B isolation.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before closing the slice.

---

## Testing Strategy

### Unit Tests:

- `src/lib/session-templates/schemas.test.ts`: zod schema edge cases (phase enum, nullable prescribed fields, sort_order bounds, empty exercises array).
- `src/lib/session-templates/form-validation.test.ts`: payload assembly from form state, `defaultMetricMode` for all metric types, `assembleTemplatePayload` sort_order assignment per phase.

### Integration Tests:

- API integration via curl / Postman: full CRUD matrix (create with 3-phase exercises, get, update replacing exercises, delete with cascade verification).
- Role-based access: unauthenticated → 401, client role → 403, other trainer → 403 on GET/PATCH/DELETE.

### Manual Testing Steps:

1. Create two trainer users (A and B) locally.
2. As trainer A: create several exercises in the exercise library.
3. As trainer A: create a template with exercises in all three phases; verify in list.
4. As trainer A: edit the template — add exercise, reorder, remove, toggle reps/duration; save and reload.
5. As trainer A: delete the template; verify list is empty.
6. As trainer B: confirm trainer A's templates are not visible.
7. Run `verification.sql` in Supabase Studio to confirm RLS isolation.

## Performance Considerations

- Template list query uses no pagination; acceptable at MVP scale (trainers unlikely to have >100 templates).
- Edit page join query fetches template_exercises + exercises in a single Supabase select with join — one round-trip.
- ExercisePickerModal filters the `availableExercises` prop client-side; no debounce needed at MVP library sizes.

## Migration Notes

No new migration required. All schema (`session_templates`, `template_exercises`, RLS, `exercise_phase` enum) is already applied in `20260526120300_templates_and_plans.sql`.

## References

- Schema and RLS: `supabase/migrations/20260526120300_templates_and_plans.sql`
- S-01 service pattern: `src/lib/exercises/service.ts`
- S-01 schema pattern: `src/lib/exercises/schemas.ts`
- S-01 form pattern: `src/components/exercises/ExerciseForm.tsx`
- Topbar nav: `src/components/Topbar.astro`
- Lessons: `context/foundation/lessons.md`
- Linear issue: [ZAW-7](https://linear.app/zawilecxd/issue/ZAW-7/session-templates-reusable-session-template-builder-with-phases)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Template API contracts

#### Automated

- [x] 1.1 `npm run lint` passes after API and schema additions — 2dc7e8e
- [x] 1.2 `npm run build` passes — 2dc7e8e
- [x] 1.3 `npm run test` passes including new schema unit tests — 2dc7e8e
- [x] 1.4 TypeScript strict-mode passes on all new files — 2dc7e8e

#### Manual

- [x] 1.5 Authenticated trainer can POST a template with exercises and receive 201
- [x] 1.6 PATCH with new exercises list replaces old exercises correctly
- [x] 1.7 DELETE removes template and template_exercises; GET returns 404
- [x] 1.8 Non-trainer access returns 403; unauthenticated returns 401
- [x] 1.9 Trainer B cannot read or modify trainer A's templates (RLS)

### Phase 2: Template UI, navigation, and hardening

#### Automated

- [x] 2.1 `npm run lint` passes for all new pages, components, form-validation module, and Topbar change — e11a196
- [x] 2.2 `npm run build` passes with new trainer template routes — e11a196
- [x] 2.3 `npm run test` passes (Phase 1 schema tests still green; new form-validation unit tests pass) — e11a196

#### Manual

- [x] 2.4 "Templates" appears in Topbar trainer nav with correct active highlighting — e11a196
- [x] 2.5 Trainer dashboard shows Templates entry/card — e11a196
- [x] 2.6 Trainer creates a template with exercises in all three phases and sees it in list — e11a196
- [x] 2.7 Trainer edits template: add exercise, reorder, toggle reps/duration, save — changes persist on reload — e11a196
- [x] 2.8 Trainer deletes a template with confirmation; template disappears from list — e11a196
- [x] 2.9 Form error states render correctly (name required; invalid fields highlight) — e11a196
- [x] 2.10 RLS verification SQL confirms trainer B isolation — e11a196
