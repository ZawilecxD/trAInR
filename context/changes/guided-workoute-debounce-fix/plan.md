# Guided-workout debounced set-log save loss on quick navigation — Implementation Plan

## Overview

When a client enters set values in the guided workout and immediately leaves the exercise (taps Next/Prev, jumps via the nav list/menu, or goes back to the list/overview) before the 500 ms autosave debounce fires, the pending `PUT /api/client/set-logs` is silently cancelled and the data is lost — with no error shown (false safety). This plan makes the debounced save **flushable and awaitable**, and gates every exercise-leaving transition on a completed flush so a user cannot lose a logged set by navigating away.

## Current State Analysis

- `GuidedWorkoutHub` renders the active exercise as `<GuidedExerciseView key={currentExercise.id} … />` (`src/components/guided-workout/GuidedWorkoutHub.tsx:179-181`). Changing `exerciseIndex` (or `mode`) changes the key / unmounts the subtree.
- The unmounted subtree (`GuidedExerciseView` → `ExerciseSetLogTable` → `SetLogRow` → `useDebouncedSetLogSave`) tears down. The hook's debounce effect cleanup runs `window.clearTimeout(timer)` (`src/components/hooks/useDebouncedSetLogSave.ts:122-125`), cancelling the not-yet-fired save.
- The save itself is healthy: `PUT /api/client/set-logs` → `upsertSetLog` (`src/pages/api/client/set-logs.ts:11-48`). The defect is purely client-side timer cancellation on unmount.
- `cancelPendingSave()` is deliberately invoked on row delete/clear (`src/components/guided-workout/SetLogRow.tsx:125`); any flush logic must NOT resurrect deleted/cleared values.
- Navigation entry points that unmount the current rows: `onNext`/`onPrev` (hub `:194-199`), desktop `ExerciseNavList` `onSelectExercise` (hub `:169-174`), `ExerciseNavMenu` (hub `:205-211`), `onBackToEditList` (hub `:188`), `onBackToOverview` (hub `:185`). All currently call `setExerciseIndex`/`setMode` synchronously.
- The E2E `tests/e2e/guided-workout-quick-navigation-persistence.spec.ts` reproduces the bug and is currently **red**: it types reps/load, taps Next, waits for the next exercise heading, reloads, and asserts the values persisted.
- Vitest is `environment: "node"`, `include: ["src/**/*.test.ts"]` (`vitest.config.ts`) — no jsdom / React testing tooling. The E2E is the practical regression guard.

### Key Discoveries:

- The determinism hinge: because the E2E does not wait for the save before reloading, only **flush-and-await before the view changes** makes it pass reliably — the next-exercise heading then appears only *after* the save has resolved, so the subsequent reload reads committed data.
- `useDebouncedSetLogSave` already serializes values and uses a generation guard (`saveGenerationRef`) to ignore stale responses; `saveNow` can be extended to report success without disturbing that guard.
- `onSelectExercise` is typed `(index: number) => void` in both `ExerciseNavList` and `ExerciseNavMenu`; the hub owns the actual transition, so async gating can live entirely in the hub handlers without changing those child prop signatures.

## Desired End State

A client can type into any set field and immediately leave the exercise by any path; the value is persisted before the destination view renders. On reload the value is present. If the flush save fails, the user stays on the current exercise and sees the existing per-row error/retry affordance instead of silently losing data. Verified by the previously-red guided-workout E2E now passing, plus `npm run lint` and `npm run build` green.

## What We're NOT Doing

- No coverage for a real browser refresh / tab-close mid-edit (no `pagehide`/`visibilitychange` beacon). In-app navigation only.
- No new unit-test tooling (no jsdom / @testing-library / Vitest config change).
- No change to the save API, schema, debounce duration, or the `key={currentExercise.id}` remount strategy.
- No flush wiring for the separate `SessionEditList` (edit-list mode) internal interactions — only guided-mode exercise-leaving transitions are in scope.
- No toast/notification system; failure handling reuses the row's existing error UI.

## Implementation Approach

Introduce an awaitable `flush()` on the save hook that immediately sends any pending (scheduled-but-unsent) or in-flight save and resolves to a success boolean. Mounted rows self-register their `flush` into a small React context registry created by `GuidedWorkoutHub`. The hub's navigation handlers become async: they set a "navigating" flag, call `flushAll()`, and only perform the transition if all flushes succeed; on failure they abort and leave the user on the current exercise (the row's error/retry UI is already visible). Navigation controls are disabled while a flush is in flight. The registry/context is optional — if no provider is present the hook behaves exactly as today, keeping it independently usable.

