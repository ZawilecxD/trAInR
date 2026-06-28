# Session Completion Marking — Implementation Plan

## Overview

Allow the client to mark a planned workout session as **finished**, **finished partially**, or **cancelled**. The status is persisted to `workout_sessions.status`, surfaced on the client calendar with a fourth (cancelled) color, and visible to the trainer in the session detail view.

This is roadmap slice S-08 / Linear ZAW-13.

## Current State Analysis

- `workout_sessions.status` DB enum: `not_started | finished | finished_partially` — **no `cancelled`**
- `SessionStatus` TypeScript type mirrors the enum exactly
- `completed_at` column exists on `workout_sessions` but is **never set** by app code
- No API route writes `status`; the start/restart endpoints only write `started_at`
- Calendar (`PlanCalendar.tsx`) handles 3 statuses with 3 colored dots; a cancelled session would fall through unhandled
- `SessionEditList.tsx` has a "Continue workout" CTA but no "Finish / Cancel" action
- `SessionOverview.tsx` has "Begin Workout" but no cancel-before-starting option
- `GuidedWorkoutHub.tsx` mode resolution (`resolveInitialMode`) ignores `status` entirely — a finished session still enters edit-list mode
- RLS `workout_sessions_client_update` already permits client direct updates; integration test proves it works for status transitions

### Key Discoveries

- `src/types.ts:123` — `SessionStatus` is a plain union type, easy to extend
- `src/lib/session-status.ts` — central switch-based helpers for label + badge class; adding a case here propagates to all calendar views automatically
- `src/components/plans/PlanCalendar.tsx:21-25` — `STATUS_PRIORITY` record + switch; both need a `cancelled` entry
- `src/components/guided-workout/SessionEditList.tsx` — fixed bottom bar with "Continue workout" is the right place to add "Finish Session" actions
- `src/components/guided-workout/SessionOverview.tsx` — fixed bottom bar with "Begin Workout" is the right place to add "Cancel Session"
- `src/lib/guided-workout/session-mode.ts` — `resolveInitialMode` must return a new `"completed"` mode for sessions with non-`not_started` status

## Desired End State

After this plan:

1. Client can mark a session "Finished", "Finished Partially", or "Cancelled" from within the session view.
2. `workout_sessions.status` reflects the choice; `completed_at` is set for finished and finished_partially.
3. Calendar shows a grey/slate dot for cancelled sessions alongside the existing blue/amber/green dots.
4. Once marked (any terminal status), the guided workout view shows a read-only "Session complete" screen rather than the log edit UI.
5. Trainer dashboard session detail already reads `workout_sessions.status` for the badge labelling — no changes required there (it uses `sessionStatusLabel` / `sessionStatusBadgeClass` via the same helpers).
6. Lint passes; production build succeeds; RLS integration test for status update continues to pass.

### Key Decisions Made

- **No reopen after marking**: Any terminal status (finished / finished_partially / cancelled) is permanent. Addresses the roadmap open question conservatively for MVP.
- **Logs retained on cancel**: Marking cancelled does NOT delete logged sets. Whatever the client logged stays in the DB.
- **`completed_at` for finished states only**: Set when `status` becomes `finished` or `finished_partially`; not set for `cancelled`.
- **Direct Supabase update (no RPC)**: Consistent with the existing `startMySession` / `restartMySession` pattern. App-layer guards validate ownership and disallow transitions from terminal states.
- **Cancel from overview (pre-start)**: A client can cancel without ever starting. "Cancel" is available from `SessionOverview` as a secondary action.
- **Finish from edit-list (post-start)**: "Finish Session" (with status selector) appears in `SessionEditList` once the session is started. Also available from anywhere in the guided flow that shows the back-to-edit-list action.

## What We're NOT Doing

- Reopening a cancelled or finished session (roadmap open question, deferred to later)
- Deleting logs on cancel
- Per-exercise or per-set completion states (that is S-19 scope)
- S-13 24-hour data-edit window enforcement (separate slice)
- Tightening the RLS to column-level restrictions (future hardening)
- Trainer-side cancel (trainer creates/deletes sessions; only client marks completion)

