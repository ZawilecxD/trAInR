# Ad-hoc Session Logging Research Snapshot

## Decision

S-16 is parked for post-MVP. The initial planning pass found that ad-hoc logging is not just a new entry point into the S-06 guided workout UI; it changes session creation ownership, exercise library access, session provenance, and downstream dashboard/calendar semantics.

## Current State

- S-06 guided logging is reusable once a valid `ClientSessionDetail` exists. The flow is `src/pages/client/sessions/[sessionId].astro` -> `getMySessionDetail` -> `GuidedWorkoutHub` -> `ExerciseSetLogTable` / `SetLogRow` -> `/api/client/set-logs`.
- The core logging path already handles autosave, retry-on-error, log deletion, exercise navigation, edit-list mode, and `locked_at` write rejection through `src/lib/set-logs/service.ts`.
- Session creation is trainer-owned today. `POST /api/workout-sessions` uses `requireTrainer`, then `createWorkoutSession`, which wraps the `create_workout_session` RPC in `supabase/migrations/20260608130000_workout_session_rpcs.sql`.
- Clients can list and open assigned sessions through `GET /api/client/sessions` and `/client/sessions/[sessionId]`, but there is no client-scoped session creation API.
- Clients cannot browse their trainer's exercise library in general. Current exercise RLS only lets clients read exercise rows already attached to their assigned sessions.
- Existing tables can structurally hold an ad-hoc session because `workout_sessions` belongs to a `client_plan`, `source_template_id` is nullable, and guided logging only needs session exercises and sets. There is no origin/provenance column that distinguishes trainer-assigned sessions from client-created ad-hoc sessions.

## Likely Scope When Revisited

- Add explicit session provenance, likely on `workout_sessions`, so downstream UI can distinguish trainer-assigned vs client-created sessions.
- Add a client-scoped SECURITY DEFINER RPC for ad-hoc session creation. It should infer the client from `auth.uid()`, resolve the assigned trainer/active plan, validate selected exercises against the assigned trainer's library, insert `workout_sessions`, `session_exercises`, and `session_exercise_sets`, and return the session id.
- Add client-safe exercise library access, either through a narrow read RPC/API or a new RLS policy that only exposes the assigned trainer's non-archived exercises to the client.
- Add `POST /api/client/sessions` for creation, plus schemas/types derived from the existing session creation payload but without `client_id` and `source_template_id`.
- Add a client `/client/sessions/new` page or equivalent entry point from `My Plan`, reusing the phase/round form primitives and exercise picker where reasonable.
- Reuse the existing guided logging route after creation by redirecting to `/client/sessions/[sessionId]`; avoid duplicating the S-06 logging components.

## Open Product Questions

- Should ad-hoc sessions appear retroactively on the client calendar for their chosen date?
- Should clients choose only from their trainer's exercise library, or can they enter free-form exercise names?
- Should the trainer be able to convert an ad-hoc workout into a reusable template or assigned future session?
- How should trainer-facing views label ad-hoc sessions so they do not look like prescribed compliance work?
- Should ad-hoc sessions start immediately in guided mode, or show a lightweight review/overview first?

## Suggested Post-MVP Framing

Treat S-16 as a self-directed training feature, not a minor logging extension. The safest post-MVP version should probably restrict exercise selection to the assigned trainer's library, mark the session as client-created, show it on the calendar with a distinct badge, and route into the existing guided logging UI immediately after creation.
