# Plan Assignment (S-04) — Plan Brief

> Full plan: `context/changes/plan-assignment/plan.md`

## What & Why

Trainers need to place workout sessions on specific days of a client's calendar — from a template or from scratch — and personalize exercises before the client sees them (FR-012). This is the core "assign a plan" step that unlocks the client calendar (S-05), guided logging (S-06), and trainer dashboard (S-07).

## Starting Point

S-02 session templates and S-14 per-round prescription are fully built (DB, API, `TemplateForm`). S-03 client onboarding delivers an active client roster. DB tables for `client_plans`, `workout_sessions`, and flat `session_exercises` exist with RLS, but **no app code** creates or displays assigned sessions. `session_exercise_sets` was deferred from S-14 and must land here.

## Desired End State

From `/trainer/clients`, the trainer opens a client's plan view with a **month-grid calendar**, adds sessions on chosen days (template or blank), personalizes in a pre-save editor, and saves an atomic snapshot. Sessions can be edited until the client starts them. Multiple sessions per day are supported. The calendar component is built for trainer use now and reused (with role-specific actions) for the client calendar in S-05.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Entry point | Per-client drill-down from Clients list | Matches "pick client → pick day" mental model; reuses existing roster | Plan |
| Plan container | Auto-create active plan on first assignment | Minimizes friction toward PRD "first plan in 10 minutes" goal | Plan |
| Trainer calendar UX | Month grid now (shared base for S-05) | User chose full calendar over date-picker-only; enables reuse on client side | Plan |
| Creation paths | Template picker + blank session equally | FR-012 requires both paths with equal visibility | Plan |
| Personalization | Edit before first save (clone → personalize → save) | One-shot snapshot after review; matches FR-012 move/remove/edit | Plan |
| Post-assign edits | Allowed until client starts session | Fixes mistakes without delete/recreate; uses `started_at` gate | Plan |
| Persistence | SECURITY DEFINER RPC for create/update snapshot | Atomic multi-table insert; avoids partial snapshots | Plan |
| Same-day sessions | Multiple allowed | Supports split sessions; no artificial DB constraint | Plan |
| Phasing | 4 phases: schema → RPC/API → UI → tests | Delivers testable API before largest UI phase | Plan |

## Scope

**In scope:** `session_exercise_sets` migration + RLS; types + ERD update; `ensure_active_client_plan`, `create_workout_session`, `update_workout_session_snapshot`, `delete_workout_session` RPCs; REST API; trainer month calendar + per-client plan page; `SessionForm` + template picker; clients list navigation; integration + unit tests; Studio verification SQL.

**Out of scope:** Client calendar polish (S-05), guided logging (S-06), trainer dashboard (S-07), session comments, plan archive/rename UI, bulk assign, drag-and-drop, `locked_at` enforcement, notifications.

## Architecture / Approach

Bottom-up in four phases: (1) align session schema with S-14 per-round model, (2) atomic RPCs + thin API mirroring session-templates conventions, (3) trainer UI with reusable `PlanCalendar` island and `SessionForm` forked from `TemplateForm`, (4) tests + RLS hardening. Data flow: Astro SSR loads month sessions → trainer picks day/template → React editor submits full exercise payload → RPC writes plan (if needed) + session + exercises + sets in one transaction.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Data model & migration | `session_exercise_sets`, drop flat cols, RLS, types, ERD | Existing RLS tests break until Phase 4 updates seeds |
| 2. RPC + API layer | Atomic create/update/delete + REST routes + zod | RPC JSON parsing and exercise ownership validation must be bulletproof |
| 3. Trainer calendar & assignment UI | Month grid, plan page, SessionForm, nav from Clients | Largest phase — calendar + editor + wiring |
| 4. Testing & hardening | Integration/unit tests, verification SQL, policy gaps | Test seed helpers need nested sets refactor |

**Prerequisites:** S-02 and S-03 complete (they are). Local Supabase; `npx supabase db reset` available.
**Estimated effort:** ~3–4 focused sessions across 4 phases.

## Open Risks & Assumptions

- Template zod still rejects negative load while session schemas will allow it — minor inconsistency until template alignment follow-up.
- Month calendar built for trainer may need UX adjustments when adapted for read-only client view in S-05.
- No production assigned-session data exists; migration backfill is defensive only.

## Success Criteria (Summary)

- Trainer assigns and personalizes a template session on a client's calendar; session persists with per-round prescription intact.
- Trainer creates, edits, and deletes not_started sessions; edit blocked after client starts.
- Cross-trainer isolation holds on new table and RPCs; lint, build, and integration tests green.
