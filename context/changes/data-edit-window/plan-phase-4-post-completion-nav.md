# Phase 4: Post-completion summary + Edit entry

> Follow-up to frame brief (`frame.md`). Original phases 1–3 shipped seal logic and edit-list UI; this phase fixes navigation so finished sessions within the edit window are reachable without hitting pre-start `SessionOverview`.

Linear: ZAW-18.

## Problem (from frame)

Finished + open-window sessions must not land on `SessionOverview` (Begin/Cancel). Editing lives in `edit-list`. User wants a **two-step** flow: summary first, explicit Edit to edit.

## Desired UX

```
Re-enter finished session (open window)
  → completed mode: read-only summary + EditWindowBanner + [Edit]
  → tap Edit
  → edit-list mode: log tables, countdown, readOnly if sealed

After marking Done in-session
  → stay on or return to summary (not edit-list immediately)
  → user can tap Edit if they want to correct logs
```

| Entry state | Initial mode | CTA |
| --- | --- | --- |
| `not_started` | `overview` | Begin Workout, Cancel Session |
| `finished` / `finished_partially` + unsealed `locked_at` | `completed` | **Edit** |
| `finished` / `finished_partially` + sealed / null `locked_at` | `completed` | none |
| `cancelled` | `completed` | none |

## Changes Required

### 1. `resolveInitialMode` — land on summary, not edit-list

**File**: `src/lib/guided-workout/session-mode.ts`

**Intent**: Terminal `finished` / `finished_partially` always return `"completed"` on load. Open edit window is surfaced inside `SessionCompletedView`, not by skipping to `edit-list`.

**Contract**: Remove the branch that returns `"edit-list"` for terminal + open window. Keep `edit-list` for in-progress (`not_started`) sessions with `started_at` + logs.

### 2. `SessionCompletedView` — Edit CTA + banner

**File**: `src/components/guided-workout/SessionCompletedView.tsx`

**Intent**: When session is `finished` or `finished_partially` and `!isSessionSealed(session.locked_at)`, show `EditWindowBanner` and a fixed-bottom **Edit** button. `onEdit` prop switches hub to `edit-list`.

**Contract**: No Edit for `cancelled` or sealed sessions. Banner uses existing `EditWindowBanner` component.

### 3. `GuidedWorkoutHub` — wire Edit + fix transitions

**File**: `src/components/guided-workout/GuidedWorkoutHub.tsx`

**Intent**:

- Pass `onEdit={() => setMode("edit-list")}` to `SessionCompletedView`.
- After `handleComplete` with done/partial + open window → `setMode("completed")` (not `edit-list`).
- Guard `setMode("overview")`: if `session.status !== "not_started"`, redirect to `completed` instead.
- `SessionEditList` back link (header Calendar) unchanged; optional: back from edit-list to summary when terminal (ArrowLeft → `setMode("completed")`) so user can exit edit without leaving session.

### 4. `SessionOverview` — status guard (defensive)

**File**: `src/components/guided-workout/SessionOverview.tsx`

**Intent**: If hub ever renders overview with terminal status, redirect via effect or render nothing — S-08 plan guard that was never added. Cancel button only when `session.status === "not_started"`.

### 5. Tests

**Files**: `src/lib/guided-workout/session-mode.test.ts`, component tests if present

**Intent**:

- Finished + open window → `completed` (not `edit-list`).
- Finished + sealed → `completed`.
- In-progress + logs → still `edit-list`.

## Success Criteria

### Automated

- `npm run lint` passes
- `npm run build` passes
- `npm test` passes (updated session-mode tests)

### Manual

1. Complete a session → lands on summary with Edit button and countdown banner.
2. Tap Edit → edit-list with writable logs (within window).
3. Re-open session from calendar → summary + Edit (not Begin/Cancel).
4. After window seals → summary only, no Edit.
5. Cancelled session → summary, no Edit.

## Out of Scope

- Separate URL for edit page (same `/client/sessions/[id]`, mode state only)
- Trainer-side edit
- Changing seal deadline semantics
