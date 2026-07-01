# Data Edit Window — Implementation Plan

## Overview

Implement S-13 / FR-022: logged workout data remains editable for 24 hours after the first set log entry (UTC), then seals immutable. Sets `workout_sessions.locked_at` to the seal deadline on first log, enforces writes in service + RLS, and surfaces countdown / sealed state in the edit-list and guided logging UI.

Linear: ZAW-18.

## Current State Analysis

- `locked_at` column exists on `workout_sessions` but is always `null`.
- `upsertSetLog` / `deleteSetLog` / `restartMySession` check `if (locked_at)` — incorrect for deadline semantics.
- RLS policies on `set_logs` have no seal gate.
- `SessionEditList` and `SetLogRow` are always editable; no countdown banner.
- S-08 routes terminal statuses to `completed` mode — unchanged; seal is orthogonal for in-progress sessions.

### Key Discoveries

- `src/lib/set-logs/service.ts:99` — lock check needs `isSessionSealed(locked_at)`
- `src/lib/workout-sessions/service.ts:345` — restart must reset `locked_at` to `null` with logs
- `docs/stitch-ui-design-prompt.md:274` — "Editable for 23h" banner + lock icon when sealed
- Roadmap risk: MVP uses UTC; document in helper JSDoc

## Desired End State

1. First `set_log` upsert sets `locked_at = min(logged_at) + 24h` (UTC).
2. While `now < locked_at`, client can upsert/delete logs and restart session.
3. When `now >= locked_at`, service returns `locked` (HTTP 423) and RLS blocks writes.
4. Edit-list shows countdown while open; sealed state is read-only with lock notice.
5. Guided mode respects seal (read-only logging).
6. Lint + build pass; unit + integration tests cover seal logic.

## What We're NOT Doing

- Timezone localization (UTC only for MVP)
- Cron/background job to flip seal (deadline comparison at read/write time)
- Changing S-08 completion semantics (terminal status still read-only immediately)
- Trainer-side edit of client logs
- Ad-hoc session lock differences (same rules apply)

## Implementation Approach

Three phases bottom-up (migration → service → UI → tests), matching S-06 pattern.

## Critical Implementation Details

**Deadline semantics**: `locked_at` is the future seal instant, not "already locked". Every check must use `locked_at IS NOT NULL AND locked_at <= now()`. UI countdown uses `locked_at - now`.

**Restart clears deadline**: `restartMySession` must set `locked_at: null` when wiping logs.

---

## Phase 1: Lock Deadline — Migration + Service

### Overview

Add RLS seal function, fix service lock checks, set `locked_at` on first log, clear on restart.

### Changes Required

#### 1. Supabase migration

**File**: `supabase/migrations/20260701120000_data_edit_window_lock.sql`

**Intent**: Add `is_workout_session_sealed(uuid)` SQL helper; tighten `set_logs` INSERT/UPDATE/DELETE policies to deny when parent session is sealed; update `locked_at` column comment to document deadline semantics.

**Contract**: `is_workout_session_sealed(p_session_id uuid) returns boolean` — true when `locked_at is not null and locked_at <= now()`.

#### 2. Edit-window helpers

**File**: `src/lib/guided-workout/edit-window.ts`

**Intent**: Pure UTC helpers shared by services and UI.

**Contract**: Export `EDIT_WINDOW_MS`, `isSessionSealed(lockedAt, now?)`, `computeEditDeadline(firstLoggedAt)`, `formatEditWindowRemaining(lockedAt, now?)` returning `"open" | "sealed"` label text.

#### 3. Set-logs service

**File**: `src/lib/set-logs/service.ts`

**Intent**: Use `isSessionSealed`; after successful upsert call `ensureSessionEditDeadline(supabase, sessionId)` to set `locked_at` from earliest log when null.

**Contract**: `ensureSessionEditDeadline` updates `workout_sessions.locked_at` only when currently null.

#### 4. Workout-sessions service

**File**: `src/lib/workout-sessions/service.ts`

**Intent**: Fix `restartMySession` seal check; reset `locked_at: null` on restart.

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- `npm run build` passes
- Unit tests in `src/lib/guided-workout/edit-window.test.ts` pass

#### Manual Verification

