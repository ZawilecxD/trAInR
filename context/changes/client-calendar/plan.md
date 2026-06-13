# Client Calendar (S-05) Implementation Plan

## Overview

Build the client-facing calendar (S-05): a read-only, mobile-first view at `/client/plan` where a client sees their own assigned workout sessions in a **month view (default)** and a **week view** (FR-013), with sessions **visually distinguished by status** (FR-014). Sessions are view-only in this slice — there is no session navigation yet because guided workout logging (S-06) is not built. Status colouring is applied to the **shared** `PlanCalendar` so both the client and the trainer benefit.

## Current State Analysis

The data layer and most UI already exist from S-04 (plan-assignment); the client side is a placeholder.

- **Data + RLS ready, no migration needed.** `workout_sessions` (migration `20260526120400`) carries `scheduled_date`, `status` (`session_status` enum: `not_started` / `finished` / `finished_partially`), `name`, `client_plan_id`. RLS policy `workout_sessions_select_via_plan` already lets an authenticated client SELECT their own sessions through `can_access_client_plan()` (which matches `client_plans.client_id = auth.uid()`).
- **Service layer is trainer-scoped.** `listSessionsForClient(supabase, trainerId, clientId, from, to)` (`src/lib/workout-sessions/service.ts:72`) looks up the active plan **by `trainer_id`** — unusable for a client self-fetch. `SessionListItem` (`service.ts:5`) = `{ id, name, scheduled_date, status, source_template_id }` is exactly the calendar's shape.
- **Only a trainer guard exists.** `requireTrainer` (`src/lib/api/guards.ts:6`); there is **no** `requireClient`. The sessions API (`src/pages/api/workout-sessions/index.ts`) is trainer-only and takes a `client_id` query param.
- **Calendar UI is reusable but trainer-shaped.** `ClientPlanHub.tsx` (`src/components/plans/ClientPlanHub.tsx`) has the month-nav + day-panel + status-badge pattern, but carries Add/Edit/Delete CTAs, a `TemplatePickerModal`, refetch against `/api/workout-sessions?client_id=`, and links to the trainer session editor. `PlanCalendar.tsx` renders a **single purple dot** for any session regardless of status (`PlanCalendar.tsx:54–60`). Status colour map already exists at `ClientPlanHub.tsx:32–40`.
- **Calendar day buttons are 40px** (`size-10`, `PlanCalendar.tsx:66` and `calendar.tsx:35`) — below the WCAG 2.5.5 44px touch-target minimum; mobile is a core NFR.
- **Client surface is a placeholder.** `src/pages/client/dashboard.astro` is the only client page ("…calendar will appear here in a future update"). `clientNav` in `Topbar.astro:33` has only Dashboard. `/client/*` is already role-guarded in `src/middleware.ts:39–49`.
- **SSR-first fetch is idiomatic.** Trainer `plan.astro` (`src/pages/trainer/clients/[clientId]/plan.astro:38`) SSR-loads the first month and hydrates the island, which then refetches on month change. `date-fns` v4 is installed but unused.

### Key Discoveries:

- RLS already isolates client reads — `src/lib/workout-sessions/service.ts:95–101` style query scoped to the client's own plan + date range is sufficient; no new policy. (Confirmed by existing `tests/integration/rls/workout-sessions.test.ts`.)
- `SessionListItem` and `PlanCalendarSession` (`PlanCalendar.tsx:6`) are structurally compatible — no new DTO needed.
- `listSessionsQuerySchema` (`src/lib/workout-sessions/schemas.ts:45`) is the template for a client variant minus `client_id`.
- Lessons.md "Plan navigation for new user-facing routes" → the Topbar link, dashboard entry point, and reachability ship **in the same phase** as the page (Phase 3), not deferred.
- Lessons.md "Deliver copy-paste Supabase Studio SQL" → Phase 1 ships an RLS verification script using `set local role authenticated` + transaction-scoped `request.jwt.claim.sub`.

## Desired End State

A logged-in client clicks **My Plan** in the topbar and lands on `/client/plan`. They see the current month with their sessions marked by a single status-coloured dot (priority: `not_started` > `finished_partially` > `finished`); days without a session simply have no dot. Selecting a day reveals that day's sessions (name + status badge) in a panel — view-only, no edit affordances. They can toggle to a **week view** that lists each day of the selected week with its session cards inline. Month and week navigation refetch via a client-guarded API route. When the visible range has no sessions, a single friendly empty message is shown (no separate "no plan" handling). The whole experience is usable one-handed on a phone in portrait. The trainer's existing calendar now also shows status-coloured dots.

