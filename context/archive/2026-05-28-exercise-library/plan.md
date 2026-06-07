# S-01: Exercise Library Implementation Plan

## Overview

Implement trainer-facing exercise library capabilities for MVP: create exercises, edit existing exercises, and browse with filtering by type and muscle group (plus name search for usability at moderate library size). This plan builds on F-01 schema/RLS already in place and delivers the first full trainer feature slice.

## Current State Analysis

- Database foundation is ready: `exercises`, `muscle_groups`, and `exercise_muscle_groups` with RLS are already migrated and seeded.
- Astro app currently has auth routes and middleware, but no exercise CRUD API routes, pages, or UI components.
- Middleware already resolves `context.locals.user` and `context.locals.role`, so trainer-only routes can be gated consistently.
- Existing API routes use SSR Supabase client creation pattern but need stronger request validation for domain routes.

### Key Discoveries:

- `supabase/migrations/20260526120200_exercise_library.sql` already enforces trainer-owned exercise access with RLS.
- `supabase/seed.sql` already provides canonical muscle groups required for FR-009 filtering.
- `src/middleware.ts` already protects `/trainer` routes by role.
- `src/types.ts` already defines `Exercise`, `MuscleGroup`, and related enums/interfaces.

## Desired End State

Trainer can open a `/trainer/exercises` area, create a new exercise with required fields, edit existing exercises, and browse library entries with deterministic filters:

- type filter
- muscle-group filter (multi-select)
- case-insensitive name search

Verification succeeds when trainer CRUD/filter flows work in UI, API validation prevents malformed payloads, and cross-trainer access remains blocked by RLS.

## What We're NOT Doing

- Session template integration UX (S-02 owns template composition workflows).
- Bulk import/pre-populated exercise catalog.
- Advanced sorting/pagination/virtualization for very large libraries.
- Media uploads (only optional external link field as already modeled).
- Client-facing exercise library views.

## Implementation Approach

Use a three-layer incremental approach:

1. Build explicit API contracts with zod validation and SSR Supabase access for exercise CRUD/filter queries.
2. Implement trainer UI pages/forms that consume those contracts, following existing route/middleware patterns.
3. Verify behavior through a heavy but focused validation matrix (API edge cases, role gating, and RLS ownership checks).

## Critical Implementation Details

Filter semantics are fixed in this plan to avoid ambiguity: when both type and muscle filters are set, results use AND logic across filter groups; within muscle-group multi-select, matching any selected muscle group is accepted. Name search is case-insensitive and combined with active filters.

## Phase 1: Exercise API contracts and validation

### Overview

Create trainer-only API endpoints for create/read/update/archive and list filtering, including zod-backed payload/query validation and normalized error handling.

### Changes Required:

#### 1. Exercise list/create endpoint

**File**: `src/pages/api/exercises/index.ts`

**Intent**: Provide `GET` list with filter query support and `POST` create for trainer-owned exercises.

**Contract**: `GET` supports `type`, repeated `muscleGroupId` query params, and `q`; `POST` accepts required fields (`name`, `exercise_type`, `default_metric`, `muscle_groups`) and optional fields (`notes`, `video_url`), with `trainer_id` always derived from auth context.

#### 2. Exercise detail/update/archive endpoint

**File**: `src/pages/api/exercises/[id].ts`

**Intent**: Provide `GET` detail and `PATCH` update/archive behavior compatible with existing foreign-key constraints.

**Contract**: `id` is path param UUID; `PATCH` updates only allowed fields; archive is modeled by setting `is_archived`; archived exercises are excluded from default searchable list results.

#### 3. API auth/role guard helper

**File**: `src/lib/api/guards.ts`

**Intent**: Standardize trainer-only API protection for routes not covered by path-prefix middleware (`/api/*`).

**Contract**: Helper enforces `context.locals.user` presence and `context.locals.role === "trainer"`; route handlers consistently return 401 for unauthenticated and 403 for non-trainer callers.

#### 4. Shared validation and mapping helpers

**File**: `src/lib/exercises/schemas.ts`

**Intent**: Centralize zod schemas for request/query validation and avoid route-level duplication.

**Contract**: Export typed schemas for create/update payloads and list-filter query parsing; reject malformed UUIDs, invalid enums, and invalid URL shapes for `video_url`.

#### 5. Data access helper module

**File**: `src/lib/exercises/service.ts`