## Critical Implementation Details

- **Timing & lifecycle**: The flush must run and resolve *before* `exerciseIndex`/`mode` changes, because changing them unmounts the rows. Do not rely on unmount-cleanup to flush — by design the await happens first, so the existing `clearTimeout` cleanup can remain as-is (the pending timer is already consumed by the flush).
- **State sequencing**: `cancelPendingSave()` must also clear the new pending-values/timer refs so a row that was just deleted/cleared does not get re-saved by a subsequent `flushAll()`.

## Phase 1: Flushable save hook + flush registry

### Overview

Make `useDebouncedSetLogSave` expose an awaitable `flush()` and create a context registry so the hub can flush all mounted rows.

### Changes Required:

#### 1. Save hook becomes flushable

**File**: `src/components/hooks/useDebouncedSetLogSave.ts`

**Intent**: Track the pending (scheduled-but-unsent) values and the current in-flight save so a caller can force the save to happen now and await its outcome, without breaking the existing debounce/skip-on-mount/generation behavior.

**Contract**:
- `saveNow` returns `Promise<boolean>` (true on a successful `2xx` save, false on error/abort) and records its promise in an `inFlightRef`; the public `retry` keeps its `() => void` shape (wraps `saveNow`).
- Add `flush(): Promise<boolean>` to the returned object: if a debounce timer is pending, clear it and `saveNow(pendingValues)`; else if a save is in flight, await it; else resolve `true`.
- Maintain `pendingValuesRef` + `timerRef` set when the debounce effect schedules, cleared when the save fires.
- `cancelPendingSave()` additionally clears `pendingValuesRef`/`timerRef` so cleared/deleted rows never flush stale values.
- The debounce effect's cleanup stays `clearTimeout` only.

#### 2. Flush registry context + row self-registration

**File**: `src/components/hooks/useSetLogFlush.ts` (new)

**Intent**: Provide a context-based registry that lets each mounted row register its `flush` under a unique key and lets the hub flush them all at once. Optional by design (no provider → no-op).

**Contract**:
- Export `SetLogFlushContext` (a React context whose value is `{ register(key, flush), unregister(key) } | null`).
- Export `useSetLogFlushRegistry()` for the provider (hub): holds a `Map<string, () => Promise<boolean>>` in a ref and returns stable `register`, `unregister`, and `flushAll(): Promise<boolean>` (runs all registered flushes, resolves `true` only if every one resolves `true`).
- Export `useRegisterSetLogFlush(key, flushFn)`: registers a stable wrapper (calling the latest `flushFn` via a ref) on mount, unregisters on unmount; no-op when context is `null`.

**File**: `src/components/hooks/useDebouncedSetLogSave.ts`

**Intent**: Self-register the hook's `flush` so consumers don't need extra wiring.

**Contract**: Call `useRegisterSetLogFlush(\`${sessionExerciseId}:${setNumber}\`, flush)` inside the hook.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit` (or `npm run lint`, which is type-checked)
- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- With no `SetLogFlushContext` provider mounted, `SetLogRow` still autosaves on debounce exactly as before (no regression to the standalone hook behavior).

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Gate guided navigation on flush + verify

### Overview

Wrap the guided subtree in the flush registry provider and make every exercise-leaving transition flush-and-await before it proceeds, with controls disabled during the flush and the transition aborted on failure. Then make the red E2E pass.

### Changes Required:

#### 1. Hub provides the registry and gates transitions

**File**: `src/components/guided-workout/GuidedWorkoutHub.tsx`

**Intent**: Create the flush registry, expose it to descendants, and convert each exercise-leaving handler into an async flush-gated transition with a navigating flag.

**Contract**:
- Use `useSetLogFlushRegistry()`; wrap the guided-mode render (at least the subtree containing `GuidedExerciseView`, the desktop `ExerciseNavList`, and `ExerciseNavMenu`) in `<SetLogFlushContext.Provider value={register/unregister}>`.
- Add `isNavigating` state.
- Introduce one helper, e.g. `runGuardedTransition(apply: () => void)`: set `isNavigating(true)`; `const ok = await flushAll()`; if `ok` run `apply()`; always clear `isNavigating`. If `!ok`, do not transition (row error/retry UI already shows).
- Route through it: `onNext`, `onPrev`, `onSelectExercise` (desktop list + menu), `onBackToEditList`, `onBackToOverview`.
- Pass `isNavigating` down to `GuidedExerciseView` (and gate menu/list selection while navigating).

#### 2. Exercise view reflects the navigating state

**File**: `src/components/guided-workout/GuidedExerciseView.tsx`

**Intent**: Disable Prev/Next while a flush is in flight and show a brief saving indication so the user gets honest feedback and can't double-tap.

**Contract**: Accept an `isNavigating?: boolean` prop; disable the Prev and Next/Finish buttons when true and show a pending affordance (spinner/label) on the active button. `onPrev`/`onNext`/back handlers remain the hub-provided callbacks.

#### 3. E2E regression guard

**File**: `tests/e2e/guided-workout-quick-navigation-persistence.spec.ts`

**Intent**: This existing spec is the guard; it should now pass unchanged. Optionally add a second assertion path (jump via the nav menu) only if cheap.

**Contract**: No change required to make it green. If adding the menu-jump variant, reuse the same setup/cleanup and `CLIENT_STORAGE_STATE`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`
- Guided-workout E2E passes: `npx playwright test tests/e2e/guided-workout-quick-navigation-persistence.spec.ts --project=chromium --reporter=list`

