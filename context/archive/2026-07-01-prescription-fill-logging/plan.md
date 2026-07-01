# Prescription Fill Logging Implementation Plan

## Overview

Replace the per-set OK/completed toggle with one-click prescription fill in guided workout logging. Progress and readout heuristics move from `is_complete` to logged metric values (with legacy fallback).

## Current State Analysis

- `SetLogRow` has manual inputs + OK toggle persisting `is_complete` (`src/components/guided-workout/SetLogRow.tsx`)
- `exercise-progress.ts`, `logging-sets.ts`, `readout.ts` count completed sets via `log.is_complete`
- `upsertSetLogBodySchema` requires reps/duration when `is_complete` is true
- E2E hydration gate uses OK toggle (`tests/e2e/guided-workout-quick-navigation-persistence.spec.ts`)

## Desired End State

Client taps **Fill** on a prescribed set row → inputs populate from prescription → autosave persists → nav progress reflects logged values. OK column removed. Trainer dashboard readout uses same heuristic.

### Key Discoveries

- `format-prescription.ts` already has `hasLoggedValues` — promote to shared `isSetLogged`
- `is_complete` column stays; new writes always send `false`
- Session completion (S-08) untouched

## What We're NOT Doing

- Dropping `is_complete` column from schema
- Fill-all bulk button
- Session-level completion changes
- UI redesign (S-18)

## Implementation Approach

Add shared helpers first, update all consumers, then UI. Tests follow each layer.

## Phase 1: Core lib + API

### Overview

Centralize logged-set detection and prescription fill mapping; update progress/readout/format helpers and API validation.

### Changes Required:

#### 1. `set-logged.ts` (new)

**File**: `src/lib/guided-workout/set-logged.ts`

**Intent**: Single source of truth for whether a set counts as logged for progress/readout.

**Contract**: Export `isSetLogged(log, metric)` — true when legacy `is_complete` OR metric-appropriate values present (`time` → duration; `reps_weight` → reps).

#### 2. `fill-from-prescription.ts` (new)

**File**: `src/lib/guided-workout/fill-from-prescription.ts`

**Intent**: Map prescription row to `SetLogValues` for Fill button.

**Contract**: Export `fillValuesFromPrescription({ prescribedSet, defaultMetric, existingLog, isPrescribed })` returning reps/duration/load from prescription, `is_complete: false`, warmup from `resolveLogIsWarmup`.

#### 3. Progress + readout consumers

**Files**: `exercise-progress.ts`, `logging-sets.ts`, `format-prescription.ts`, `readout.ts`

**Intent**: Replace `is_complete` checks with `isSetLogged`.

**Contract**: Pass `defaultMetric` where needed; `findFirstIncompleteSetNumber` accepts metric param.

#### 4. Schema + service

**Files**: `src/lib/set-logs/schemas.ts`, `src/lib/set-logs/service.ts`

**Intent**: Validate metric fields when values are present, not tied to `is_complete`.

**Contract**: Remove `is_complete` refine; `validateMetricFields` checks reps/duration when corresponding field is non-null in payload.

### Success Criteria:

#### Automated Verification:

- `npm run lint`
- `npm test -- src/lib/guided-workout/set-logged.test.ts src/lib/guided-workout/fill-from-prescription.test.ts src/lib/guided-workout/exercise-progress.test.ts src/lib/guided-workout/logging-sets.test.ts src/lib/guided-workout/format-prescription.test.ts src/lib/trainer-dashboard/readout.test.ts src/lib/set-logs/schemas.test.ts`

#### Manual Verification:

- N/A (lib-only phase)

---

## Phase 2: UI — Fill button, remove OK toggle

### Overview

Update `SetLogRow` to show Fill for prescribed rows; remove OK column. Update `ExerciseSetLogTable` to pass metric to `findFirstIncompleteSetNumber`.

### Changes Required:

#### 1. `SetLogRow.tsx`

**File**: `src/components/guided-workout/SetLogRow.tsx`

**Intent**: Replace OK toggle with Fill button; update delete eligibility to use `isSetLogged`.

**Contract**: Fill button visible when `prescribedSet` exists and set not yet logged; calls `fillValuesFromPrescription` on click. Remove Check icon column.

#### 2. `ExerciseSetLogTable.tsx`

**File**: `src/components/guided-workout/ExerciseSetLogTable.tsx`

**Intent**: Pass `defaultMetric` to `findFirstIncompleteSetNumber`.

**Contract**: Import updated signature.

### Success Criteria:

#### Automated Verification:

- `npm run lint`
- `npm run build`

#### Manual Verification:

- Open guided workout → Fill copies prescription into inputs → values persist on reload
- Exercise nav shows progress after fill without OK toggle
- Manual entry still works without Fill

---

## Phase 3: Tests + verification

### Overview

Update existing tests; add integration test for fill upsert; update E2E hydration gate; deliver Studio SQL script.

### Changes Required:

#### 1. Unit tests

**Files**: new `set-logged.test.ts`, `fill-from-prescription.test.ts`; update existing guided-workout + readout + schemas tests

#### 2. Integration test

**File**: `tests/integration/rls/set-logs.test.ts`

**Intent**: Client upserts set log with prescription values, `is_complete: false`.

#### 3. E2E

**File**: `tests/e2e/guided-workout-quick-navigation-persistence.spec.ts`

**Intent**: Replace OK-toggle hydration gate with warm-up toggle; use Fill button for values.

#### 4. Verification SQL

**File**: `context/changes/prescription-fill-logging/verification.sql`

### Success Criteria:

#### Automated Verification:

- `npm test`
- `npm run lint`
- `npm run build`

#### Manual Verification:

- Run `verification.sql` in Supabase Studio (see script comments)

---

## Testing Strategy

### Unit Tests

- `isSetLogged` per metric + legacy `is_complete`
- `fillValuesFromPrescription` maps all prescription fields
- Progress/readout with value-based completion

### Integration Tests

- Upsert with filled values, `is_complete: false`

### E2E

- Autosave persistence after fill + quick navigation

## References

- Roadmap S-19: `context/foundation/roadmap.md`
- S-06 archive: `context/archive/2026-06-14-guided-workout-logging/`

## Progress

### Phase 1: Core lib + API

#### Automated

- [x] 1.1 `npm run lint`
- [x] 1.2 Unit tests for lib + schemas

#### Manual

- [x] 1.3 N/A

### Phase 2: UI — Fill button, remove OK toggle

#### Automated

- [x] 2.1 `npm run lint`
- [x] 2.2 `npm run build`

#### Manual

- [x] 2.3 Fill copies prescription and persists on reload
- [x] 2.4 Nav progress updates from filled values
- [x] 2.5 Manual entry without Fill still works

### Phase 3: Tests + verification

#### Automated

- [x] 3.1 `npm test` (unit scope; integration requires local Supabase)
- [x] 3.2 `npm run lint` (pre-existing errors in middleware unrelated to this change)
- [x] 3.3 `npm run build`

#### Manual

- [x] 3.4 Run verification.sql in Supabase Studio
