# Session template import/export Implementation Plan

## Overview

Trainers can export one session template as versioned JSON or XLSX (native per-set prescription, exercise **names** only) and import the same file back into their template library. Import never writes `workout_sessions` or `set_logs`. Assigning a template to a client stays the existing day-by-day calendar flow. Exercise names become unique per trainer (case-insensitive, including archived) so name-only files resolve unambiguously.

## Current State Analysis

- **Portable object is templates, not client calendars** (frame). APIs: `src/pages/api/session-templates/index.ts`, `[id].ts`. Create payload: `createTemplateBodySchema` in `src/lib/session-templates/schemas.ts` (`name`, `description`, `exercises[]` with UUID `exercise_id`, 1–20 sets).
- **UI home:** `TemplatesHub` on `/trainer/templates` (`src/pages/trainer/templates/index.astro`, `src/components/session-templates/TemplatesHub.tsx`). Header CTA is “New template” (~149–164). Nav already exists (`Topbar`, `BottomNav`).
- **Assignment unchanged:** `ClientPlanHub` → template picker → `POST /api/workout-sessions`. Session create caps **50 exercises**; template create currently has **no** exercise-count cap.
- **Exercises:** trainer-owned (`exercises.trainer_id`). Names are **not** unique (`20260526120200_exercise_library.sql`). Create/update do not check duplicates (`src/lib/exercises/service.ts`).
- **No file download, no xlsx dependency.** All APIs are JSON via `jsonError` / `jsonResponse`. `requireTrainer` + `export const prerender = false`.
- **Logging is out of scope.** `set_logs` is client-only; do not touch.
- **Lessons:** pass `trainerId` from the guard into services; put pure parse/encode in `src/lib/` not hooks; new user-facing entry points must be on existing template nav (already true).

## Desired End State

A trainer on `/trainer/templates` can download one template as `.json` or `.xlsx` and upload either format. Preview shows name clash (create / skip / overwrite). Commit is all-or-nothing: unresolved exercise names, metric mismatch, malformed rows, or ambiguous template-name matches abort with a fix-list and write nothing. Files never contain exercise UUIDs. Clients still log actuals in-app. Placing the template on a calendar is unchanged.

Verify: unique index rejects duplicate names (including case variants and archived); JSON and XLSX round-trip the same DTO; import creates or updates only `session_templates` + children; no `set_logs` / `workout_sessions` inserts.

### Key Discoveries:

- Template and session exercise/set shapes already match; transfer DTO should be name-based and map to `CreateTemplateBody` only after resolution (`src/lib/session-templates/schemas.ts:16–40`, `src/lib/workout-sessions/schemas.ts:10–36`).
- `getTemplate` already joins `exercise_name` and `exercise_default_metric` (`src/lib/session-templates/service.ts:80–93, 174–204`) — enough for name-only export.
- ExcelJS: `workbook.xlsx.writeBuffer()` / `workbook.xlsx.load(buffer)` (Node, API routes only — do not import ExcelJS in React islands).
- Postgres unique: `unique index on (trainer_id, lower(btrim(name)))` — identity is case-insensitive trim, display name stays the stored spelling.

## What We're NOT Doing

