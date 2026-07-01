# Frame Brief: Post-completion edit window — wrong session surface

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Client opens a workout session they have already marked finished (within the 24h edit window) and lands on a page showing **"Begin Workout"** and **"Cancel Session"**. "Begin Workout" is the wrong label for a finished session; clicking it or Cancel yields **"Session has already been completed or cancelled"**. The client cannot edit logged data during the edit window.

## Initial Framing (preserved)

- **User's stated cause or approach**: The finished-session page shows pre-start CTAs (`SessionOverview`) with wrong labels; Begin should read "Edit" and Cancel should be hidden once the session is completed.
- **User's proposed direction**: Fix button copy and visibility on the finished-session page so the client can edit within the window.
- **Pre-dispatch narrowing**: Leading concern is **inability to edit during the edit window** when re-entering a finished session; wrong buttons on the overview screen are the visible symptom, not the sole root.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Initial mode resolution** (`resolveInitialMode`) — finished session loads into the wrong mode (`overview` or `completed` instead of `edit-list`).
2. **Runtime mode transitions** (`GuidedWorkoutHub` `setMode`) — client navigates into `overview` after completion while DB status is already terminal.
3. **Overview screen contract** (`SessionOverview`) — pre-start UI rendered without checking `session.status`. ← user's current framing
4. **Completed screen lockout** (`SessionCompletedView`) — S-08 read-only terminal view with no edit-window entry when routing skips `edit-list`.
5. **S-08 ↔ S-13 integration** — completion slice and edit-window slice assumed different post-terminal behavior.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Fresh load of DB-finished + open window routes to `overview` | `resolveInitialMode` returns `overview` only for non-terminal sessions (`session-mode.ts:23-33`); terminal `finished`/`finished_partially` + `locked_at` + unsealed → `edit-list` (`:11-17`); test `session-mode.test.ts:76-85` | **NONE** |
| Finished + `locked_at` null routes to `completed`, not `edit-list` | Terminal branch requires truthy `locked_at` (`session-mode.ts:12-15`); `markSessionComplete` sets `locked_at` only for done/partial (`service.ts:396-399`) | **STRONG** |
| Runtime path to `overview` with terminal DB status | `setMode("overview")` at `GuidedWorkoutHub.tsx:121` (restart) and `:284` (back from guided when `!startedAt`); `SessionOverview` has no `status` guard (`SessionOverview.tsx:105-123`); Cancel → `markSessionComplete` → `already_completed` (`service.ts:391-392`) | **STRONG** |
| `SessionOverview` shows wrong CTAs for finished sessions | No `session.status` read anywhere in component; S-08 plan required cancel guard `status === "not_started"` (`session-completion-marking/plan.md:256`) but not implemented | **STRONG** |
| `SessionCompletedView` allows edit during window | Read-only summary + comments only (`SessionCompletedView.tsx:14-60`); no `locked_at` / edit routing | **NONE** |
| User fix (rename Begin, hide Cancel) restores editing | Editing lives in `SessionEditList` / guided tables, not `SessionOverview`; overview `onBegin` calls `start` API (`GuidedWorkoutHub.tsx:169-190`), not log edit | **NONE** |

## Narrowing Signals

Step 3 evidence is decisive on the primary split; Step 4 questioning skipped.

- Cancel error text proves DB `status !== "not_started"` while UI is in pre-start `SessionOverview` — **mode/status desync**, not wrong initial routing for a correctly completed session.
- `SessionOverview` is the only surface with both "Begin Workout" and "Cancel Session" — symptom matches `mode === "overview"`, not `completed` or `edit-list`.
- S-08 manual test expected re-entry → `SessionCompletedView` (`session-completion-marking/plan.md:309`); S-13 overrode this only in `resolveInitialMode` for open-window cases, leaving overview transitions and completed view unchanged.

## Cross-System Convention

| Slice | Post-terminal convention |
| --- | --- |
| S-08 (session-completion-marking) | Any terminal status → `"completed"` mode → read-only `SessionCompletedView`; no reopen |
| S-13 (data-edit-window) | `finished`/`finished_partially` + unsealed `locked_at` → `"edit-list"` on **initial load**; seal enforcement in services/RLS |
| S-06 (guided-workout-logging) | `overview` = pre-start; `edit-list` = post-log editing hub |

S-13 patched initial routing but did not reconcile S-08's terminal-mode contract across **all navigation paths** or retrofit `SessionCompletedView` / `SessionOverview` for the edit-window exception.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the guided workout state machine exposes the pre-start `overview` surface (and S-08's read-only `completed` surface) after session completion, but post-completion editing within the 24h window is implemented only in `edit-list` mode — so clients hit invalid pre-start actions or a read-only terminal screen instead of the edit UI.

Renaming "Begin Workout" to "Edit" and hiding Cancel would patch one symptom on `SessionOverview` but would not deliver editing: overview's primary action starts a session (`POST /start`), not open log editing. The fix belongs in **mode routing and status-aware surfaces** — ensuring finished sessions within the edit window always land in (or can reach) `edit-list`, and that `overview` / `completed` modes are unreachable or redirect for that state. Secondary gap: `finished` sessions with `locked_at = null` (pre-migration data or completion edge cases) fall through to `completed` with no edit path.

## Confidence

**HIGH** — code evidence is direct (`SessionOverview` status-blind, error string matches `markSessionComplete`, edit UI only in `edit-list`). Exact reproduction path (stale client state vs. `onBackToOverview` vs. missing `locked_at` on reload) is secondary to the architectural gap.

## What Changes for /10x-plan

Plan a **post-completion navigation fix** for the edit-window slice:

1. **Landing (finished + open window):** read-only summary (`SessionCompletedView` pattern) with an **Edit** button — not direct `edit-list`, not pre-start `SessionOverview`.
2. **Edit action:** button switches hub mode to `edit-list` (in-app transition; same session URL).
3. **Guards:** `SessionOverview` unreachable for terminal sessions; block runtime `setMode("overview")` when status is terminal; ensure `locked_at` set on done/partial completion.
4. **Sealed window:** summary only, no Edit button.

Do **not** scope as a button-label change on `SessionOverview` — overview remains pre-start only.

### User-confirmed UX (2026-07-01)

| State | Entry screen | Primary CTA |
| --- | --- | --- |
| `not_started` | `SessionOverview` | Begin Workout (+ Cancel) |
| `finished` / `finished_partially` + open window | Read-only summary | **Edit** → `edit-list` |
| `finished` / `finished_partially` + sealed | Read-only summary | none |
| `cancelled` | Read-only summary | none |


## References

- `src/lib/guided-workout/session-mode.ts:10-33`
- `src/components/guided-workout/GuidedWorkoutHub.tsx:169-214, 282-285`
- `src/components/guided-workout/SessionOverview.tsx:105-123`
- `src/components/guided-workout/SessionCompletedView.tsx:14-60`
- `src/lib/workout-sessions/service.ts:368-417`
- `context/changes/session-completion-marking/plan.md:219-309`
- `context/changes/data-edit-window/plan.md` (initial load + edit-list only)
- Investigation: explore agent 72733f05-c637-46d3-8633-499a0041a265