- Paste `context/changes/data-edit-window/verification.sql` in Supabase Studio — all checks PASS

---

## Phase 2: UI — Countdown + Read-Only Seal

### Overview

Surface edit-window state in edit-list and guided views; disable inputs and destructive actions when sealed.

### Changes Required

#### 1. SetLogRow read-only mode

**File**: `src/components/guided-workout/SetLogRow.tsx`

**Intent**: Add optional `readOnly` prop; disable inputs, toggles, delete when true.

#### 2. ExerciseSetLogTable + GuidedExerciseView

**Files**: `src/components/guided-workout/ExerciseSetLogTable.tsx`, `GuidedExerciseView.tsx`

**Intent**: Thread `readOnly` from parent.

#### 3. SessionEditList banner + actions

**File**: `src/components/guided-workout/SessionEditList.tsx`

**Intent**: Show edit-window banner (countdown or sealed); hide/disable Restart and Add round when sealed; pass `readOnly` to tables.

**Contract**: Use `Lock` icon from lucide when sealed; live countdown via `useEffect` interval (60s).

#### 4. GuidedWorkoutHub wiring

**File**: `src/components/guided-workout/GuidedWorkoutHub.tsx`

**Intent**: Compute `isSealed` from `session.locked_at`; pass to `SessionEditList`, `GuidedExerciseView`; update local `locked_at` after first save if returned from API (optional: refresh from upsert side-effect via session state).

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification

- Session with logs shows "Editable for …" banner
- After setting `locked_at` in past via SQL, UI is read-only and writes return 423

---

## Phase 3: Tests

### Overview

Unit tests for helpers and session-mode; integration RLS test for sealed session.

### Changes Required

#### 1. Edit-window unit tests

**File**: `src/lib/guided-workout/edit-window.test.ts`

#### 2. Session-mode tests

**File**: `src/lib/guided-workout/session-mode.test.ts` — add sealed session still returns `edit-list` when `not_started`

#### 3. RLS integration test

**File**: `tests/integration/rls/set-logs-sealed.test.ts`

**Intent**: Client cannot UPDATE/DELETE/INSERT set_logs when `locked_at <= now()`.

#### 4. Verification SQL

**File**: `context/changes/data-edit-window/verification.sql`

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- `npm run build` passes
- `npm test` passes (unit + integration if Supabase available)

---

## Testing Strategy

### Unit Tests

- `isSessionSealed` boundary at deadline
- `formatEditWindowRemaining` open vs sealed
- `computeEditDeadline` adds 24h

### Integration Tests

- RLS blocks writes on sealed session

### Manual Testing Steps

1. Log first set → verify `locked_at` ≈ now + 24h in DB
2. Edit within window → saves succeed
3. Set `locked_at` to past → UI read-only, API 423

## Performance Considerations

Deadline check is O(1) timestamp comparison. `ensureSessionEditDeadline` runs one aggregate query on first log only.

## Migration Notes

Existing sessions with logs but `locked_at = null` get deadline set on next upsert.

## References

- Research: `context/changes/data-edit-window/research.md`
- ERD: `docs/ERD.md:350,522`
- S-06 archive: `context/archive/2026-06-14-guided-workout-logging/plan.md`

## Progress

### Phase 1: Lock Deadline — Migration + Service

#### Automated

- [x] 1.1 `npm run lint` passes
- [x] 1.2 `npm run build` passes
- [x] 1.3 Unit tests in `edit-window.test.ts` pass

#### Manual

- [x] 1.4 `verification.sql` all PASS in Supabase Studio

### Phase 2: UI — Countdown + Read-Only Seal

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 `npm run build` passes

#### Manual

- [x] 2.3 Countdown banner visible; sealed state read-only

### Phase 3: Tests

#### Automated

- [x] 3.1 `npm run lint` passes
- [x] 3.2 `npm run build` passes
- [x] 3.3 `npm test` passes

### Phase 4: Post-completion summary + Edit entry

> Detail: `plan-phase-4-post-completion-nav.md`

#### Automated

- [x] 4.1 `npm run lint` passes
- [x] 4.2 `npm run build` passes
- [x] 4.3 `npm test` passes

#### Manual

- [ ] 4.4 Summary + Edit flow; no Begin/Cancel on finished re-entry