Verified by: `npm run lint`, `npx astro check`, `npm run build`, `npm run test` all pass; the RLS verification script confirms a client reads only their own sessions; and manual UX checks on desktop + mobile widths.

## What We're NOT Doing

- **No session navigation / detail / logging** — tapping a session does not navigate anywhere; it shows detail in the day panel only. Guided workout logging is S-06.
- **No new DB migration** — read access already exists via RLS.
- **No write operations** for the client (no add/edit/delete/reschedule).
- **No trainer-calendar behavioural changes** beyond the shared status-dot colouring (the trainer day panel already shows status badges).
- **No multi-dot or count-badge** day rendering — single priority-coloured dot only.
- **No new `session_status` values or status transitions.**

## Implementation Approach

Bottom-up: lock down the client read path (service + guard + route + RLS proof) first, then enhance the shared calendar (status dots + touch targets) so the visual contract is settled, then assemble the month-view page with full reachability, and finally layer the week view on top. Each phase is independently shippable and testable; after Phase 3 the client already has a working, reachable month calendar.

## Critical Implementation Details

- **Client self-scoping must not trust any caller-supplied id.** `listMySessionsAsClient` derives the plan strictly from `client_plans.client_id = auth.uid()` (via the session-bound SSR/route Supabase client). No `clientId`/`trainerId` parameter is accepted, so a client cannot read another client's sessions even if RLS were misconfigured — defense in depth.
- **User experience spec (mobile, FR-013):**
  - _Month view_ — single column on `<lg`: month grid on top, selected-day panel stacked below; two columns (`lg:grid-cols-[minmax(0,22rem)_1fr]`) on `lg+`. Mirrors `ClientPlanHub`'s responsive grid.
  - _Week view_ — no separate day panel; it is a full-width vertical agenda of the 7 days (Mon–Sun) of the selected week, each day a section with its status-coloured session cards inline; empty days render a slim "Rest day" row. Same vertical layout at all breakpoints for parity and test simplicity.
  - The **Month | Week** toggle plus period label and prev/next navigation sit at the top of the page in both modes.
- **Touch targets** — bump calendar `day_button` to `size-11` (44px) and align `--cell-size`/`weekday` widths so the grid stays aligned.

## Phase 1: Client session read path

### Overview

Add a client self-scoped service function, a `requireClient` API guard, a client list-query schema, and a `GET /api/client/sessions` route — plus an RLS verification script proving isolation. No UI yet.

### Changes Required:

#### 1. Client self-fetch service function

**File**: `src/lib/workout-sessions/service.ts`

**Intent**: Add `listMySessionsAsClient` returning the caller's own sessions in a date range, with no trainer/client id parameters (identity comes from the authenticated Supabase client). Reuse `SessionListItem` and the existing query shape.

**Contract**: `listMySessionsAsClient(supabase: SupabaseClient, from: string, to: string): Promise<{ data: SessionListItem[] | null; error: string | null }>`. Resolve the active plan via `client_plans` filtered by `client_id = auth.uid()` + `status = 'active'` (`maybeSingle`); if absent, return `{ data: [], error: null }`. Then select `id, name, scheduled_date, status, source_template_id` from `workout_sessions` where `client_plan_id` matches and `scheduled_date` between `from`/`to`, ordered ascending. Mirrors `listSessionsForClient` (`service.ts:72–110`) minus the trainer lookup.

#### 2. `requireClient` guard

**File**: `src/lib/api/guards.ts`

**Intent**: Add a client-role guard mirroring `requireTrainer` so client API routes have a single auth/role choke point.

**Contract**: `requireClient(context: APIContext): ClientGuardResult` where the result mirrors `TrainerGuardResult` (`{ ok: true; userId } | { ok: false; response }`). 401 if no user, 403 if `role !== "client"`.

#### 3. Client list-query schema

**File**: `src/lib/workout-sessions/schemas.ts`

**Intent**: Add a query schema for the client route — same `from`/`to` validation and ≤366-day range guard as `listSessionsQuerySchema`, but **no `client_id`** field.

**Contract**: `clientSessionsQuerySchema` validating `{ from, to }` (ISO `YYYY-MM-DD`, `from <= to`, range ≤ 366 days); export `ClientSessionsQuery` type.

#### 4. `GET /api/client/sessions` route

**File**: `src/pages/api/client/sessions.ts` (new)

**Intent**: Client-guarded endpoint returning the caller's sessions for a date range, used by the island for month/week navigation refetch. SSR initial load calls the service directly, not this route.