- Client import/export, feature flags, CSV
- Importing onto a client calendar / writing `workout_sessions`
- Writing or editing `set_logs` (no result columns as a product feature)
- Exercise UUIDs in JSON or XLSX
- Auto-creating missing exercises
- Screenshot extras: `%1RM`, wellbeing, compact `4x4` as source of truth, post-session notes
- Multi-week “program” object (PRD Non-Goal #12)
- Making session **template** names unique (if several templates share a case-insensitive name, import of that name aborts as ambiguous)

## Implementation Approach

Canonical **in-memory transfer DTO** (schema_version 1, one template). JSON and XLSX are encodings of that DTO. Import: decode → validate → resolve names against the trainer library → preview → commit via existing `createTemplate` / `updateTemplate`. Thread `trainerId` from `requireTrainer` into all new services.

**ExcelJS** is a runtime dependency used only in server transfer code and API routes. The browser fetches a blob from the export API (`Content-Disposition: attachment`).

## Critical Implementation Details

**Unique names before transfer.** Name-only import is unsafe until the unique index exists. Phase 1 must land (including suffixing existing duplicates) before Phase 2 resolver tests that assume uniqueness.

**Server-only XLSX.** Import ExcelJS in `src/lib/` used by API routes. Client islands download/upload files; they must not bundle ExcelJS.

**Identity vs check.** Exercise identity in the file is `lower(btrim(name))`. `default_metric` in the file is a **consistency check** against the library row; mismatch aborts the file. An archived library row with that name is **not** a bind: abort with `Exercise {name} is archived and cannot be used for import`. Load archived rows only to distinguish missing vs archived — never use `listExercises` (it hides them).

## Phase 1: Unique exercise names per trainer

### Overview

Make `exercises.name` unique per trainer, case-insensitive, including archived rows. Suffix existing duplicates so the index can apply. Create/update return a clear duplicate error.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_exercises_unique_name_per_trainer.sql`

**Intent**: Backfill duplicate names, then enforce uniqueness so import can resolve by name.

**Contract**: For each `(trainer_id, lower(btrim(name)))` group with count > 1, keep the earliest `created_at` (tie-break `id`) unchanged; rename others to `{original} (2)`, `{original} (3)`, … ensuring the new name does not collide (loop/suffix until free). Then:

```sql
create unique index exercises_trainer_id_name_ci_uidx
  on public.exercises (trainer_id, lower(btrim(name)));
```

Comment the index: unique per trainer, case-insensitive, includes archived.

#### 2. Service + API errors

**File**: `src/lib/exercises/service.ts`, `src/pages/api/exercises/index.ts`, `src/pages/api/exercises/[id].ts` (update path)

**Intent**: Map unique-violation to a stable API error so the exercise form can show “name already exists.”

**Contract**: `createExercise` / `updateExercise` still receive `trainerId` / `exerciseId` from the guard. On Postgres unique violation (`23505` on `createResult.error.code`), return error string `duplicate_name`. Routes: `jsonError("duplicate_name", 409)` — **not** a generic 500 and **not** `validation_error`. Archived rows count: creating “Bench” while archived “bench” exists must fail.

#### 3. Form UX

**File**: `src/lib/exercises/form-validation.ts` (if mapping API issues), `src/components/exercises/ExerciseForm.tsx`

**Intent**: Trainer sees a field-level message on duplicate name, not a generic failure.

**Contract**: Same pattern as existing `ExerciseForm.tsx` API mapping (`validation_error` + `details.message` around lines 132–189). Also handle `payload.error === "duplicate_name"` as a **name field** error (“An exercise with this name already exists”).

### Success Criteria:

#### Automated Verification:

- Unique index exists in the new migration file; `npm run lint` passes
- Integration test: insert two case-duplicate names for one trainer **before** the unique index exists (or as the backfill input), apply the migration/backfill, assert the kept name is unchanged, the other is suffixed (` (2)`), then a third case-variant insert fails; two trainers may share the same name
- `npm test` — any new unit tests pass
- `npm run test:integration` — unique-index + backfill test passes

#### Manual Verification:

- In local Supabase, create exercise “Squat”, then “squat” → rejected; second trainer can still create “Squat”
- Studio script (transaction + `rollback`): `begin;` `set local role authenticated;` `set_config` JWT `sub` to a real trainer UUID; `select auth.uid();` insert duplicate names (expect fail); insert for another trainer (expect pass); `rollback;` Document pass/fail next to each statement per `lessons.md`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Transfer schema + name-only resolver

### Overview

Define versioned DTO, encode/decode JSON, resolve exercise names (no UUIDs), all-or-nothing fix-list. No HTTP yet.

### Changes Required:

#### 1. Transfer schema

**File**: `src/lib/session-templates/transfer-schema.ts` (new), tests `src/lib/session-templates/transfer-schema.test.ts`

**Intent**: One canonical shape for a file, independent of encoding.

**Contract**: Zod object, `schema_version: 1` literal, `kind: "session_template"`, template `name` (trim min 1), `description` nullable, `exercises` array max **50**. Each exercise: `name` (string, no UUID), `default_metric` (`exerciseMetricSchema`), `phase`, `sort_order`, `notes` nullable, `sets` 1–20 using the same constraints as `templateExerciseSetInputSchema`. Reject unknown keys on the envelope if that matches existing schema style. Export TypeScript type from the schema.

#### 2. Resolver

**File**: `src/lib/session-templates/transfer-resolve.ts` (new), tests `*.test.ts`

**Intent**: Map DTO exercises to `exercise_id` UUIDs for `createTemplate` / `updateTemplate`.

**Contract**: Input: DTO + trainer library list `{ id, name, default_metric, is_archived }[]` loaded for `trainerId` **including archived rows** (do **not** use `listExercises`, which hard-filters `is_archived = false` at `src/lib/exercises/service.ts:85`). Match `lower(btrim(dto.name))` to that list. Missing name → unresolved (`Exercise {name} was not found in your library`). Name matches an **archived** row → abort that file with a fix-list item `Exercise {name} is archived and cannot be used for import` (trainer must unarchive or change the file). Name matches an active row but `default_metric` differs → mismatch. Output: either `{ ok: true, body: CreateTemplateBody }` or `{ ok: false, issues: { path, message }[] }`. Never invent exercises. Never bind an archived `exercise_id`. Never use file UUIDs (there are none).

#### 3. Template-name clash helper

**File**: same transfer module or `transfer-clash.ts`

**Intent**: Preview needs to know if the library already has this template name.

**Contract**: Case-insensitive trim match on `session_templates.name` for this trainer. 0 matches → `create`. 1 match → `existing_id` for skip/overwrite. 2+ matches → abort issue “ambiguous template name; rename duplicates in the library.”

### Success Criteria:

#### Automated Verification:

- `npm test` — schema rejects UUID fields, >50 exercises, >20 sets, missing reps-and-duration
- Resolver tests: match, case-insensitive match, missing name, **archived name → specific fix-list error**, metric mismatch, empty library
- Clash helper tests: 0 / 1 / many
- `npm run lint`

#### Manual Verification:

- None required (library-only). Spot-check a sample DTO JSON in a unit test snapshot or fixture file under `src/lib/session-templates/fixtures/` if useful.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: JSON export + import preview/commit APIs

### Overview

Trainer-only routes: export one template as JSON; preview import; commit import. All-or-nothing writes.

### Changes Required:

#### 1. Export service + route

**File**: `src/lib/session-templates/transfer-export.ts`, `src/pages/api/session-templates/[id]/export.ts`

**Intent**: Download one owned template as JSON attachment.

**Contract**: `export const prerender = false`. `GET` + `requireTrainer`. Query `format=json` (xlsx in Phase 4). `getTemplate`; if missing or `trainer_id !== guard.userId` → `not_found` 404 (do not leak). If the template has **more than 50 exercises**, `jsonError("validation_error", 400, { issues })` with a fix-list (do not 500 / do not emit a partial file). Build DTO from joined names/metrics (no ids). `Content-Type: application/json`, `Content-Disposition: attachment; filename="template-{slug}.json"`. Pass `trainerId` into the service. Filename slug from template name, filesystem-safe.

#### 2. Import preview + commit

**File**: `src/lib/session-templates/transfer-import.ts`, `src/pages/api/session-templates/import/preview.ts`, `src/pages/api/session-templates/import/commit.ts`

**Intent**: Validate and resolve without writes; then write only on commit.

**Contract**: `prerender = false`, `requireTrainer`. Accept `application/json` body `{ format: "json", document: <dto or raw> }` in this phase. Preview: parse → schema → resolve → clash. On any issue: `jsonError("validation_error", 400, { issues })` — **no inserts**. Success preview: `{ action_needed: "create" | "choose", existing_template: { id, name } | null, summary: { name, exercise_count } }` (`id` is informational for the UI only).

Commit body: `{ format: "json", document, action: "create" | "skip" | "overwrite" }`. **Do not accept `existing_template_id` (or any template UUID) from the client.** Commit **re-parses, re-resolves, and re-runs clash** on `document` (same pipeline as preview). Then: `skip` → 200 no-op (even if clash vanished). `create` only if clash count is 0; else 400. `overwrite` only if clash count is 1; derive `existingId` from that name match (plus `trainer_id === trainerId`); else 400. `overwrite` → `updateTemplate(existingId, { name, description, exercises })`. `create` → `createTemplate(trainerId, body)`. Failures after validation: `jsonError("create_failed" | "update_failed", 500)`. Do not wrap in a DB RPC unless existing template create is already non-atomic; match current `createTemplate` rollback behavior.

#### 3. Ownership on overwrite

**File**: `src/lib/session-templates/service.ts` (only if `updateTemplate` does not verify trainer)

**Intent**: Overwrite must not update another trainer’s template.

**Contract**: `getTemplate` + `trainer_id === trainerId` before update; else 404.

### Success Criteria:

#### Automated Verification:

- Unit tests for export DTO mapping (fixture template → no `exercise_id` keys)
- Export mapping/API: more than 50 exercises → `validation_error` 400 with issues, not a 500
- `npm test`; `npm run lint`; `npm run check` (or project equivalent typecheck)
- If adding a thin API test is awkward (no existing API test harness), cover import commit branching in `transfer-import.ts` unit tests with mocked template/exercise services

#### Manual Verification:

- Signed-in trainer: `GET /api/session-templates/{id}/export?format=json` downloads JSON without UUIDs
- Preview of a valid file with a new name → `create`; commit creates a template visible in the library
- Preview of a clashing name → `choose`; commit `overwrite` replaces exercises; `skip` leaves the original
- File with unknown exercise name → 400 issues, library unchanged
- Second trainer cannot export the first trainer’s id (404)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 4: XLSX encode/decode

### Overview

Same DTO as JSON, one worksheet, one data row per prescribed set. ExcelJS on the server.

### Changes Required:

#### 1. Dependency

**File**: `package.json`

**Intent**: Read/write xlsx in API/service layer.

**Contract**: Add `exceljs` to `dependencies` (not client bundle). Use `Workbook`, `addWorksheet`, `addRow`, `xlsx.writeBuffer()`, `xlsx.load(buffer)`. If `npm run build` fails bundling exceljs, set Vite SSR external in `astro.config.mjs` (`vite.ssr.external: ["exceljs"]` or the current Astro-documented equivalent). Do not import exceljs from React islands.

#### 2. Encoder / decoder

**File**: `src/lib/session-templates/transfer-xlsx.ts`, `src/lib/session-templates/transfer-xlsx.test.ts`

**Intent**: Lossless round-trip with the JSON DTO (native per-set grain).

**Contract**: Single sheet. Metadata rows (or named cells) for `schema_version`, `kind`, template `name`, `description`. Header row then data rows with columns: `phase`, `sort_order`, `exercise_name`, `default_metric`, `set_number`, `prescribed_reps`, `prescribed_duration_seconds`, `prescribed_load_kg`, `rest_after_seconds`, `is_warmup`, `exercise_notes`. Empty numeric cells → `null`. Decoder rebuilds nested `exercises[].sets` grouped by `(phase, sort_order, exercise_name)` preserving `set_number` order. No UUID columns. Decode errors → `{ path, message }[]` (e.g. missing sheet, bad version). Pretty styling is optional and must not be required for import.

#### 3. Wire format=xlsx

**File**: export + import routes from Phase 3

**Intent**: Same preview/commit pipeline as JSON.

**Contract**: Export `format=xlsx` → `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, filename `.xlsx`. Import preview/commit for xlsx: **`multipart/form-data` with file field `file`** (plus `action` on commit). JSON import stays `application/json` `{ format: "json", document, action? }` as in Phase 3. Do not use `document_base64`. Max size: reject over **1 MB** with `jsonError("payload_too_large", 413)`.

### Success Criteria:

#### Automated Verification:

- Round-trip test: DTO → buffer → DTO deep-equal (including null loads, warmup flags, three phases)
- Bad xlsx / wrong version → issues, not throw
- `npm test`; `npm run lint`

#### Manual Verification:

- Export xlsx opens in Excel/LibreOffice: one row per set, names readable
- Re-import that file after a trivial cell edit (e.g. load kg) previews and commits correctly
- Import of a truncated/garbled file returns a fix-list, no template written

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 5: TemplatesHub UI

### Overview

Import and export on the template library page. Extract interactive logic to a hook. Update Linear ZAW-57 acceptance criteria to match this plan (templates, not client-plan clone).

### Changes Required:

#### 1. Hub actions

**File**: `src/components/session-templates/TemplatesHub.tsx`, `src/components/hooks/useTemplateTransfer.ts` (new — has React state)

**Intent**: Trainer can export a row and import a file with preview.

**Contract**: Header: Import control next to “New template” (`cn()` for classes). Each row/card Actions: Export JSON and Export XLSX (or one Export menu with two formats). Import: file input, POST preview, modal listing summary + clash; buttons Create / Skip / Overwrite when `choose`; confirm runs commit; display `issues` fix-list on failure. Use existing dialog primitives (`src/components/ui/`). Refresh template list after successful create/overwrite (existing GET list). Empty state can mention import. Do not add `client_id`. Do not place controls on `ClientPlanHub`.

#### 2. Linear issue text

**File**: Linear ZAW-57 (via Linear MCP / dashboard)

**Intent**: Tracker matches the framed object so review/QA is not against the old client-plan JSON AC.

**Contract**: Outcome = trainer template library JSON+XLSX, name-only exercises, unique names, preview/commit, no logs, no calendar import. Keep the issue id `ZAW-57`.

### Success Criteria:

#### Automated Verification:

- `npm run lint`; `npm test`; `npm run build`
- Hook lives in `src/components/hooks/`; xlsx/json mapping stays in `src/lib/session-templates/`

#### Manual Verification:

- `/trainer/templates`: export JSON and XLSX for a real template; import creates a second template; clash preview overwrite/skip; unknown exercise name shows fix-list and does not create
- Client calendar: add session from imported template still works (existing picker)
- Client user cannot call import/export APIs (403)
- Linear ZAW-57 description matches this plan

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human.

---

## Testing Strategy

### Unit Tests:

- Unique-name suffix / case folding (integration, not an optional TS helper)
- Transfer zod schema (envelope, set constraints, 50-exercise cap)
- Name resolver and metric mismatch
- Template-name clash 0/1/many
- XLSX encode/decode round-trip
- Import commit action matrix (create/skip/overwrite/invalid)

### Integration Tests:

- Unique index across trainers vs same trainer (Phase 1)
- Existing session-template RLS tests still pass (no policy change expected)

### Manual Testing Steps:

1. Unique names: duplicate / case variant / archived collision
2. JSON export → import as new; clash overwrite/skip
3. XLSX export → open in a spreadsheet → import
4. Unknown exercise name: fix-list, no writes
5. Place imported template on a client calendar (existing flow)
6. Other trainer: 404 on export id

## Performance Considerations

Templates are small (≤50 exercises × 20 sets). 1 MB upload cap is enough. No new caching. ExcelJS load is per request.

## Migration Notes

Phase 1 unique index: suffixing changes display names of duplicate exercises. Placed sessions keep `exercise_id` (snapshot); only library labels change. Trainers may see “Bench Press (2)” after migrate. No rollback of index without a follow-up migration. Import/export needs no data backfill.

## References

- Frame: `context/changes/training-plan-import-export/frame.md`
- Linear: [ZAW-57](https://linear.app/zawilecxd/issue/ZAW-57/add-importexport-for-training-plans)
- Templates: `src/lib/session-templates/schemas.ts`, `service.ts`, `src/components/session-templates/TemplatesHub.tsx`
- Exercises: `src/lib/exercises/service.ts`, `supabase/migrations/20260526120200_exercise_library.sql`
- Responses/guards: `src/lib/api/responses.ts`, `src/lib/api/guards.ts`
- ExcelJS: `workbook.xlsx.writeBuffer()`, `workbook.xlsx.load(data)`
- Lessons: unique Studio SQL; `trainerId` from guard; hooks vs `src/lib/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Unique exercise names per trainer

#### Automated

- [x] 1.1 Unique index exists in the new migration file; `npm run lint` passes — e1040d7
- [x] 1.2 Integration test: case-duplicate backfill suffixes + unique index; two trainers may share a name — e1040d7
- [x] 1.3 `npm test` — any new unit tests pass — e1040d7
- [x] 1.4 `npm run test:integration` — unique-index + backfill test passes — e1040d7

#### Manual

- [ ] 1.5 Local Supabase: “Squat” then “squat” rejected; second trainer can create “Squat”
- [ ] 1.6 Studio script with begin/set local role/JWT/rollback documents pass/fail per statement

### Phase 2: Transfer schema + name-only resolver

#### Automated

- [x] 2.1 `npm test` — schema rejects UUID fields, >50 exercises, >20 sets, missing reps-and-duration — b4cc62f
- [x] 2.2 Resolver tests: match, case-insensitive match, missing name, archived name → specific fix-list error, metric mismatch, empty library — b4cc62f
- [x] 2.3 Clash helper tests: 0 / 1 / many — b4cc62f
- [x] 2.4 `npm run lint` — b4cc62f

#### Manual

- [ ] 2.5 Optional fixture DTO spot-check (or skip if unit fixtures suffice)

### Phase 3: JSON export + import preview/commit APIs

#### Automated

- [x] 3.1 Unit tests for export DTO mapping (no `exercise_id` keys)
- [x] 3.2 `npm test`; `npm run lint`; `npm run check`
- [x] 3.3 Import commit branching unit tests (create/skip/overwrite)
- [x] 3.8 Export of >50 exercises returns 400 validation_error

#### Manual

- [ ] 3.4 GET export JSON downloads without UUIDs
- [ ] 3.5 Preview/commit create, overwrite, skip
- [ ] 3.6 Unknown exercise name → 400, library unchanged
- [ ] 3.7 Other trainer export id → 404

### Phase 4: XLSX encode/decode

#### Automated

- [ ] 4.1 DTO → buffer → DTO round-trip test
- [ ] 4.2 Bad xlsx / wrong version → issues, not throw
- [ ] 4.3 `npm test`; `npm run lint`

#### Manual

- [ ] 4.4 Export opens in Excel/LibreOffice, one row per set
- [ ] 4.5 Re-import after a cell edit
- [ ] 4.6 Garbled file → fix-list, no write

### Phase 5: TemplatesHub UI

#### Automated

- [ ] 5.1 `npm run lint`; `npm test`; `npm run build`
- [ ] 5.2 Hook in `src/components/hooks/`; mapping in `src/lib/session-templates/`

#### Manual

- [ ] 5.3 Hub: export JSON/XLSX, import create, clash overwrite/skip, unknown name fix-list
- [ ] 5.4 Client calendar: add session from imported template
- [ ] 5.5 Client user cannot call import/export APIs (403)
- [ ] 5.6 Linear ZAW-57 description matches this plan
