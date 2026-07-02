# Finished Session Summary for Client Implementation Plan

## Overview

Add a read-only exercise summary to the client terminal session view (`SessionCompletedView`) by reusing the trainer readout derivation (`deriveSessionReadout`) and extracting a shared `SessionExerciseSummary` component from `SessionActualsReview`.

## Current State Analysis

- `SessionCompletedView` shows trainer name, status, exercise count, comments, and optional Edit CTA — no per-exercise detail.
- `ClientSessionDetail` from `getMySessionDetail` already includes `exercises[]` with `sets` and `logs`.
- `SessionActualsReview` (trainer) implements phase-grouped prescribed/actual tables via `deriveSessionReadout`.
- S-13 Phase 4 navigation: terminal sessions land on `completed` mode; Edit switches to `edit-list`.

### Key Discoveries

- `getSessionDetailForTrainer` maps exercises to `ExerciseReadoutInput` inline (`service.ts` ~488–498) — extractable helper.
- No React component unit tests in repo; vitest covers `src/lib/**` only.
- E2E uses Playwright with pre-authenticated `storageState` and API setup via trainer request context.

## Desired End State

Client opens `/client/sessions/[id]` for a terminal session and sees phase-grouped exercise cards with prescribed vs actual set data, logging status summary, and comments. Edit-window sessions retain the fixed Edit button.

### Verification

- `npm run lint` and `npm run build` pass.
- `npm run test` and `npm run test:integration` pass.
- `npm run test:e2e` passes the new finished-summary spec (with dev server + Supabase).
- Manual: open a finished session in browser; confirm summary before Edit.

## What We're NOT Doing

- Database migrations or RLS changes.
- Changes to edit-list logging UX.
- Trainer dashboard feature additions (refactor only).
- Cancelled-session compact "not attempted" alternate layout.

## Implementation Approach

Extract shared presentation from `SessionActualsReview`, add a small mapping helper for client exercise details, render summary in `SessionCompletedView`, add tests at lib/integration/E2E layers.

## Phase 1: Shared summary component

### Overview

Extract phase-grouped exercise readout UI and a mapping helper so trainer and client share one summary renderer.

### Changes Required

#### 1. Mapping helper

**File**: `src/lib/trainer-dashboard/to-exercise-readout-input.ts`

**Intent**: Map `SessionExerciseDetail[]` (or any object with id, exercise fields, sets, logs) to `ExerciseReadoutInput[]` for `deriveSessionReadout`.

**Contract**: Export `toExerciseReadoutInputs(exercises: SessionExerciseDetail[]): ExerciseReadoutInput[]`.

#### 2. Shared summary component

**File**: `src/components/workout-sessions/SessionExerciseSummary.tsx`

**Intent**: Render `SessionReadoutSummary` as phase-grouped `ExerciseActualsCard` list; accept optional `notesByExerciseId` map.

**Contract**: Props: `{ readout: SessionReadoutSummary; notesByExerciseId?: Map<string, string | null> }`. Move `ExerciseActualsCard`, `groupExercisesByPhase`, `readoutBadgeClass` from `SessionActualsReview`.

#### 3. Refactor trainer review

**File**: `src/components/workout-sessions/SessionActualsReview.tsx`

**Intent**: Use `SessionExerciseSummary` for exercise sections; keep trainer-specific metadata header.

**Contract**: Behavior unchanged for trainer session detail page.

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- `npm run test` passes (new unit tests for mapping helper)

#### Manual Verification

- Trainer session detail page still shows exercise readout tables correctly

## Phase 2: Client completed view

### Overview

Render the shared summary inside `SessionCompletedView` for all terminal sessions.

### Changes Required

#### 1. SessionCompletedView

**File**: `src/components/guided-workout/SessionCompletedView.tsx`

**Intent**: Derive readout from `session.exercises`, render `SessionExerciseSummary` with notes map; show sets-logged stats in metadata section; keep Edit CTA and `EditWindowBanner`.

**Contract**: Summary visible for `finished`, `finished_partially`, and `cancelled`. No Edit for sealed or cancelled.

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification

- Finished session shows exercise summary on load (before Edit)
- Sealed session shows summary without Edit button
- Cancelled session shows prescribed exercises with not-logged actuals

## Phase 3: Tests

### Overview

Unit test for mapping helper; integration test that client session detail supports readout derivation; E2E for finished re-entry summary.

### Changes Required

#### 1. Unit tests

**File**: `src/lib/trainer-dashboard/to-exercise-readout-input.test.ts`

**Intent**: Verify mapping preserves ids, names, sets, logs for `deriveSessionReadout`.

#### 2. Integration test

**File**: `tests/integration/workout-sessions/client-session-readout.test.ts`

**Intent**: Seed a finished session with logs via helpers; assert `deriveSessionReadout(toExerciseReadoutInputs(exercises))` reports expected completed sets (uses real Supabase).

#### 3. E2E test

**File**: `tests/e2e/finished-session-summary.spec.ts`

**Intent**: Trainer creates session; client logs one set, marks finished; reload session URL; assert summary shows exercise name and logged values before Edit.

### Success Criteria

#### Automated Verification

- `npm run test` passes
- `npm run test:integration` passes
- `npm run test:e2e` passes (new spec)

#### Manual Verification

- None beyond phase 2 (covered by E2E)

## Testing Strategy

### Unit Tests

- `toExerciseReadoutInputs` field mapping
- Existing `readout.test.ts` continues to cover derivation logic

### Integration Tests

- Finished session exercise graph seeds correctly; readout reflects logged sets

### Manual Testing Steps

1. As client, complete a workout with mixed logged/unlogged sets.
2. Land on summary — verify all exercises visible with prescribed/actual columns.
3. Tap Edit within 24h window — edit-list loads; back to Summary returns to readout.
4. After seal (or use past `locked_at` in Studio), confirm no Edit and summary still visible.

## Migration Notes

None — read-only UI on existing data.

## References

- `context/foundation/roadmap.md` S-20
- `src/components/guided-workout/SessionCompletedView.tsx`
- `src/components/workout-sessions/SessionActualsReview.tsx`
- `context/archive/2026-07-01-data-edit-window/plan-phase-4-post-completion-nav.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Shared summary component

#### Automated

- [x] 1.1 `npm run lint` passes
- [x] 1.2 `npm run test` passes (mapping helper tests)

#### Manual

- [ ] 1.3 Trainer session detail page still shows exercise readout tables correctly

### Phase 2: Client completed view

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 `npm run build` passes

#### Manual

- [ ] 2.3 Finished session shows exercise summary on load (before Edit)
- [ ] 2.4 Sealed session shows summary without Edit button
- [ ] 2.5 Cancelled session shows prescribed exercises with not-logged actuals

### Phase 3: Tests

#### Automated

- [x] 3.1 `npm run test` passes
- [ ] 3.2 `npm run test:integration` passes
- [ ] 3.3 `npm run test:e2e` passes (new spec)

#### Manual

- [ ] 3.4 None beyond phase 2 (covered by E2E)
