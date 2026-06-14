# Guided Workout Logging (S-06) — Plan Brief

> Full plan: `context/changes/guided-workout-logging/plan.md`
> Mockups: `docs/pencil/guided_workout_logging.pen`

## What & Why

Clients need a mobile-first, one-handed guided workout flow to open assigned sessions from their calendar, see prescriptions, log each set (reps + weight or duration), and navigate between exercises. This closes the core async coaching loop started in S-04/S-05 — without logging, trainer assignments are read-only calendar decorations.

## Starting Point

Database schema (`workout_sessions`, `session_exercises`, `session_exercise_sets`, `set_logs`) and RLS are live from F-01. S-05 delivered a read-only client calendar at `/client/plan` with no session navigation. `getSessionWithExercises` loads prescriptions but not logs; no client session detail route, set-log API, or logging UI exists.

## Desired End State

A client taps **Open** on a calendar session → lands on `/client/sessions/[sessionId]`. New sessions show the overview screen (mockup Screen 1) with **Begin Workout**; tapping it sets `started_at` and enters guided logging (mockup Screen 2). Each set autosaves with saved/saving/error feedback; OK toggle marks completion; Prev/Next and the ≡ menu (mockup Screen 3) enable exercise navigation. Returning to a session with existing logs opens a minimal all-exercises edit list (FR-020). Prescription info is shown per exercise; **previous-performance hints (FR-019) are not in this slice.**

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Set persistence | Autosave per set (debounced) | Gym users shouldn't hunt for Save; matches stitch save-state honesty NFR | Plan |
| API layer | Astro API routes + service layer | Matches S-05 pattern; zod validation; `userId` from guard per lessons.md | Plan |
| FR-020 edit view | Minimal all-exercises list | PRD must-have; no pencil mockup — shape from stitch F3 | Plan |
| `started_at` trigger | On "Begin Workout" tap | Clear intent; matches mockup Screen 1 CTA; trainer edit gate already uses `started_at` | Plan |
| OK toggle | Required — marks set complete | Matches mockup OK column; drives nav-menu progress dots | Plan |
| Calendar entry | Open link from day panel | Completes US-01 flow; lessons.md navigation rule | Plan |
| FR-019 hints | **Deferred** | Park on roadmap for rethink; ship prescription-only for now | Plan |
| Route shape | Single `/client/sessions/[id]` + client state | Matches trainer session pattern; mockup is one session shell | Plan |

## Scope

**In scope:** client session detail API, set-log upsert API, `started_at` on begin, session overview page, guided logging UI, exercise nav menu, minimal FR-020 edit list, calendar Open links, `set_logs` upsert constraint migration, `is_complete` column for OK toggle.

**Out of scope:** FR-019 previous-performance hints (parked), FR-018 warm-up flag (S-10), FR-021 completion marking (S-08), FR-022 24h lock UI (S-13), rest timer, trainer dashboard readout (S-07), session comments (S-09), video links, muscle-group chips (nice-to-have from mockup).

## Architecture / Approach

```
ClientCalendarHub ──Open──► /client/sessions/[id] (SSR)
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              Overview         Guided flow      Edit list
           (!started_at)    (started, logging)  (started + logs)
                    │               │               │
                    └─────── GuidedWorkoutHub (React island) ───┘
                                    │
                    GET  /api/client/sessions/[id]
                    POST /api/client/sessions/[id]/start
                    PUT  /api/client/set-logs  (upsert)
                                    │
                    src/lib/set-logs/service.ts
                    src/lib/workout-sessions/service.ts (extend)
```

Bottom-up: schema constraint → API/service → overview + calendar wiring → guided UI → nav menu + edit list.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. API + set-log service | Client session detail, start session, set upsert with ownership checks | Upsert race without unique constraint on `(session_exercise_id, set_number)` |
| 2. Overview + calendar entry | `/client/sessions/[id]` page, Screen 1, Open links from calendar | Trainer name join for "Assigned by" meta |
| 3. Guided logging UI | Screen 2 set table, autosave states, OK toggle, Prev/Next | One-handed mobile UX iteration |
| 4. Nav menu + edit list | Screen 3 sheet, FR-020 list view, mode routing | Edit vs guided mode edge cases on resume |

**Prerequisites:** S-04 (plan assignment) and S-05 (client calendar) complete; local Supabase or remote with migrations applied.

**Estimated effort:** ~3–4 implementation sessions across 4 phases.

## Open Risks & Assumptions

- `set_logs` lacks a unique constraint today — Phase 1 migration is required before autosave upserts are safe.
- FR-019 deferred means roadmap.md should be updated to park hints as a future slice (not blocking S-06).
- `is_complete` column is new — nav progress dots depend on it; warm-up flag (S-10) will extend the same row later.
- Timed exercises (`default_metric: time`) swap Reps column for duration per mockup design spec — distance metric is out of scope.

## Success Criteria (Summary)

- Client can open a session from the calendar, begin a workout, log sets with autosave, navigate exercises, and return later to edit via list view.
- `npm run lint`, `npx astro check`, `npm run build`, and `npm run test` pass.
- RLS verification script confirms client can upsert only their own session sets.