**Contract**: `export const prerender = false;` + `export const GET`. Use `requireClient`; parse `from`/`to` with `clientSessionsQuerySchema` (validation_error 400 via `formatZodIssues`); build the SSR Supabase client; call `listMySessionsAsClient`; return `jsonResponse({ sessions })` or `jsonError("list_failed", 500, …)`. Follows the structure of `src/pages/api/workout-sessions/index.ts` GET, minus the `client_id`/assignment check.

#### 5. RLS verification script

**File**: `context/changes/client-calendar/verification.sql` (new)

**Intent**: Prove a client reads only their own sessions and gets nothing for another client's plan, per lessons.md.

**Contract**: A single copy-paste Supabase Studio script: `begin; set local role authenticated;` set `request.jwt.claim.sub` to a seeded client uuid; `select auth.uid()` sanity check; assert the client sees their own `workout_sessions` rows in range and zero rows scoped to a different client's plan; pass/fail expectation comments per query; `rollback;` at the end. Reuse uuids from dev seed users.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test` (new `requireClient` guard test in `src/lib/api/guards.test.ts`; new `clientSessionsQuerySchema` cases in `src/lib/workout-sessions/schemas.test.ts`)
- Build passes: `npm run build`

#### Manual Verification:

- Running `context/changes/client-calendar/verification.sql` in Supabase Studio confirms a client sees only their own sessions and zero rows for another client's plan.
- `GET /api/client/sessions?from=&to=` returns 200 + own sessions when called as a client, 403 as a trainer, 401 when signed out.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Shared status-coloured dots + touch targets

### Overview

Replace `PlanCalendar`'s single purple dot with a single priority-coloured dot driven by session status, and bump calendar touch targets to 44px. Benefits both trainer and client calendars (FR-014 "visible to both").

### Changes Required:

#### 1. Status-priority dot in `PlanCalendar`

**File**: `src/components/plans/PlanCalendar.tsx`

**Intent**: Compute, per day, the highest-priority status among that day's sessions (`not_started` > `finished_partially` > `finished`) and colour the day's single dot accordingly, replacing the status-agnostic `hasSession` modifier. Keep the existing props contract so trainer and client callers are unaffected.

**Contract**: Derive three date arrays (one per status bucket, each day assigned to its highest-priority bucket) and pass `modifiers` + `modifiersClassNames` keyed `sessionNotStarted` / `sessionPartial` / `sessionFinished`, each with the corresponding dot colour aligned to the status palette in `ClientPlanHub.tsx:32–40` (blue / amber / emerald). A day appears in exactly one bucket. No prop changes.

#### 2. 44px touch targets

**File**: `src/components/ui/calendar.tsx`, `src/components/plans/PlanCalendar.tsx`

**Intent**: Raise `day_button` from `size-10` to `size-11` (44px) and align `--cell-size` / `weekday` widths so the grid stays aligned on mobile.

**Contract**: `day_button: size-11`; weekday cell width and `--cell-size` updated to match; verify month grid alignment unchanged.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Trainer plan page (`/trainer/clients/[clientId]/plan`) shows status-coloured dots; days with mixed statuses show the highest-priority colour; trainer add/edit/delete still works.
- Day buttons measure ≥44px; grid alignment is correct on a phone-width viewport.

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 3: Client calendar page — month view

### Overview

Assemble the client month-view experience: SSR page, a read-only `ClientCalendarHub` island, distinct empty states, and full reachability (topbar nav + dashboard entry point). Delivers a working, reachable month calendar.

### Changes Required:

#### 1. Read-only client calendar island

**File**: `src/components/plans/ClientCalendarHub.tsx` (new)

