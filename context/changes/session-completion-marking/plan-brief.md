# Session Completion Marking — Plan Brief

> Full plan: `context/changes/session-completion-marking/plan.md`

## What & Why

Allow the client to explicitly mark a workout session as **finished**, **finished partially**, or **cancelled**. Currently `workout_sessions.status` is never written by app code — sessions stay `not_started` forever regardless of whether the client logged any sets. FR-021 requires this explicit completion marking so trainers can see real session outcomes and the calendar conveys meaningful state.

## Starting Point

The DB enum has three values (`not_started`, `finished`, `finished_partially`) and the `completed_at` column exists but is never populated. The client calendar renders coloured dots per status, but all sessions stay blue ("not started") since nothing writes a different status. The guided workout view has no "Finish" button — the last exercise's "Finish" label navigates back to edit-list without persisting anything.

## Desired End State

After this slice, clients can mark their workout "Finished", "Partially Done", or "Cancelled" from the session UI. The choice persists to the database, appears as the correct coloured dot on their calendar, and the trainer dashboard session detail badge reflects the actual outcome. Completed sessions show a read-only confirmation screen rather than re-entering the guided workout flow.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Can a completed session be reopened? | No | MVP simplicity; roadmap open question deferred | Plan |
| Logs retained on cancel | Yes (no delete) | Preserves partial data for trainer visibility | Plan |
| `completed_at` on cancel | Not set | "Cancelled" means not completed, only finished states warrant the timestamp | Plan |
| Status write mechanism | Direct Supabase update in service (no RPC) | Consistent with start/restart pattern; RLS already enforces ownership | Plan |
| Cancel before starting | Available from SessionOverview | Clients may choose not to do a session without ever opening it | Plan |

## Scope

**In scope:**
- Add `cancelled` to `session_status` DB enum (migration)
- TypeScript types, status label/badge helpers, calendar components for 4th status
- `POST /api/client/sessions/{id}/complete` endpoint
- `markSessionComplete` service function
- "Finish Session" (finished / finished_partially / cancelled) in `SessionEditList`
- "Cancel Session" in `SessionOverview` (pre-start)
- `SessionCompletedView` read-only screen + `"completed"` mode in state machine

**Out of scope:**
- Reopening sessions
- Deleting logs on cancel
- Per-set completion (S-19)
- 24h data-edit window (S-13)
- RLS column-level restrictions
- Trainer-side cancel

## Architecture / Approach

The change follows the existing service → API route → React component pattern. The `SessionStatus` union type is extended; exhaustive switch arms in `session-status.ts` propagate `cancelled` to badges and labels throughout the app. A new `POST complete` route calls the service. The guided workout state machine gains a `"completed"` mode that short-circuits to a read-only view for any non-`not_started` session.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Data + Types | `cancelled` in enum; 4-status calendar | `ALTER TYPE ADD VALUE` is non-transactional — apply in isolation |
| 2. Service + API | `markSessionComplete` + complete endpoint | Cross-client ownership guard must be airtight |
| 3. UI | Finish/cancel buttons, CompletedView, mode routing | UI must gate out already-completed sessions cleanly |

**Prerequisites:** Local Supabase running (`npx supabase start`), S-06 codebase in place (already done)

## Open Risks & Assumptions

- `workout_sessions_client_update` RLS WITH CHECK has a subtle condition (allows update only if plan is not active OR user is assigned trainer); the existing integration test proves it works, but column-level tightening is a future hardening item
- No automated test for the new API route; relies on manual verification + existing RLS test

## Success Criteria (Summary)

- Client can reach a terminal status on any session from the UI (finish, partial, cancel)
- Calendar correctly colours all four statuses; cancelled sessions show grey dot
- Once in terminal status, re-entering the session shows `SessionCompletedView`, not the logging UI