## Implementation Approach

Three phases, each fully verifiable before moving to the next:

1. **Data + types** — DB migration adds `cancelled` enum value; TypeScript type, status helpers, and calendar components updated for all four statuses.
2. **Service + API** — New service function `markSessionComplete` + POST API route `/api/client/sessions/[id]/complete`.
3. **UI** — `session-mode.ts` gains `"completed"` mode; new `SessionCompletedView` component; `SessionOverview` adds cancel; `SessionEditList` adds finish/cancel; `GuidedWorkoutHub` wires everything.

---

## Phase 1: Data Layer + Status Helpers

### Overview

Extend the DB enum, TypeScript types, and all presentation helpers to support `cancelled`. Calendar components are updated so a cancelled session shows a grey dot and a grey badge.

### Changes Required

#### 1. New Supabase migration

**File**: `supabase/migrations/20260628120000_add_cancelled_session_status.sql`

**Intent**: Add `cancelled` to the `session_status` enum. PostgreSQL `ALTER TYPE ... ADD VALUE` is non-transactional (cannot be rolled back inside a transaction), so the migration is a single statement.

**Contract**:

```sql
alter type public.session_status add value if not exists 'cancelled';
```

#### 2. TypeScript `SessionStatus` type

**File**: `src/types.ts`

**Intent**: Add `"cancelled"` to the `SessionStatus` union so TypeScript exhaustive checks in switch statements catch any missing branches.

**Contract**: `SessionStatus = "not_started" | "finished" | "finished_partially" | "cancelled"`

#### 3. Session status helpers

**File**: `src/lib/session-status.ts`

**Intent**: Add label and badge class for `cancelled`. The badge uses a slate/neutral colour to convey "skipped" without the urgency of red.

**Contract**:
- `sessionStatusLabel("cancelled")` → `"Cancelled"`
- `sessionStatusBadgeClass("cancelled")` → `"border-slate-400/40 bg-slate-500/20 text-slate-300"`

#### 4. `PlanCalendar` — 4th dot colour + priority

**File**: `src/components/plans/PlanCalendar.tsx`

**Intent**: Add `cancelled` to `STATUS_PRIORITY` (lowest priority — below `not_started`), add a `sessionCancelled` bucket, and add a grey modifier class for the calendar dot.

**Contract**:
- `STATUS_PRIORITY` gains `cancelled: 4` (lower number = higher priority; 4 means "show cancelled dot only when no other status exists on that day")
- New bucket `sessionCancelled: Date[]` collected from the switch
- New modifier class entry: `sessionCancelled: cn(sessionDotBase, "after:bg-slate-400")`

**Critical note**: `highestPriorityStatus` currently uses a `Record<SessionStatus, number>` type — after adding `cancelled` to the union the TS compiler will enforce the new key is present.

### Success Criteria

#### Automated Verification

- `npm run lint` — no type errors on `SessionStatus` switch branches
- `npm run build` — production build succeeds
- Existing integration test `tests/integration/rls/workout-sessions.test.ts` still passes (no schema change to `workout_sessions` table, only enum value added)

#### Manual Verification

- With a local Supabase running and a seeded session, update a session's status to `cancelled` directly in Studio SQL Editor; confirm the calendar shows a grey dot on that date
- Status badge in list view shows "Cancelled" in slate colour

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Service + API Route

### Overview

Add `markSessionComplete` to the workout sessions service and expose it as a POST endpoint clients call from the UI.

### Changes Required

#### 1. Service function

**File**: `src/lib/workout-sessions/service.ts`

**Intent**: Add `markSessionComplete(supabase, userId, sessionId, status)` which:
1. Fetches the session + client_plan ownership in one query (same guard pattern as `restartMySession`)
2. Returns `already_completed` error if `session.status !== "not_started"` (i.e., not the initial state — prevents overwriting a finished session)
3. Writes `{ status, completed_at: now() }` for finished/finished_partially, or `{ status }` alone for cancelled
4. Returns the updated session

**Contract**:

