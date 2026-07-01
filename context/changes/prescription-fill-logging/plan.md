# Prescription Fill Logging Implementation Plan

## Overview

Implement S-19: guided workout logging should let the client fill a prescribed round with one click, then edit those filled values if needed. The per-set OK/completed toggle is removed from the UI, and guided-workout progress plus trainer readout are inferred from actual logged values instead of `set_logs.is_complete`.

## Current State Analysis

S-06 introduced `set_logs.is_complete`, an OK toggle in each set row, and progress/readout helpers that count completed sets via that flag. S-08 later made session finished/partial/cancelled a session-level workflow, so per-set completion should no longer represent workout outcome. S-10 added `is_warmup` alongside the same autosave path, which must remain orthogonal and continue inheriting prescribed warm-up defaults.

## Desired End State

Clients can tap a fill action for any prescribed round to copy prescribed reps/load or duration and warm-up state into the editable log inputs. The row autosaves through the existing debounced set-log API, quick navigation still flushes pending saves, and after reload the filled values appear as normal logged values. Exercise navigation, continue-workout targeting, trainer readout, and actuals formatting treat a set as logged when it has reps, duration, or load; the old `is_complete` column remains in the database for compatibility but no longer drives product behavior.

### Key Discoveries:

- `src/components/guided-workout/SetLogRow.tsx:209` renders the OK toggle and `values.is_complete` currently affects delete eligibility.
- `src/lib/guided-workout/logging-sets.ts:37` and `src/lib/guided-workout/exercise-progress.ts:26` derive active/incomplete state from `log?.is_complete`.
- `src/lib/trainer-dashboard/readout.ts:69` uses the same flag for trainer readout and dashboard summaries.
- `src/lib/guided-workout/format-prescription.ts:141` already contains a private logged-values heuristic that can become shared.
- `tests/e2e/guided-workout-quick-navigation-persistence.spec.ts:105` uses the OK toggle as a hydration gate, so removing the toggle requires a replacement React-only signal.

## What We're NOT Doing

- Dropping or migrating away from `set_logs.is_complete` in Supabase.
- Changing `workout_sessions.status`, session completion marking, cancel/reopen behavior, or calendar status semantics.
- Adding bulk "fill all rounds" controls; this slice covers a per-round one-click fill.
- Reworking guided-workout layout beyond the controls needed for S-19.
- Adding broad component-test infrastructure for React islands.

## Implementation Approach

Keep the existing persistence route and database shape stable while changing product semantics at the UI/helper layer. Add a small pure helper for prescription fill and logged-value detection, wire it into the set row, then update progress/readout/formatting consumers to use the shared logged-value predicate. Expand unit coverage around the pure semantics first, then add targeted RLS/upsert integration coverage and Playwright coverage for fill + quick navigation.

## Critical Implementation Details

**Compatibility:** continue sending `is_complete: false` in set-log saves so existing schema/API requirements remain satisfied without a destructive migration. Historical rows with `is_complete = true` but no values should no longer count as logged after this slice.

**Hydration:** the E2E quick-navigation spec needs a React-only control to prove hydration before filling controlled inputs. The new fill button is the natural signal because it changes input values only after React handlers attach.

## Phase 1: Pure Semantics and API Compatibility

### Overview

Centralize fill and logged-value semantics, then update low-level validation/API behavior to tolerate the de-emphasized `is_complete` flag.

### Changes Required:

#### 1. Guided workout logging helpers

**File**: `src/lib/guided-workout/prescription-fill.ts`

**Intent**: Add pure helpers for copying prescribed round values into a set-log values shape and deciding whether a log has user-visible logged values.

**Contract**: Export `hasLoggedValues(logLike)` and `fillValuesFromPrescription(prescribedSet, defaultMetric)` (names may be adjusted locally) so UI, progress, formatting, and readout do not duplicate the same null checks.

#### 2. Set-log schema/service compatibility

**File**: `src/lib/set-logs/schemas.ts`

**Intent**: Keep accepting `is_complete` for compatibility but stop making the flag the source of validation truth.

