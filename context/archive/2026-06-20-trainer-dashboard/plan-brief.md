# Trainer Dashboard — Plan Brief

> Full plan: `context/changes/trainer-dashboard/plan.md`

## What & Why

Build S-07: the trainer dashboard that proves the full async coaching loop. Trainers should see active clients, active plan context, recent logged activity, and read-only session actuals after clients log workouts.

## Starting Point

`/trainer/dashboard` is a placeholder. The app already has trainer-client assignments, invite management, plan assignment, guided client logging, and a trainer session edit route, but no cross-client dashboard service and no trainer readout of logged set actuals.

## Desired End State

The trainer dashboard becomes a useful overview surface with summary cards, recent logged activity, client summary, and setup checklist empty states. The existing session route keeps editing available before a client starts, then switches to a read-only prescribed-vs-actual review after logging begins. `/trainer/clients` becomes a richer roster with plan metadata while preserving invites and client removal.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Scope | Dashboard + richer clients roster | Matches S-07 and the selected Pencil client-roster scope without pulling in exercise-library redesign. |
| Exercise redesign | Out of scope | Pencil FR-029 is design-only relative to S-07 and would expand the slice. |
| Missed sessions | Do not surface in MVP | Avoids ambiguous status semantics before S-08 completion/cancelled work. |
| Completion labels | Derive from logs for display only | Current app writes `started_at` and `set_logs`, not reliable finished statuses. |
| Data loading | SSR aggregate service | Fits Astro SSR, keeps first render useful, and makes logic testable. |
| Session review route | Reuse existing session URL with edit/review branch | Preserves links and access checks while adding actuals review. |
| Empty states | Setup checklist | Guides invite -> template -> exercise -> schedule without new workflow automation. |
| Testing depth | Unit tests for derivation + lint/build/manual UI | Covers risky logic without adding a Supabase integration harness unless implementation adds RPCs. |

## Scope

**In scope:**

- Trainer dashboard overview at `/trainer/dashboard`
- Recent logged activity feed
- Active client and active-plan summary data
- Read-only trainer session actuals review
- Richer `/trainer/clients` roster cards
- Setup checklist and responsive desktop-first/mobile-stacked layout

**Out of scope:**

- Exercise-library modal redesign
- Missed-session feed/cards
- New persisted status enum or status migration
- Session comments implementation
- Advanced analytics, notifications, and dedicated client detail pages

## Architecture / Approach

Add a new `src/lib/trainer-dashboard/` service/readout layer that receives `trainerId` from guarded routes and returns bounded dashboard DTOs. Reuse existing workout-session services where possible, extend `src/lib/workout-sessions/service.ts` for trainer-scoped actuals, then render the dashboard and roster through thin Astro/React components.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data and readout contracts | Trainer dashboard service plus pure derivation tests | Completion semantics must not imply persisted status. |
| 2. Session actuals review | Existing session route shows edit before start and read-only actuals after start | Avoid regressing current session edit flow. |
| 3. Dashboard overview | Replaces placeholder with summary, activity, and setup states | Aggregation must stay bounded and readable. |
| 4. Clients roster refresh | Rich metadata cards while keeping invite/remove flows | Existing invite island behavior must not regress. |
| 5. Final verification | Lint/build/tests and manual responsive smoke checks | Scope creep into missed sessions or exercise redesign. |

**Prerequisites:** S-04 and S-06 remain done; no new migration is planned.

**Estimated effort:** About 4 implementation phases plus final verification; likely 2-3 focused sessions depending on UI polish.

## Open Risks & Assumptions

- The dashboard can derive useful activity from existing logs without persisting completion state.
- Recent activity can be implemented with a small number of bounded Supabase queries; a DB RPC should be avoided unless batching becomes unwieldy.
- Session comments remain deferred to S-09 despite FR-028 wording.
- Removed clients stay hidden from dashboard and roster.

## Success Criteria (Summary)

- Trainer sees useful dashboard content or setup guidance instead of a placeholder.
- Logged client sessions are visible from the dashboard and open into a read-only actuals review.
- `/trainer/clients` shows richer client/plan metadata without breaking invites, copy link, calendar navigation, or remove-client behavior.