```ts
export type MarkSessionCompleteResult =
  | { ok: true; data: WorkoutSession }
  | { ok: false; code: "not_found" | "already_completed"; message: string };

export async function markSessionComplete(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  status: "finished" | "finished_partially" | "cancelled",
): Promise<MarkSessionCompleteResult>
```

#### 2. API route

**File**: `src/pages/api/client/sessions/[id]/complete.ts`

**Intent**: Expose `POST /api/client/sessions/{id}/complete` to mark a session status. Validates the request body with zod, calls `markSessionComplete`, and returns the updated session or an error.

**Contract**:
- Exports `export const prerender = false`
- Exports `POST` handler
- Zod schema: `z.object({ status: z.enum(["finished", "finished_partially", "cancelled"]) })`
- On success: `200 { session: WorkoutSession }`
- On `already_completed`: `409 { error: "already_completed", details: { message } }`
- On `not_found`: `404`

### Success Criteria

#### Automated Verification

- `npm run lint` — no type errors in new service + route files
- `npm run build` — production build succeeds

#### Manual Verification

Using the Supabase Studio SQL script below, verify that:
1. A client can mark their own session finished via the API (test with `curl` or fetch from browser console)
2. Marking an already-finished session returns 409
3. A client cannot mark another client's session (RLS rejects, returns 404 from service)

```sql
-- Copy-paste into Supabase Studio SQL Editor (local dev)
-- Adjust user UUIDs to match your seed data
begin;

-- Sanity check: what sessions exist?
select id, status, started_at, completed_at
from public.workout_sessions
limit 5;

rollback;
```

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI — Completion Flow

### Overview

Add the `"completed"` mode to the guided workout state machine. Implement `SessionCompletedView` for the read-only post-completion screen. Wire "Finish / Cancel" actions into `SessionEditList` and `SessionOverview`. Update `GuidedWorkoutHub` to detect completed sessions on load and to handle `onComplete` from children.

### Changes Required

#### 1. `session-mode.ts` — add `completed` mode

**File**: `src/lib/guided-workout/session-mode.ts`

**Intent**: If `session.status !== "not_started"`, the session is in a terminal state and should render the completed view regardless of `started_at` or logs. Place this check at the top of `resolveInitialMode`.

**Contract**: `GuidedWorkoutMode` union gains `"completed"`; `resolveInitialMode` returns `"completed"` when `session.status !== "not_started"`.

#### 2. `SessionCompletedView` — new read-only completion screen

**File**: `src/components/guided-workout/SessionCompletedView.tsx`

**Intent**: Show the session name, date, final status badge, and a "← Calendar" link. No logging or editing available. Replaces the edit-list / guided views for completed sessions.

**Contract**: Props `{ session: ClientSessionDetail }`. Renders: back link to `/client/plan`, session name, status badge using `sessionStatusLabel` / `sessionStatusBadgeClass`, scheduled date, and a brief message ("Your workout has been recorded.").

#### 3. `SessionEditList` — finish/cancel actions

**File**: `src/components/guided-workout/SessionEditList.tsx`

**Intent**: Add three action buttons in the fixed bottom bar (replacing the single "Continue workout" button when the client chooses to complete):
- **Finished** — marks full completion
- **Finished Partially** — marks partial completion  
- **Cancel Session** — marks cancelled; requires a confirm dialog to prevent accidental taps

Add `onComplete: (status: "finished" | "finished_partially" | "cancelled") => Promise<void>` to `SessionEditListProps`. Use a local `completePending` + `completeError` state. The confirm dialog for "Cancel Session" reuses the existing `DeleteConfirmDialog` component.

**Contract**: New prop `onComplete`; bottom bar gains three additional buttons alongside "Continue workout" (or as a second row/section). Error shows in-line near the buttons.

#### 4. `SessionOverview` — cancel before starting

**File**: `src/components/guided-workout/SessionOverview.tsx`

**Intent**: Add a secondary "Cancel Session" button below "Begin Workout" in the fixed bottom bar, calling `onCancel`. Requires a confirm dialog. Only shown when `session.status === "not_started"` (already always true for overview mode after Phase 3, but guard is explicit).

**Contract**: New prop `onCancel: () => Promise<void>` on `SessionOverviewProps`.