**Contract**: Upsert payload still includes `is_complete: boolean` and `is_warmup: boolean`; body parsing should not reject a payload only because `is_complete` is true with no reps/duration, since clients no longer use it as completion state.

**File**: `src/lib/set-logs/service.ts`

**Intent**: Validate loggable fields based on the presence of entered values and exercise metric, not based on the old completion flag.

**Contract**: Distance exercises remain unsupported; timed logs with a value must use `duration_seconds`; reps/reps_weight logs with a value must use `reps`; empty rows may still be saved for compatibility only when the UI creates them, but they do not count as logged.

#### 3. Unit coverage for semantics

**File**: `src/lib/guided-workout/prescription-fill.test.ts`

**Intent**: Lock the S-19 contract around fill and logged-value detection.

**Contract**: Cover reps_weight fill, time fill, bodyweight/null load fill, warm-up inheritance, empty logs, value logs where `is_complete` is false, and historical complete-without-values rows.

**File**: `src/lib/set-logs/schemas.test.ts`

**Intent**: Update expectations around `is_complete` compatibility.

**Contract**: Keep UUID/set number/warm-up validation; replace "completed sets require reps or duration" with tests showing `is_complete` no longer drives validation.

### Success Criteria:

#### Automated Verification:

- Unit semantics pass: `npm test -- src/lib/guided-workout/prescription-fill.test.ts src/lib/set-logs/schemas.test.ts`
- Lint affected helper/schema files: `npx eslint "src/lib/guided-workout/prescription-fill.ts" "src/lib/guided-workout/prescription-fill.test.ts" "src/lib/set-logs/schemas.ts" "src/lib/set-logs/schemas.test.ts" "src/lib/set-logs/service.ts"`

#### Manual Verification:

- Confirm no Supabase migration is needed for Phase 1 compatibility.

---

## Phase 2: Guided Workout UI and Derived Progress

### Overview

Replace the OK toggle with prescription fill in guided workout rows and update all client-side progress targets to use logged values.

### Changes Required:

#### 1. Set row fill control

**File**: `src/components/guided-workout/SetLogRow.tsx`

**Intent**: Remove the OK toggle and add a fill button for prescribed rows with available prescribed values. The resulting inputs remain editable and autosave through the existing debounced hook.

**Contract**: The fill control has an accessible label that includes the set number, writes reps/load or duration plus warm-up state into local values, keeps `is_complete` false in saves, and does not appear for non-prescribed added rounds.

#### 2. Set table and navigation progress

**File**: `src/lib/guided-workout/logging-sets.ts`

**Intent**: Make the active row/first incomplete set follow logged values.

**Contract**: `findFirstIncompleteSetNumber` returns the first displayed set without logged values; if every displayed set has values, it returns the first set number to keep a stable active row.

**File**: `src/lib/guided-workout/exercise-progress.ts`

**Intent**: Make exercise nav dots, counts, session progress summary, and continue-workout targeting use logged values.

**Contract**: `completedSets` counts displayed set numbers whose log has values; `isDone` means all displayed sets have values; explicit session status remains untouched.

#### 3. Hook payload compatibility

**File**: `src/components/hooks/useDebouncedSetLogSave.ts`

**Intent**: Keep the payload compatible while removing product reliance on `is_complete`.

**Contract**: `SetLogValues` may still include `is_complete` for API compatibility, but UI-created values always save `false` unless existing code requires a transitional default.

#### 4. Unit coverage for progress

**File**: `src/lib/guided-workout/logging-sets.test.ts`

**Intent**: Cover value-based active-row selection.

**Contract**: Include cases for values with `is_complete: false`, empty logs, and historical complete-without-values logs.

**File**: `src/lib/guided-workout/exercise-progress.test.ts`

**Intent**: Cover value-based completion across prescribed and extra rounds.

**Contract**: Include all-filled, partial, extra logged round, session summary, and first incomplete exercise cases.

### Success Criteria:

#### Automated Verification:

- Guided-workout unit tests pass: `npm test -- src/lib/guided-workout/prescription-fill.test.ts src/lib/guided-workout/logging-sets.test.ts src/lib/guided-workout/exercise-progress.test.ts`
- Lint affected guided-workout files: `npx eslint "src/components/guided-workout/SetLogRow.tsx" "src/lib/guided-workout/prescription-fill.ts" "src/lib/guided-workout/logging-sets.ts" "src/lib/guided-workout/logging-sets.test.ts" "src/lib/guided-workout/exercise-progress.ts" "src/lib/guided-workout/exercise-progress.test.ts"`

#### Manual Verification:

- In a client guided session with prescribed reps/load, click fill for set 1 and confirm the reps/load inputs populate and remain editable.
- Reload the session after autosave and confirm filled values are still present.
- Confirm there is no visible per-set OK/completed toggle.

---

## Phase 3: Trainer Readout, Integration, and E2E Coverage

### Overview

Bring trainer-facing readouts and browser-level safety tests in line with value-based logging.

### Changes Required:

#### 1. Actuals formatting and trainer readout

**File**: `src/lib/guided-workout/format-prescription.ts`

**Intent**: Remove the "Completed" fallback for rows that only have `is_complete`; actuals should display logged values or "Not logged".

**Contract**: `formatSetActual` uses shared logged-value semantics.

**File**: `src/lib/trainer-dashboard/readout.ts`

**Intent**: Make trainer session readout status count logged values instead of `is_complete`.

**Contract**: `SetReadout.isComplete`, `completedSets`, and readout status all reflect logged values while preserving existing readout status labels.

#### 2. Unit coverage for trainer/readout semantics

**File**: `src/lib/guided-workout/format-prescription.test.ts`

**Intent**: Update actual formatting tests for S-19.

**Contract**: Values format normally even with `is_complete: false`; historical complete-without-values rows are "Not logged".

**File**: `src/lib/trainer-dashboard/readout.test.ts`

**Intent**: Update trainer readout tests for value-based completion.

**Contract**: Include full, partial, extra round, and historical complete-without-values cases.

#### 3. Integration coverage

**File**: `tests/integration/rls/set-logs.test.ts`

**Intent**: Prove a client can persist and update fill-like set-log values under RLS without relying on `is_complete`.

**Contract**: Add an upsert/update scenario for a prescribed set with reps/load and `is_complete: false`, then assert the same `(session_exercise_id, set_number)` row updates rather than duplicates.

#### 4. E2E coverage

**File**: `tests/e2e/guided-workout-quick-navigation-persistence.spec.ts`

**Intent**: Keep Risk #6 covered after the OK toggle is removed.

**Contract**: Replace the OK-toggle hydration gate with the new fill control and keep the immediate navigation/reload persistence assertion.

**File**: `tests/e2e/prescription-fill-logging.spec.ts`

**Intent**: Cover the main S-19 user path in a browser.

**Contract**: Create a prescribed session via trainer API, start it as the client, click the fill control, assert inputs populate from prescription, reload, and assert persisted values remain visible. Use existing storage-state and cleanup patterns.

### Success Criteria:

#### Automated Verification:

- Readout unit tests pass: `npm test -- src/lib/guided-workout/format-prescription.test.ts src/lib/trainer-dashboard/readout.test.ts`
- Integration set-log test passes: `npm run test:integration -- tests/integration/rls/set-logs.test.ts`
- E2E prescription fill spec passes if local Supabase/dev seed is available: `npm run test:e2e -- tests/e2e/prescription-fill-logging.spec.ts`
- Full quality gate passes: `npm run lint && npm test`

#### Manual Verification:

- Trainer session detail shows filled rows as logged and empty rows as not logged.
- Guided workout quick-navigation still preserves entered values after moving to the next exercise and reloading.
- If local E2E prerequisites are unavailable, run the browser steps manually against a local seeded Supabase instance.

---

## Testing Strategy

### Unit Tests:

- New pure helper tests for fill and logged-value semantics.
- Existing guided-workout progress tests updated from `is_complete` to logged values.
- Existing formatting/readout tests updated so historical `is_complete` rows without values no longer count as logged.
- Schema tests document compatibility behavior for the still-present `is_complete` payload field.