**Intent**: Encapsulate Supabase operations for exercises and exercise-muscle-group junction writes.

**Contract**: Expose functions used by API routes (`listExercises`, `getExercise`, `createExercise`, `updateExercise`, `archiveExercise`) with explicit input/output shapes.

#### 6. Test harness bootstrap for runnable automated checks

**Files**: `package.json`, `vitest.config.ts`, `.github/workflows/ci.yml`

**Intent**: Make planned API/component test checks executable in this repository.

**Contract**: Add `test` script and baseline Vitest config; include test run in CI only after tests exist for S-01 surfaces.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes after API and schema additions.
- `npm run build` passes.
- `npm run test` is available and passes for current API contract tests.
- API route type-checking succeeds with strict TS settings.
- Added API tests pass for:
  - valid create
  - invalid payload rejection
  - filter query behavior
  - invalid UUID handling

#### Manual Verification:

- Authenticated trainer can create an exercise via API payload.
- Authenticated trainer can update and archive their own exercise.
- Invalid payloads return clear 400 responses with validation context.
- Non-trainer access to trainer exercise API is rejected with 403; unauthenticated access gets 401.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Trainer exercise library UI

### Overview

Implement trainer-facing pages for listing/filtering/search and dedicated create/edit forms.

### Changes Required:

#### 1. Trainer exercise list page

**File**: `src/pages/trainer/exercises/index.astro`

**Intent**: Render exercise list with filter controls (type, multi-select muscle groups, search) and actions to create/edit/archive.

**Contract**: Page is trainer-route protected by middleware and calls `GET /api/exercises` with normalized query state using repeated `muscleGroupId` params.

#### 2. Create exercise page

**File**: `src/pages/trainer/exercises/new.astro`

**Intent**: Provide dedicated form page for exercise creation.

**Contract**: Form fields map exactly to API create contract; successful submit redirects to list page with success feedback.

#### 3. Edit exercise page

**File**: `src/pages/trainer/exercises/[id].astro`

**Intent**: Provide dedicated edit form populated from exercise detail endpoint.

**Contract**: On load, fetch current exercise by id; on submit, call update endpoint; archive action is explicit and confirmed.

#### 4. Reusable exercise form component(s)

**File**: `src/components/exercises/ExerciseForm.tsx`

**Intent**: Reuse shared field rendering and validation feedback between create/edit pages.

**Contract**: Component supports create and edit modes with a stable typed prop interface and no Tailwind string concatenation outside `cn()`.

#### 5. Exercise filter controls component

**File**: `src/components/exercises/ExerciseFilters.tsx`

**Intent**: Manage filter state and query param serialization for list page.

**Contract**: Type + muscle + search controls serialize into URL params and preserve state on refresh/back navigation.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes for all new pages/components.
- `npm run build` passes with new route files.
- Component/unit tests pass for form validation and filter state serialization.

#### Manual Verification:

- Trainer can create an exercise from UI and see it in list immediately.
- Trainer can open edit page, change fields, and persist updates.
- Trainer can archive an exercise from edit/list flow with confirmation.
- Filter combinations produce expected result sets (type + muscles + search).
- Empty-state and no-match UX are clear and non-blocking.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Hardening, RLS verification, and docs

### Overview

Close the slice with security/regression checks, ensure RLS behavior remains intact, and document operational/testing notes.

### Changes Required:

#### 1. Security and ownership verification scripts

**File**: `context/changes/exercise-library/verification.sql`

**Intent**: Provide copy-paste SQL verification for local Supabase Studio to confirm ownership isolation and expected CRUD behavior.

**Contract**: Single transaction script using `set local role authenticated` and scoped JWT claim setup for trainer A/B ownership checks; ends with rollback.

#### 2. Slice-specific documentation update

**File**: `context/changes/exercise-library/change.md`

**Intent**: Keep planning assumptions and implementation progress metadata aligned with actual delivered behavior.

**Contract**: `status`, `updated`, and `phase_issues` are maintained; assumptions reflected if behavior differs from original defaults.

#### 3. Optional README trainer route note

**File**: `README.md`

**Intent**: Document new trainer exercise route entrypoint and expected local verification flow.

**Contract**: Keep README concise; no deep implementation details duplicated from change plan.

### Success Criteria:

#### Automated Verification:

- `npm run lint` and `npm run build` both pass on final branch state.
- API and UI tests for exercise flows pass in CI-equivalent local run.

#### Manual Verification:

- SQL ownership script confirms trainer A cannot read/update trainer B exercises.
- End-to-end trainer flow works on fresh local reset (`create -> filter -> edit -> archive`).
- No regression in auth middleware behavior for `/trainer` protected routes.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Schema parsing tests for create/update/filter zod schemas.
- Service-layer tests for payload-to-query mapping.
- UI component tests for form validation and filter serialization.

### Integration Tests:

- API integration: trainer create/read/update/archive happy path and failure path matrix.
- Role-based access checks: unauthenticated and client-role denial.
- Query behavior checks for combined filters and search, including repeated `muscleGroupId` serialization/parsing round-trip.

### Manual Testing Steps:

1. Start app and create two trainer users.
2. As trainer A, create several exercises with different types/muscle groups.
3. Verify filter combinations and search behavior in list UI.
4. Edit one exercise and verify persisted changes.
5. Archive one exercise and verify default search/list exclusion.
6. Switch to trainer B and confirm trainer A data is inaccessible.

## Performance Considerations

- List queries should default to deterministic ordering (`updated_at DESC`) and avoid excessive nested payloads.
- Filter query logic should stay index-friendly by minimizing unnecessary client-side post-filtering.
- Name search is acceptable for MVP-sized data; revisit indexing strategy when library sizes grow materially.

## Migration Notes

- No new DB migration is required for S-01 baseline implementation.
- If implementation introduces schema drift needs, create a new timestamped migration and keep RLS guarantees intact.

## References

- Related roadmap: `context/foundation/roadmap.md`
- Related PRD: `context/foundation/prd.md`
- Existing schema and RLS: `supabase/migrations/20260526120200_exercise_library.sql`
- Prior foundation plan: `context/changes/database-schema-and-rls/plan.md`
- Team rules: `AGENTS.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Exercise API contracts and validation

#### Automated

- [x] 1.1 `npm run lint` passes after API and schema additions — f501c0c
- [x] 1.2 `npm run build` passes after API and schema additions — f501c0c
- [x] 1.3 `npm run test` is available and passes for exercise API contract tests — f501c0c
- [x] 1.4 API route type-checking succeeds with strict TS settings — f501c0c
- [x] 1.5 API tests pass: valid create — f501c0c
- [x] 1.6 API tests pass: invalid payload rejection — f501c0c
- [x] 1.7 API tests pass: filter query behavior — f501c0c
- [x] 1.8 API tests pass: invalid UUID handling — f501c0c

#### Manual

- [x] 1.9 Authenticated trainer can create an exercise via API payload — f501c0c
- [x] 1.10 Authenticated trainer can update and archive their own exercise — f501c0c
- [x] 1.11 Invalid payloads return clear 400 responses with validation context — f501c0c
- [x] 1.12 Non-trainer access returns 403 and unauthenticated access returns 401 — f501c0c

### Phase 2: Trainer exercise library UI

#### Automated

- [x] 2.1 `npm run lint` passes for new trainer exercise pages/components — d923ae7
- [x] 2.2 `npm run build` passes with new trainer exercise routes — d923ae7
- [x] 2.3 Component/unit tests pass for form validation and filter state serialization — d923ae7

#### Manual

- [x] 2.4 Trainer can create an exercise from UI and see it in list immediately — d923ae7
- [x] 2.5 Trainer can open edit page, change fields, and persist updates — d923ae7
- [x] 2.6 Trainer can archive an exercise from edit/list flow with confirmation — d923ae7
- [x] 2.7 Filter combinations produce expected result sets (type + muscles + search) — d923ae7
- [x] 2.8 Empty-state and no-match UX are clear and non-blocking — d923ae7

### Phase 3: Hardening, RLS verification, and docs

#### Automated

- [x] 3.1 `npm run lint` and `npm run build` both pass on final branch state — 6f31959
- [x] 3.2 API and UI tests for exercise flows pass in CI-equivalent local run — 6f31959

#### Manual

- [x] 3.3 SQL ownership verification script confirms trainer A cannot read/update trainer B exercises — 6f31959
- [x] 3.4 End-to-end trainer flow (`create -> filter -> edit -> archive`) passes on local reset — 6f31959
- [x] 3.5 No regression in auth middleware behavior for `/trainer` protected routes — 6f31959
