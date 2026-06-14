---
date: 2026-06-13T10:14:00+02:00
researcher: AI agent
git_commit: a3be900184a1435305c44ad76fe7626aeff15f1f
branch: zaw-10-client-calendar-monthweek-view-with-status-colors
repository: trAInR
topic: "Client calendar view (S-05) — implementation readiness"
tags: [research, codebase, client-calendar, workout-sessions, plan-calendar, rls]
status: complete
last_updated: 2026-06-13
last_updated_by: AI agent
---

# Research: Client Calendar View (S-05)

**Date**: 2026-06-13T10:14:00+02:00
**Researcher**: AI agent
**Git Commit**: `a3be900`
**Branch**: `zaw-10-client-calendar-monthweek-view-with-status-colors`
**Repository**: ZawilecxD/trAInR

## Research Question

What does the codebase already provide for `client-calendar` (S-05), what must still be built, and what are the key integration points, risks, and constraints?

## Summary

S-05 is well-positioned to ship quickly. S-04 delivered the complete data layer (`workout_sessions` + RLS allowing client SELECT), reusable React islands (`PlanCalendar`, `ClientPlanHub`), and status badge styling. The client-facing side is a thin shell today — one placeholder Astro page with no calendar, no data path, and no navigation entry point. S-05 needs: (1) a new `/client/plan` Astro page doing SSR session fetch, (2) a read-only `ClientCalendarHub` React island adapted from `ClientPlanHub`, (3) a new client-auth-guarded service function to list own sessions, and (4) a week-view toggle (FR-013) — the only net-new UI capability not already in the codebase. Status colour coding (FR-014) is already defined; the month-dot just needs to become status-coloured.

---

## Detailed Findings

### 1. Requirements (FR-013, FR-014)

From `context/foundation/prd.md` lines 108–113:

- **FR-013 (must-have):** Client can view their assigned plan in a **month view (default)** with ability to switch to **week view**.
- **FR-014 (must-have):** Sessions visually distinguished by status: `not_started` / `finished` / `finished_partially`, visible to both client and trainer.

User story US-01 acceptance criterion: "Session appears in the client's calendar with 'not started' status."

Mobile NFR: "The app is fully functional on a phone at the gym. All primary client interactions … are usable on a standard phone screen in portrait orientation." No native app; web-only responsive.

Roadmap risk: "Calendar UX on mobile (month + week toggle in a phone browser) may need more iteration than expected to feel usable one-handed."

### 2. Data model — ready, no migrations needed

`workout_sessions` table (migration `20260526120400`, live):

| Column | Type | Relevant to calendar |
|---|---|---|
| `id` | uuid | Session chip key / navigation target |
| `client_plan_id` | uuid FK | Plan scoping for RLS |
| `source_template_id` | uuid nullable | Template origin (optional display) |
| `scheduled_date` | `date` | Calendar placement |
| `name` | text nullable | Session label |
| `status` | `session_status` enum | Colour coding |
| `started_at` | timestamptz | Future "in progress" gate |
| `completed_at` | timestamptz | Completion timestamp |

Status enum values: `'not_started'`, `'finished'`, `'finished_partially'`.

TypeScript: `SessionStatus` in `src/types.ts:122`; `WorkoutSession` interface at `src/types.ts:124–136`.

**RLS already covers clients:** `workout_sessions_select_via_plan` allows SELECT for any authenticated user passing `can_access_client_plan()`, which includes `client_plans.client_id = auth.uid()`. No new migrations required for read access.

### 3. Service layer — needs one new function

Existing `src/lib/workout-sessions/service.ts`:

- `listSessionsForClient(supabase, trainerId, clientId, from, to)` — **trainer-scoped**: first looks up the active plan by `trainer_id`. Cannot be called for client self-fetch (no trainer ID available).
- `getSessionWithExercises` — fine for future session detail (S-06).
- `SessionListItem` type: `{ id, name, scheduled_date, status, source_template_id }` — exactly what the calendar needs.

**Gap:** No `listMySessionsAsClient(supabase, from, to)` variant. Must be added: skip the trainer lookup, query `client_plans` by `client_id = auth.uid()`, then `workout_sessions` in date range. RLS enforces isolation automatically.

No new API route is strictly required — the SSR Astro page can call the service directly with the server-side Supabase client (same pattern as `plan.astro` lines 38–40).

### 4. Existing UI components — nearly all reusable

#### `PlanCalendar.tsx` — `src/components/plans/PlanCalendar.tsx`

Month grid wrapping `shadcn/ui Calendar` (which wraps `react-day-picker` v9). Props contract:

```typescript
export interface PlanCalendarSession {
  id: string;
  scheduled_date: string;
  name: string;
  status: SessionStatus;
}
```