### Integration Tests:

- Extend `tests/integration/rls/set-logs.test.ts` to cover fill-like upsert/update as the assigned client under RLS.

### Manual Testing Steps:

1. Start a local seeded app and sign in as the seeded client.
2. Open a prescribed guided workout session.
3. Click the fill control for a reps/load set and verify prescribed reps/load populate.
4. Edit one populated value, immediately navigate to the next exercise, reload, and confirm the edited value persisted.
5. As trainer, open the same session detail and confirm the row is shown as logged based on actual values.

## Performance Considerations

The change keeps all computations local and linear over displayed set rows, matching current helper behavior. No extra server round-trips are introduced beyond the existing debounced save triggered by value changes.

## Migration Notes

No Supabase migration is planned. `set_logs.is_complete` remains present for old data and API compatibility, but S-19 stops writing meaningful true values and stops reading it as product state.

## References

- Roadmap S-19: `context/foundation/roadmap.md:355`
- Prior guided logging plan: `context/archive/2026-06-14-guided-workout-logging/plan.md`
- Prior trainer readout plan: `context/archive/2026-06-20-trainer-dashboard/plan.md`
- Prior session status plan: `context/archive/2026-06-28-session-completion-marking/plan.md`
- Warm-up logging constraints: `context/archive/2026-06-20-warmup-working-flag/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pure Semantics and API Compatibility

#### Automated

- [x] 1.1 Unit semantics pass: `npm test -- src/lib/guided-workout/prescription-fill.test.ts src/lib/set-logs/schemas.test.ts`
- [x] 1.2 Lint affected helper/schema files: `npx eslint "src/lib/guided-workout/prescription-fill.ts" "src/lib/guided-workout/prescription-fill.test.ts" "src/lib/set-logs/schemas.ts" "src/lib/set-logs/schemas.test.ts" "src/lib/set-logs/service.ts"`

#### Manual

- [ ] 1.3 Confirm no Supabase migration is needed for Phase 1 compatibility.

### Phase 2: Guided Workout UI and Derived Progress

#### Automated

- [x] 2.1 Guided-workout unit tests pass: `npm test -- src/lib/guided-workout/prescription-fill.test.ts src/lib/guided-workout/logging-sets.test.ts src/lib/guided-workout/exercise-progress.test.ts`
- [x] 2.2 Lint affected guided-workout files: `npx eslint "src/components/guided-workout/SetLogRow.tsx" "src/lib/guided-workout/prescription-fill.ts" "src/lib/guided-workout/logging-sets.ts" "src/lib/guided-workout/logging-sets.test.ts" "src/lib/guided-workout/exercise-progress.ts" "src/lib/guided-workout/exercise-progress.test.ts"`

#### Manual

- [ ] 2.3 In a client guided session with prescribed reps/load, click fill for set 1 and confirm the reps/load inputs populate and remain editable.
- [ ] 2.4 Reload the session after autosave and confirm filled values are still present.
- [ ] 2.5 Confirm there is no visible per-set OK/completed toggle.

### Phase 3: Trainer Readout, Integration, and E2E Coverage

#### Automated

- [x] 3.1 Readout unit tests pass: `npm test -- src/lib/guided-workout/format-prescription.test.ts src/lib/trainer-dashboard/readout.test.ts`
- [ ] 3.2 Integration set-log test passes: `npm run test:integration -- tests/integration/rls/set-logs.test.ts`
- [ ] 3.3 E2E prescription fill spec passes if local Supabase/dev seed is available: `npm run test:e2e -- tests/e2e/prescription-fill-logging.spec.ts`
- [ ] 3.4 Full quality gate passes: `npm run lint && npm test`

#### Manual

- [ ] 3.5 Trainer session detail shows filled rows as logged and empty rows as not logged.
- [ ] 3.6 Guided workout quick-navigation still preserves entered values after moving to the next exercise and reloading.
- [ ] 3.7 If local E2E prerequisites are unavailable, run the browser steps manually against a local seeded Supabase instance.