#### Manual Verification:

- In a 2+ exercise session: type reps/load, immediately tap Next, then reload — values persist (also verify Prev, the nav menu jump, back-to-list, and back-to-overview).
- Simulate a failing save (e.g. offline/devtools throttle): tapping Next keeps you on the current exercise and the row shows the retry control; after retry succeeds, navigation proceeds.
- Navigating away from an untouched exercise is effectively instant (flush resolves immediately, no perceptible block).
- No regression: normal debounce autosave (typing then waiting) still works and shows the saved state.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation.

---

## Testing Strategy

### Unit Tests:

- None added (no jsdom/React testing tooling per the verification decision).

### Integration Tests:

- Existing RLS/integration suites must remain green (no API/schema changes expected).

### Manual Testing Steps:

1. Start local stack + dev server; sign in as `client-A`.
2. Open a session with ≥2 exercises and Begin.
3. Type reps/load on set 1, immediately tap Next; confirm the next exercise renders, then reload and confirm set 1 still shows the values.
4. Repeat for Prev, nav-menu jump, back-to-list, and back-to-overview.
5. Throttle/disable network, type, tap Next; confirm you stay on the exercise with a retry control; restore network, retry, confirm navigation proceeds.

## Performance Considerations

Flush adds at most one already-needed `PUT` round-trip per exercise-leaving transition; untouched exercises resolve immediately. No new polling or background work.

## Migration Notes

None — client-only behavior change, no data or schema migration.

## References

- Change: `context/changes/guided-workoute-debounce-fix/change.md`
- Bug origin transcript: parent chat `0c2b679a-5a52-4360-a785-4d0d3d6d2bf8`
- Risk source: `context/foundation/test-plan.md` Risk #6
- Hook: `src/components/hooks/useDebouncedSetLogSave.ts:110-125`
- Remount trigger: `src/components/guided-workout/GuidedWorkoutHub.tsx:179-181`
- E2E guard: `tests/e2e/guided-workout-quick-navigation-persistence.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Flushable save hook + flush registry

#### Automated

- [x] 1.1 Type checking passes: `npx tsc --noEmit`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Production build passes: `npm run build`

#### Manual

- [x] 1.4 Without a flush provider, `SetLogRow` still autosaves on debounce (no standalone-hook regression)

### Phase 2: Gate guided navigation on flush + verify

#### Automated

- [ ] 2.1 Linting passes: `npm run lint`
- [ ] 2.2 Production build passes: `npm run build`
- [ ] 2.3 Guided-workout E2E passes: `npx playwright test tests/e2e/guided-workout-quick-navigation-persistence.spec.ts --project=chromium --reporter=list`

#### Manual

- [ ] 2.4 Type + immediate Next + reload persists values; verified for Prev, nav-menu jump, back-to-list, back-to-overview
- [ ] 2.5 Failing save keeps the user on the exercise with a retry control; retry then allows navigation
- [ ] 2.6 Leaving an untouched exercise is not perceptibly blocked
- [ ] 2.7 Normal debounce autosave still works with no regression