Current limitation: uses a **single purple dot** for all sessions regardless of status. S-05 needs per-status colour on the dot (FR-014). This requires adding status-based `modifiers` / `modifiersClassNames` — a small change to `PlanCalendar`.

Touch target note from ui-redesign research (`context/changes/ui-redesign/research.md:178`): calendar day buttons are `size-10` (40px) — below WCAG 2.5.5 44px minimum. Worth addressing for mobile.

#### `ClientPlanHub.tsx` — `src/components/plans/ClientPlanHub.tsx`

Full-featured trainer island: month navigation, day panel, "Add session" CTA, template picker, edit/delete links. Status badges already defined:

```typescript
// src/components/plans/ClientPlanHub.tsx:32–40
case "not_started": return "border-blue-400/40 bg-blue-500/20 text-blue-100";
case "finished":    return "border-emerald-400/40 bg-emerald-500/20 text-emerald-100";
case "finished_partially": return "border-amber-400/40 bg-amber-500/20 text-amber-100";
```

S-05 should create a **new `ClientCalendarHub.tsx`** (or thin read-only wrapper) — same month navigation + day panel pattern, but: no Add/Edit/Delete CTAs; session click → navigate to guided workout (S-06 route, TBD) instead of trainer editor.

S-04 plan explicitly anticipated this (`context/archive/2026-06-08-plan-assignment/plan.md:72`): "Build `ClientPlanCalendar` (or similar) accepting `role="trainer"|"client"` prop or separate thin wrappers."

#### `Calendar` (shadcn) — `src/components/ui/calendar.tsx`

Wraps `DayPicker` from `react-day-picker` v9. Month-only mode today. **Week view not built.** `react-day-picker` v9 supports week display via `mode="single"` with custom rendering — needs a custom implementation or a `numberOfMonths`-style layout showing 7 days.

#### Date helpers — `src/lib/dates.ts`

`monthRange(date)` → `{ from, to }` (ISO strings). Used for API range queries. Works as-is for client calendar.

### 5. Client pages — currently minimal

`src/pages/client/dashboard.astro` is the **only client page**. It is a static placeholder with literal copy: "Workout plans and your training calendar will appear here in a future update."

No `/client/plan`, `/client/calendar`, or session detail pages exist.

Middleware (`src/middleware.ts:6–8`): `/client/*` routes require `role === "client"` — correct guard is in place; new pages just need to live under `src/pages/client/`.

### 6. Navigation — client topbar has only Dashboard

`src/components/Topbar.astro:33`:

```typescript
const clientNav: NavItem[] = [{ href: "/client/dashboard", label: "Dashboard" }];
```

A "Calendar" or "My Plan" nav link must be added. Lesson from `context/foundation/lessons.md` ("Plan navigation for new user-facing routes"): **include nav entry points in the same phase** — do not defer to follow-up.

### 7. Week view — net-new UI work

`react-day-picker` v9 does not have a built-in "week view" mode. Options:
- **Custom week grid** using `date-fns` helpers (`date-fns` v4 is already installed but unused) — render 7 day columns for the selected week, sessions as full-height cards.
- **`numberOfMonths=1` + custom week highlight** — simpler but not a true week view.
- A fully custom React component showing Mon–Sun with session cards per day.

The month/week toggle is a UI-state concern (a `useState` or URL param). Data fetch can use the same `monthRange` or a narrower 7-day range.

### 8. No client session API routes yet

All `/api/workout-sessions/*` routes use `requireTrainer`. S-05 client data fetch should go through SSR (Supabase server client with cookie session → RLS enforces `client_id = auth.uid()`), not new API routes, to keep it simple. If client-side refetch on month navigation is needed (like `ClientPlanHub` uses), a new `GET /api/client/sessions?from=&to=` route guarded by `requireClient` would be needed. This pattern mirrors the trainer route but without `client_id` param (inferred from `auth.uid()`).

---

## Code References

- `src/types.ts:122` — `SessionStatus` type
- `src/types.ts:124–136` — `WorkoutSession` interface
- `src/lib/workout-sessions/service.ts:5–6` — `SessionListItem` type
- `src/lib/workout-sessions/service.ts:79–101` — `listSessionsForClient` (trainer-scoped; adapt for client)
- `src/lib/client-plans/service.ts` — `getActivePlanForClient`
- `src/lib/dates.ts` — `monthRange`, `toLocalISODate`, `parseISODate`
- `src/components/plans/PlanCalendar.tsx` — month grid island; `PlanCalendarSession` interface
- `src/components/plans/ClientPlanHub.tsx:32–40` — status badge colour map (reuse verbatim)
- `src/components/plans/ClientPlanHub.tsx:112–197` — two-column layout pattern
- `src/components/ui/calendar.tsx` — shadcn Calendar (react-day-picker v9 wrapper)
- `src/pages/client/dashboard.astro` — only client page; placeholder copy to update
- `src/components/Topbar.astro:33` — client nav items (add Calendar link here)
- `src/middleware.ts:6–8` — `/client/*` role guard (already in place)
- `supabase/migrations/20260526120400_sessions_logging_comments.sql:41–52` — `workout_sessions` schema
- `supabase/migrations/20260526120000_enums_profiles_helpers.sql:31–37` — `session_status` enum

