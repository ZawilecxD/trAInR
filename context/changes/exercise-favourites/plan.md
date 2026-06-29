# Exercise Favourites Implementation Plan

## Overview

Implement S-15: trainers mark exercises as favourites and filter exercise lists to favourites only. Extends FR-009 browse/filter across the exercise library page and `ExercisePickerModal` (template builder, session personalization).

## Current State Analysis

`public.exercises` has trainer-scoped rows with type, muscle groups, and archive flag but no favourite marker. `listExercises` filters by type, muscle group, and name. `ExerciseFilters` drives library filters via URL params and full-page navigation. `ExercisePickerModal` receives the full exercise list from SSR pages and filters by name only client-side.

### Key Discoveries:

- `supabase/migrations/20260526120200_exercise_library.sql:19-30` — exercises table shape; no favourite column
- `src/lib/exercises/service.ts:58-111` — server-side filter pipeline
- `src/components/exercises/ExerciseFilters.tsx` — URL-based filter UI for library
- `src/components/session-templates/ExercisePickerModal.tsx:17-26` — name search only
- Trainer UPDATE RLS on `exercises` already covers any column patch by owning trainer

## Desired End State

Trainers star exercises from the library table and exercise edit form. "Favourites only" appears in library filters (`?favourites=1`) and in the exercise picker modal. Favourite state persists through `PATCH /api/exercises/:id` with `{ is_favourite: true | false }`.

### Verification

- Unit tests for query schema, filter URL, and client-side filter helper
- Integration test: trainer can set favourite and `listExercises` with `favouritesOnly` returns only starred rows
- `npm run lint` and `npm run build` pass

## What We're NOT Doing

- Client-role favourite access
- Favourites on archived exercises in browse lists
- Sorting favourites to the top (filter-only)
- New dedicated favourite API route
- UI redesign (S-18)
- Extracting a full shared filter panel for library + picker (minimal shared helper only)

## Implementation Approach

Add `is_favourite boolean not null default false` via migration. Thread the field through types, zod schemas, `listExercises`, and filter URL helpers. Library uses server-side `favouritesOnly`; picker uses a pure `filterExercises` helper on the in-memory list. Reusable `ExerciseFavouriteButton` React component handles PATCH toggle with optimistic UI.

## Phase 1: Schema and Service Layer

### Overview

Database column, types, validation, and query support.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20260629120000_exercise_favourites.sql`

**Intent**: Add per-exercise favourite flag for trainer-owned rows.

**Contract**: `alter table public.exercises add column is_favourite boolean not null default false;` Optional index `exercises_trainer_favourite_idx on (trainer_id, is_favourite) where is_favourite = true`.

#### 2. Shared types

**File**: `src/types.ts`

**Intent**: Mirror DB column in the `Exercise` interface.

**Contract**: Add `is_favourite: boolean` to `Exercise`.

#### 3. Schemas and filter URL

**Files**: `src/lib/exercises/schemas.ts`, `src/lib/exercises/filter-url.ts`

**Intent**: Accept `favourites=1` query param and `is_favourite` in PATCH body.

**Contract**: `listExercisesQuerySchema` gains optional `favouritesOnly` (from `favourites` param `"1"`). `updateExerciseBodySchema` gains optional `is_favourite: boolean`. `ExerciseFilterState` gains `favouritesOnly?: boolean`; serialize/deserialize in URL helpers.

#### 4. Service

**File**: `src/lib/exercises/service.ts`

**Intent**: Apply favourites filter in list query; allow patch of `is_favourite`.

**Contract**: When `filters.favouritesOnly`, add `.eq("is_favourite", true)`. Map `is_favourite` in `updateExercise` patch builder.

#### 5. Unit tests

**Files**: `src/lib/exercises/schemas.test.ts`, `src/lib/exercises/filter-url.test.ts`

**Intent**: Lock query parsing and URL round-trip for favourites filter.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm test -- src/lib/exercises/schemas.test.ts src/lib/exercises/filter-url.test.ts` passes

#### Manual Verification:

- Migration applies on local Supabase (`npx supabase db reset` or push)

---

## Phase 2: Library UI

### Overview

Favourite toggle on library rows and edit form; favourites-only filter in `ExerciseFilters`.

### Changes Required:

#### 1. Favourite toggle component

**File**: `src/components/exercises/ExerciseFavouriteButton.tsx`

