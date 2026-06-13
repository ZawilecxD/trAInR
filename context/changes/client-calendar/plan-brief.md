# Client Calendar (S-05) — Plan Brief

> Full plan: `context/changes/client-calendar/plan.md`
> Research: `context/changes/client-calendar/research.md`

## What & Why

Build the client-facing calendar (S-05): a read-only, mobile-first view at `/client/plan` where a client sees their own assigned workout sessions in a month view (default) with a week-view toggle (FR-013), sessions visually distinguished by status (FR-014). This closes the loop on plan assignment — sessions a trainer places (S-04) finally become visible to the client.

## Starting Point

S-04 delivered the full data layer (`workout_sessions` + RLS already allowing client SELECT) and reusable UI (`PlanCalendar`, `ClientPlanHub` with a status colour map). The client side is a placeholder: one static dashboard page, a topbar with only "Dashboard", no `/client/plan`, no client read service, no `requireClient` guard, and `PlanCalendar` shows a status-agnostic purple dot.

## Desired End State

A client clicks "My Plan", lands on a month calendar with status-coloured dots (days without a session show no dot), selects a day to see that day's sessions (view-only) in a panel, and can toggle to a week agenda listing each day's sessions inline. A single friendly empty message when there are no sessions. Fully usable one-handed on a phone. The trainer's calendar also gains status-coloured dots.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Session click target | View-only in day panel, no navigation | S-06 (guided logging) isn't built; keeps S-05 calendar-only with nothing to rip out | Plan |
| Empty state | Single friendly message when no sessions; no "no plan" distinction; grid always renders | Simpler UX; days without sessions just show no dot | Plan |
| FR-014 scope | Enhance shared `PlanCalendar` for both trainer + client | Satisfies "visible to both" literally in one place, no divergence | Plan |
| Week view | Custom 7-day `date-fns` agenda with full session cards | True week view, mobile-friendly, react-day-picker v9 has no week mode | Plan |
| Mixed-status day dot | Single dot, highest-priority status | Clean and mobile-legible; day panel shows the full breakdown | Plan |
| Month nav data load | SSR initial + refetch via new `requireClient` API route | Matches trainer island pattern; adds the guard S-06/S-07 will reuse | Plan |

## Scope

**In scope:** client read service (`listMySessionsAsClient`), `requireClient` guard, `GET /api/client/sessions`, RLS verification SQL, shared status-coloured dots + 44px touch targets, `/client/plan` SSR page, read-only `ClientCalendarHub` island, month + week views, a single empty state, topbar/dashboard reachability.

**Out of scope:** session detail/navigation/logging (S-06), any client writes, DB migrations, multi-dot/count-badge day rendering, trainer-calendar behaviour changes beyond shared dots.

## Architecture / Approach

Bottom-up. Phase 1 locks the client read path (self-scoped service derived from `auth.uid()`, guard, route, RLS proof). Phase 2 settles the visual contract on the shared calendar. Phase 3 assembles a reachable month-view page (SSR loads first month → island refetches on nav). Phase 4 layers the week-view agenda + toggle. SSR-first fetch with client-side refetch mirrors the trainer `plan.astro` pattern; `date-fns` (installed, unused) powers week boundaries.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Client read path | Service fn + `requireClient` + API route + RLS script | Ensuring self-scoping never trusts a caller id |
| 2. Shared status dots + touch | Priority-coloured dots + 44px buttons (trainer + client) | Touching trainer calendar in a "client" slice |
| 3. Month-view page | `/client/plan` + island + empty state + nav | Mobile UX of calendar+panel stacking |
| 4. Week view | Month/Week toggle + custom 7-day agenda | Net-new UI; week-boundary + colour-parity correctness |

**Prerequisites:** S-04 (plan-assignment) — done; S-03 (client-onboarding) — done. Local Supabase (Docker) for integration tests + RLS script.
**Estimated effort:** ~3–4 sessions across 4 phases (Phases 1–2 small, 3 medium, 4 medium).

## Open Risks & Assumptions

- Week-view mobile usability ("one-handed at the gym") may need iteration — flagged in the roadmap risk; vertical agenda is the mitigation.
- Shared status-dot change touches the trainer calendar; Phase 2 manual verification re-tests the trainer plan page for regressions.
- Assumes a client has at most one active plan (consistent with `getActivePlanForClient`'s `maybeSingle`).

## Success Criteria (Summary)

- A client can view their assigned sessions in month and week views, with status colours, on desktop and phone.
- Clients see only their own sessions (RLS-proven); an empty month shows a clear single message.
- No regressions to the trainer calendar; lint, `astro check`, build, and unit tests pass.