**Intent**: A read-only fork of `ClientPlanHub`'s month-nav + day-panel pattern with all trainer affordances removed: no Add/Edit/Delete, no `TemplatePickerModal`, no editor links. The day panel lists the selected day's sessions as view-only cards (name + status badge, reusing `statusLabel` / `statusBadgeClass`). Month navigation refetches via `GET /api/client/sessions` (Phase 1). Surface fetch errors (inherit S-04's fixed error-surfacing pattern, not silent absorption).

**Contract**: Props `{ initialSessions: PlanCalendarSession[]; initialSelectedDate: string; initialMonth: string }`. Uses `PlanCalendar` for the month grid; refetch helper hits `/api/client/sessions?from=&to=` (no `client_id`). Two-column layout on `lg+`, stacked on mobile (mirror `ClientPlanHub.tsx:112`). Day-panel cards are non-interactive (no `href`). Extract any reused hook logic to `src/components/hooks/` if it grows beyond local state.

#### 2. Empty state (single, no plan/sessions distinction)

**File**: `src/components/plans/ClientCalendarHub.tsx`

**Intent**: When the visible range has no sessions, show one friendly empty message (e.g. "No sessions yet — your trainer will add them"). No separate "no plan" vs "plan-but-empty" handling. Days without a session render no dot (already the default — `PlanCalendar` only marks days that have sessions).

**Contract**: Branch only on `sessions.length`; the calendar grid always renders. Copy aligned with the friendly tone of `ClientPlanHub`'s existing empty messages.

#### 3. SSR client calendar page

**File**: `src/pages/client/plan.astro` (new)

**Intent**: Server-rendered shell that resolves the user, reads an optional `?date=` param, SSR-loads the initial month's sessions via `listMySessionsAsClient`, and hydrates `ClientCalendarHub`. Role is already enforced by middleware; redirect to `/client/dashboard` if the Supabase client/user is unavailable.

**Contract**: `prerender` defaults (SSR). Mirror `plan.astro:29–44` for date parsing + `monthRange` + initial fetch, minus trainer/assignment logic. Surface a load-error banner on service error (same pattern as trainer `plan.astro:60`).

#### 4. Topbar nav + dashboard entry point

**File**: `src/components/Topbar.astro`, `src/pages/client/dashboard.astro`

**Intent**: Make the page reachable (lessons.md). Add `{ href: "/client/plan", label: "My Plan" }` to `clientNav`; update the dashboard placeholder copy and add a link/CTA to the calendar.

**Contract**: `clientNav` gains the My Plan entry (active-state highlighting already handled by `isActive`). Dashboard placeholder text replaced with a short message + link to `/client/plan`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- A client signs in, sees "My Plan" in the topbar, opens `/client/plan`, and sees the current month with status-coloured dots for their sessions.
- Selecting a day shows that day's sessions (name + status) in the panel; no edit/add controls anywhere; tapping a session does nothing destructive (view-only).
- Month navigation loads adjacent months (network refetch) and surfaces an error message on failure.
- A client with no sessions in the visible month sees a single friendly empty message; the grid still renders; days without sessions show no dot.
- Layout is usable one-handed on a phone-width viewport (calendar on top, panel below).

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 4: Week view toggle

### Overview

Add the Month | Week toggle and a custom 7-day week-view agenda using `date-fns`, satisfying FR-013's "switch to week view".

### Changes Required:

#### 1. Week-view agenda component

**File**: `src/components/plans/ClientWeekView.tsx` (new)

**Intent**: A full-width vertical agenda of the selected week's 7 days (Mon–Sun). Each day is a section with a date heading and its sessions as status-coloured cards inline; empty days show a slim "Rest day" row. No separate day panel. Uses `date-fns` (`startOfWeek` with Monday start, `addDays`, `format`) for week boundaries.

**Contract**: Props `{ sessions: PlanCalendarSession[]; weekStart: Date }`. Groups sessions by `scheduled_date` across the 7-day span; renders cards with `statusLabel`/`statusBadgeClass`. Same vertical layout at all breakpoints. Cards are non-interactive (view-only, consistent with Phase 3).

#### 2. Month/Week toggle + week navigation in the hub

**File**: `src/components/plans/ClientCalendarHub.tsx`

**Intent**: Add a `view: "month" | "week"` toggle at the top. In month mode, render the existing calendar+panel. In week mode, render `ClientWeekView` with prev/next-week navigation and a week-range label, refetching the visible 7-day (or month-spanning) range via the Phase 1 route. Switching views preserves the selected date/week.

**Contract**: Local `view` state (default `"month"`); week nav computes a `date-fns` week range and refetches `/api/client/sessions?from=&to=`. Toggle is keyboard-accessible and ≥44px touch target.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test` (if week-grouping helper is extracted, cover its boundary cases — week start, week end, empty days)
- Build passes: `npm run build`

#### Manual Verification:

- Toggling Month → Week shows the selected week as a vertical agenda; each day lists its sessions; empty days show "Rest day".
- Prev/next-week navigation refetches and updates the agenda; the week-range label is correct (Monday-start).
- Status colours in week cards match the month dots.
- Week view is readable and scrollable one-handed on a phone-width viewport.
- Toggling back to Month preserves context (selected date/month).

**Implementation Note**: Final phase — confirm the full month + week experience end to end.

---

## Testing Strategy

### Unit Tests:

- `requireClient` guard: 401 (no user), 403 (trainer role), ok (client role) — `src/lib/api/guards.test.ts`.
- `clientSessionsQuerySchema`: valid range, `from > to` rejected, >366-day range rejected, malformed dates rejected — `src/lib/workout-sessions/schemas.test.ts`.
- Week-grouping helper (if extracted): sessions placed in correct day buckets across week boundaries; empty days produce empty buckets.

### Integration Tests:

- Existing `tests/integration/rls/workout-sessions.test.ts` already asserts client SELECT isolation; confirm it still passes and add a case exercising the `listMySessionsAsClient` query path if a gap exists (`npm run test:integration`, requires local Supabase).

### Manual Testing Steps:

1. As a client with assigned sessions: open `/client/plan`, verify month dots are status-coloured (priority colour on mixed-status days), select days, read the panel.
2. Toggle to week view; navigate weeks; verify agenda + "Rest day" rows + colour parity.
3. As a client with no sessions this month: verify the single friendly empty message and that empty days show no dot.
4. Run `verification.sql` in Supabase Studio; confirm isolation.
5. Hit `/api/client/sessions` as trainer (403) and signed-out (401).
6. Re-test the trainer plan page to confirm no regressions from the shared dot/touch-target change.
7. Repeat 1–3 at a phone-width viewport (portrait) for one-handed usability.

## Performance Considerations

Reads are a single indexed range query per visible month/week scoped to one plan — negligible load. Month/week navigation refetches only the visible range (≤366-day guard prevents abuse). SSR initial load avoids a client round-trip on first paint.

## Migration Notes

None — no schema changes. Read access already provided by existing RLS (`workout_sessions_select_via_plan`).

## References

- Research: `context/changes/client-calendar/research.md`
- Trainer SSR + island pattern: `src/pages/trainer/clients/[clientId]/plan.astro:38`
- Island to fork: `src/components/plans/ClientPlanHub.tsx` (status map `:32–40`, layout `:112`)
- Shared calendar: `src/components/plans/PlanCalendar.tsx:54–60`, `src/components/ui/calendar.tsx:35`
- Service to mirror: `src/lib/workout-sessions/service.ts:72–110`
- Guard to mirror: `src/lib/api/guards.ts:6`
- Query schema to mirror: `src/lib/workout-sessions/schemas.ts:45`
- Client route guard target: `src/middleware.ts:39–49`
- Lessons: `context/foundation/lessons.md` (nav for new routes; copy-paste Studio SQL)
- S-04 reuse intent: `context/archive/2026-06-08-plan-assignment/plan-brief.md:15`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Client session read path

#### Automated

- [x] 1.1 Type checking passes: `npx astro check` — 8741e5b
- [x] 1.2 Linting passes: `npm run lint` — a77b64e
- [x] 1.3 Unit tests pass: `npm run test` (requireClient guard + clientSessionsQuerySchema) — a77b64e
- [x] 1.4 Build passes: `npm run build` — a77b64e

#### Manual

- [x] 1.5 verification.sql confirms client reads only own sessions, zero for other client's plan — a77b64e
- [x] 1.6 `GET /api/client/sessions` returns 200 (client), 403 (trainer), 401 (signed out) — a77b64e

### Phase 2: Shared status-coloured dots + touch targets

#### Automated

- [x] 2.1 Type checking passes: `npx astro check` — ec64a54
- [x] 2.2 Linting passes: `npm run lint` — ec64a54
- [x] 2.3 Build passes: `npm run build` — ec64a54

#### Manual

- [x] 2.4 Trainer calendar shows status-coloured dots (priority on mixed days); trainer CRUD unaffected — ec64a54
- [x] 2.5 Day buttons ≥44px and grid alignment correct on phone width — ec64a54

### Phase 3: Client calendar page — month view

#### Automated

- [x] 3.1 Type checking passes: `npx astro check`
- [x] 3.2 Linting passes: `npm run lint`
- [x] 3.3 Build passes: `npm run build`

#### Manual

- [x] 3.4 Client sees "My Plan" nav, opens /client/plan, sees current month with status dots
- [x] 3.5 Day selection shows view-only session list; no add/edit/delete anywhere
- [x] 3.6 Month navigation refetches; error surfaces on failure
- [x] 3.7 Empty month shows a single friendly message; grid still renders; empty days show no dot
- [x] 3.8 Month view usable one-handed on phone-width viewport

### Phase 4: Week view toggle

#### Automated

- [ ] 4.1 Type checking passes: `npx astro check`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Unit tests pass: `npm run test` (week-grouping boundaries, if extracted)
- [ ] 4.4 Build passes: `npm run build`

#### Manual

- [ ] 4.5 Month→Week toggle shows selected week as vertical agenda with per-day sessions + "Rest day" rows
- [ ] 4.6 Prev/next-week navigation refetches and updates correctly (Monday-start label)
- [ ] 4.7 Week-card status colours match month dots
- [ ] 4.8 Week view readable/scrollable one-handed on phone width; toggling back preserves context