**Intent**: Reusable star button that PATCHes `is_favourite` and updates optimistically.

**Contract**: Props: `exerciseId`, `initialIsFavourite`, optional `onToggled`. Calls `PATCH /api/exercises/:id` with JSON body. Uses `cn()` for classes; `aria-pressed` for accessibility.

#### 2. Library filters

**File**: `src/components/exercises/ExerciseFilters.tsx`

**Intent**: Add "Favourites only" toggle chip; include in `hasActiveFilters` and `clearFilters`.

**Contract**: Toggles `favouritesOnly` in filter state and navigates via `buildExerciseListUrl`.

#### 3. Library table

**File**: `src/pages/trainer/exercises/index.astro`

**Intent**: Star column before name; update `hasActiveFilters` for favourites param.

**Contract**: Render `ExerciseFavouriteButton` per row with `client:load`. Pass `initialFilters.favouritesOnly` into filter empty-state logic.

#### 4. Edit form

**File**: `src/components/exercises/ExerciseForm.tsx`

**Intent**: Allow marking favourite when editing an existing exercise.

**Contract**: On edit mode only, show favourite checkbox bound to form state; include `is_favourite` in PATCH body on save.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Star toggle on library row persists after reload
- "Favourites only" filter shows subset on library page
- Edit form favourite checkbox saves correctly

---

## Phase 3: Picker Filter and Integration Test

### Overview

Favourites filter in exercise picker; integration coverage; roadmap alignment.

### Changes Required:

#### 1. Client-side filter helper

**File**: `src/lib/exercises/client-filter.ts`

**Intent**: Pure function for picker modal to filter by name + favourites.

**Contract**: `filterExercises(exercises, { q?, favouritesOnly? })` returns filtered array. Unit tests in `client-filter.test.ts`.

#### 2. Exercise picker modal

**File**: `src/components/session-templates/ExercisePickerModal.tsx`

**Intent**: "Favourites only" toggle above search; reset favourites filter when modal closes.

**Contract**: Use `filterExercises` in `useMemo`; favourites toggle is local state (not URL).

#### 3. Integration test

**File**: `tests/integration/rls/exercise-favourites.test.ts`

**Intent**: Prove trainer can favourite own exercise and favourites-only query works; cross-trainer update blocked.

**Contract**: Create two trainers with exercises; trainer A favourites one row; list with `favouritesOnly` returns one; trainer B cannot update trainer A's `is_favourite`.

#### 4. Roadmap note

**File**: `context/foundation/roadmap.md`

**Intent**: Resolve S-15 unknowns after implementation decisions.

**Contract**: Note inline star on library + edit form; picker uses client-side favourites filter shared via helper.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/lib/exercises/client-filter.test.ts` passes
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Open template builder exercise picker; "Favourites only" shows starred exercises
- Same behaviour in session personalization picker

---

## Testing Strategy

### Unit Tests:

- Schema parses `favourites=1`
- Filter URL round-trip includes `favouritesOnly`
- `filterExercises` respects name and favourites flags

### Integration Tests:

- Trainer favourites isolation and favourites-only list query

### Manual Testing Steps:

1. Star two exercises on library page; enable favourites filter; verify only those appear
2. Open template builder picker; enable favourites only; verify same subset
3. Unstar from library; verify picker favourites list updates after page reload

## Performance Considerations

Partial index on `(trainer_id, is_favourite)` keeps favourites-only queries cheap as libraries grow.

## Migration Notes

Existing rows default `is_favourite = false`. No backfill.

## References

- Roadmap: `context/foundation/roadmap.md` S-15
- Linear: ZAW-43
- Exercise service: `src/lib/exercises/service.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Schema and Service Layer

#### Automated

- [x] 1.1 `npm run lint` passes
- [x] 1.2 Unit tests for schemas and filter-url pass

#### Manual

- [x] 1.3 Migration applies on local Supabase

### Phase 2: Library UI

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 `npm run build` passes

#### Manual

- [x] 2.3 Library star toggle and favourites filter work in browser

### Phase 3: Picker Filter and Integration Test

#### Automated

- [x] 3.1 Client-filter unit tests pass
- [x] 3.2 `npm run lint` passes
- [x] 3.3 `npm run build` passes

#### Manual

- [x] 3.4 Exercise picker favourites filter works in template/session flows