---

## Architecture Insights

1. **SSR-first data fetch is idiomatic here** — `plan.astro` loads sessions server-side and passes them as props to the hydrated island. The client calendar page should do the same: SSR loads the initial month's sessions, island handles month navigation refetch via a client-guarded API route.

2. **No new migrations** — RLS already allows clients to SELECT their own sessions. The only DB work might be a SQL verification script (per lessons.md pattern).

3. **`PlanCalendar` needs one enhancement for FR-014** — replace the single `hasSession` modifier with three status-specific modifiers (`sessionNotStarted`, `sessionFinished`, `sessionPartial`) each with their own colour dot. This is a backward-compatible change that can be gated by a prop.

4. **Week view is the only genuinely new UI problem** — everything else is adaptation or removal of trainer-specific affordances. Consider building week view as a separate component to keep `PlanCalendar` (month) simple.

5. **`date-fns` is installed but unused** — this slice is a natural place to start using it for week boundary calculations (`startOfWeek`, `endOfWeek`, `addDays`, `format`).

6. **Touch targets** — existing calendar day buttons are 40px (below 44px WCAG minimum). Since mobile is a core NFR, bump `day_button` to `size-11` (44px) in `calendar.tsx` classNames.

---

## Historical Context (from prior changes)

- `context/archive/2026-06-08-plan-assignment/plan-brief.md:15` — S-04 explicitly designed the trainer calendar component to be reused by S-05: "The calendar component is built for trainer use now and reused (with role-specific actions) for the client calendar in S-05."
- `context/archive/2026-06-08-plan-assignment/plan-brief.md:56` — Risk noted: "Month calendar built for trainer may need UX adjustments when adapted for read-only client view in S-05."
- `context/archive/2026-06-08-plan-assignment/plan.md:72` — Explicit architecture intent: thin wrappers or `role` prop for calendar reuse.
- `context/archive/2026-06-08-plan-assignment/reviews/impl-review.md` — F3 (silent error absorption in month fetch) was fixed; S-05 should inherit the fixed error-surfacing pattern.
- `context/changes/ui-redesign/research.md:178` — Calendar touch target gap (40px) already identified as a fix with "high accessibility impact."

---

## Related Research

- No prior `research.md` exists for `client-calendar` (this is the first).
- Trainer calendar research is embedded in `context/archive/2026-06-08-plan-assignment/plan.md`.

---

## What S-05 Must Build (summary)

| Item | Effort | Notes |
|---|---|---|
| `src/pages/client/plan.astro` (or `/client/calendar.astro`) | Small | SSR shell; auth + role check; initial month SSR fetch; hydrate island |
| `listMySessionsAsClient(supabase, from, to)` in service | Small | Variant of `listSessionsForClient` without trainer lookup |
| `GET /api/client/sessions?from=&to=` (optional) | Small | Needed only if island does client-side month refetch |
| `ClientCalendarHub.tsx` React island | Medium | Adapt `ClientPlanHub`: remove trainer CTAs; add week/month toggle; session click → S-06 route |
| `PlanCalendar.tsx` status-colour dots | Small | Replace single purple modifier with 3 status-specific modifiers |
| Week view component | Medium | Net-new; use `date-fns` week helpers; 7-day grid with session cards |
| Topbar client nav link | Trivial | Add `{ href: "/client/plan", label: "My Plan" }` to `clientNav` |
| Touch target fix on `calendar.tsx` | Trivial | `day_button: size-11` |

## Open Questions

1. **Session click target for S-05** — FR-013/FR-014 are calendar-only. Should tapping a session in the calendar navigate to a guided workout page (S-06, not yet built) or a read-only session detail? Decision needed at plan time.
2. **Week view implementation approach** — custom grid vs react-day-picker extension. PRD says "switch to week view" but does not specify behaviour for multi-session days in week view.
3. **"No active plan" state** — what does the calendar show if the client has no active plan yet? Empty state copy + CTA? This is likely given onboarding flow.
4. **Status dot multiplicity** — if multiple sessions fall on one day with different statuses, what dot(s) appear? The trainer calendar shows a single purple dot. Month view needs a visual convention (multiple dots? highest-priority status? count badge?).
5. **FR-014 scope** — "visible to both client and trainer" for status colouring: the trainer's `ClientPlanHub` day panel already shows status badges, but `PlanCalendar` dots are status-agnostic. Should the trainer calendar also get status-coloured dots as part of this slice, or defer to S-07?