#### 5. `GuidedWorkoutHub` — wire everything

**File**: `src/components/guided-workout/GuidedWorkoutHub.tsx`

**Intent**: 
1. Handle `mode === "completed"` → render `<SessionCompletedView session={session} />`
2. Add `handleComplete` async function: calls `POST /api/client/sessions/{id}/complete`, on success sets `session.status` in local state and switches `mode` to `"completed"`
3. Pass `onComplete={handleComplete}` to `SessionEditList`
4. Pass `onCancel={() => handleComplete("cancelled")}` to `SessionOverview`

**Contract**: No new props. Internally adds `handleComplete(status)` and wires it to children. `session` state type is `ClientSessionDetail` (unchanged); the `status` field is updated in-place after completion.

### Success Criteria

#### Automated Verification

- `npm run lint` — no TypeScript errors across all changed components
- `npm run build` — production build succeeds

#### Manual Verification

- Open a session in the guided workout view (start it to get to `edit-list` mode)
- Click "Finish Session" → session status badge on calendar changes to green "Finished"
- Navigate back to the session — shows `SessionCompletedView`, not the edit list
- Repeat with a fresh session: click "Cancel Session" from overview (pre-start) → calendar shows grey "Cancelled" dot
- Repeat with partial finish: calendar shows amber "Partial" dot
- Trainer dashboard session detail: status badge reflects client's marking (already uses `sessionStatusLabel` from shared helper)
- Attempting to mark an already-completed session (e.g., via manual API call with curl) returns 409

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests

- `src/lib/session-status.ts`: All four status values return defined label and badge class (TypeScript will catch missing branches, no explicit test needed unless the team adds one later)

### Integration Tests

- Existing `tests/integration/rls/workout-sessions.test.ts` covers client status update via direct Supabase call — no new integration tests needed for basic RLS; the service + API have app-layer unit test coverage potential but none exists in the current test suite (out of scope for this slice per test plan phasing)

### Manual Testing Steps

1. Seed a test client session with status `not_started`
2. Open `/client/sessions/{id}` — confirm overview shows "Begin Workout" + "Cancel Session"
3. Click "Cancel Session" → confirm dialog → accept → calendar shows grey dot; session page shows `SessionCompletedView`
4. Seed a fresh session; begin workout; log 1 set; from edit-list click "Finish Session" → status "Finished" → calendar green dot
5. Navigate back to session → reads `SessionCompletedView` (not edit-list)
6. Seed another session; begin; log some sets; "Finished Partially" → calendar amber dot (same amber as it was before; now also set via actual `status` field not only derived)
7. Try marking an already-finished session via the UI — no "Finish" buttons visible (mode is `completed`)

## Migration Notes

`ALTER TYPE ... ADD VALUE` is additive and non-breaking. Existing rows stay `not_started | finished | finished_partially`. No backfill required.

The new `cancelled` value is only written by the new completion API — no existing code produces it.

## References

- Roadmap: `context/foundation/roadmap.md` § S-08
- PRD: `context/foundation/prd.md` § FR-021
- Linear: ZAW-13

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data Layer + Status Helpers

#### Automated

- [x] 1.1 `npm run lint` passes with no type errors on SessionStatus switch branches — c32c64b
- [x] 1.2 `npm run build` succeeds

#### Manual

- [ ] 1.3 Cancelled session shows grey dot in calendar via direct DB update

### Phase 2: Service + API Route

#### Automated

- [x] 2.1 `npm run lint` passes with no type errors in service + route
- [x] 2.2 `npm run build` succeeds

#### Manual

- [ ] 2.3 API marks session finished; already-completed returns 409; cross-client rejected

### Phase 3: UI — Completion Flow

#### Automated

- [x] 3.1 `npm run lint` passes across all changed UI components
- [x] 3.2 `npm run build` succeeds

#### Manual

- [ ] 3.3 Cancel from overview → grey dot on calendar; session shows CompletedView
- [ ] 3.4 Finish from edit-list → green dot; session shows CompletedView
- [ ] 3.5 Finished Partially → amber dot on calendar
- [ ] 3.6 Trainer dashboard status badge reflects client marking
