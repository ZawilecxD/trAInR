# Trainer Dashboard Implementation Plan

## Overview

Implement roadmap slice S-07: a trainer dashboard that proves the async coaching loop end-to-end by showing active clients, active plans, recent logged session activity, and a read-only session actuals review. This plan also refreshes `/trainer/clients` into the richer roster from the Pencil design while preserving the existing invite and remove-client flows.

## Current State Analysis

The trainer dashboard route exists but is a placeholder card with links only. Trainer clients, exercise library, plan assignment, guided logging, and the existing session edit/read-only route are already in place, but there is no cross-client dashboard aggregation service and no trainer-facing UI that displays logged set actuals.

## Desired End State

Trainers land on `/trainer/dashboard` and see a desktop-first overview with KPIs, active client roster summary, setup checklist empty states, and recent logged activity across active clients. From activity or roster links, trainers can open the existing session route; sessions that have not started remain editable, while sessions that have started render a read-only prescribed-vs-actual review. `/trainer/clients` becomes a wider roster with plan metadata and calendar deep-links while keeping invite generation, pending invites, and client removal intact.

### Key Discoveries:

- `src/pages/trainer/dashboard.astro:7` currently renders a placeholder dashboard, so S-07 can replace the page without preserving dashboard behavior.
- `context/foundation/roadmap.md:192` defines `trainer-dashboard` as S-07 with FR-027, FR-028, and US-01 scope.
- `src/pages/trainer/clients.astro:14` already loads active trainer-client assignments and profile names, then delegates invite and roster behavior to `InviteClientPanel`.
- `src/pages/trainer/clients/[clientId]/sessions/[sessionId].astro:99` already branches to a read-only warning once a client starts a session, but it does not show set logs.
- `src/lib/workout-sessions/service.ts:205` has `getMySessionDetail` for client readout with logs; the trainer path needs a trainer-scoped equivalent instead of reusing client identity.
- `src/lib/workout-sessions/service.ts:127` lists sessions per client only; the dashboard needs a bounded, multi-client aggregate query/service.
- `DESIGN.md:107` frames trainer views as Calm Authoring: structured, desktop-first, and low-noise.

## What We're NOT Doing

- No exercise-library modal redesign from the Pencil FR-029 screen.
- No missed-session or past-due attention feed in this slice.
- No persisted completion-status migration and no new `missed`/`cancelled` status.
- No session comments implementation; reserve space only if an existing comments surface is already available during implementation.
- No advanced analytics, adherence trends, charts, notifications, or multi-trainer/org reporting.
- No dedicated client detail page beyond `/trainer/clients` and `/trainer/clients/[clientId]/plan`.

## Implementation Approach

Build the data contracts before the UI. Add a trainer-dashboard service that receives the authenticated `trainerId`, gathers active clients, active plan metadata, and a bounded recent logged-activity feed, and derives display labels from available logs rather than persisted `workout_sessions.status`. Then update the existing session route to switch between the current editor and a new read-only actuals component. Once those contracts are stable, replace the dashboard placeholder and refresh the client roster UI.

## Critical Implementation Details

**Session status semantics** — before S-08, `workout_sessions.status` is not a reliable completion source because guided logging writes `started_at` and `set_logs`, not `finished`/`finished_partially`. The plan must derive readout labels from logs for display only and avoid writing back status.

**Authentication boundary** — service functions should receive `trainerId` from the guarded Astro route instead of re-calling `auth.getUser()`, following the accepted lesson in `context/foundation/lessons.md`.

## Phase 1: Dashboard Data And Readout Contracts

### Overview

Create the typed service and pure derivation helpers that the dashboard, roster, and session review need.

### Changes Required:

#### 1. Trainer Dashboard Service

**File**: `src/lib/trainer-dashboard/service.ts`

**Intent**: Add a server-side service that builds the trainer dashboard view for an authenticated trainer. It should return active clients, active plan metadata, recent logged activity, and summary counts in one bounded contract.

**Contract**: Export a function such as `getTrainerDashboard(supabase, trainerId, options?)` that accepts an explicit `trainerId`, scopes all reads to active trainer-client assignments, limits recent activity, and returns typed DTOs that do not expose removed clients.

#### 2. Dashboard Types And Readout Helpers

**File**: `src/lib/trainer-dashboard/readout.ts`

**Intent**: Keep status/readout derivation pure and testable. The dashboard and read-only session view should share the same labels for not logged, in progress/partial, and fully logged.

**Contract**: Export pure helpers that accept prescribed session exercise sets plus `set_logs` and return display-only readout status, completed-set counts, and per-set actual values. Do not mutate or persist `workout_sessions.status`.

#### 3. Workout Session Trainer Detail Service

**File**: `src/lib/workout-sessions/service.ts`

**Intent**: Add a trainer-scoped session detail loader that includes actual set logs, client identity, and plan ownership checks for the read-only review UI.

**Contract**: Export a function such as `getSessionDetailForTrainer(supabase, trainerId, clientId, sessionId)` that returns `null` when the session is not under the trainer's active assignment. It should include `session_exercises`, `session_exercise_sets`, `set_logs`, exercise names, and default metrics.

#### 4. Unit Tests

**File**: `src/lib/trainer-dashboard/readout.test.ts`

**Intent**: Lock the display-only derivation rules before UI work starts.

**Contract**: Cover no logs, partial logs, all prescribed sets logged, extra/missing logs, and sorting by phase/set order where relevant.

### Success Criteria:

#### Automated Verification:

- Readout unit tests pass for the new helper: `npm test -- src/lib/trainer-dashboard/readout.test.ts`
- Type-aware lint passes for touched files: `npm run lint`
- Production build still succeeds: `npm run build`

#### Manual Verification:

- Service contract can be inspected from TypeScript without ambiguous `any` shapes leaking into page code.
- Removed clients are not represented in the service output.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the data contract matches the intended dashboard language before proceeding.

---

## Phase 2: Read-Only Session Actuals Review

### Overview

Update the existing trainer session route so pre-start sessions remain editable and started/logged sessions become a useful read-only review of prescribed vs actual work.

### Changes Required:

#### 1. Session Review Component

**File**: `src/components/workout-sessions/SessionActualsReview.tsx`

**Intent**: Display the trainer-facing read-only session detail. The trainer should see exercises grouped by phase, prescribed sets, logged actuals, and derived completion labels without edit controls.

**Contract**: Accept a typed session detail DTO from the trainer detail service. Render phase groups, exercise names, set numbers, prescribed reps/duration/load/rest, logged actual reps/duration/load, completion flags, and calm empty states for unlogged sets.

#### 2. Existing Session Route Branch

**File**: `src/pages/trainer/clients/[clientId]/sessions/[sessionId].astro`

**Intent**: Preserve the existing edit URL and access checks while making the post-start state useful instead of only showing an editing-locked message.

**Contract**: If `isSessionEditable(session)` is true, keep rendering `SessionForm`. If false, load trainer-scoped session detail with logs and render `SessionActualsReview`. Keep redirects for invalid UUIDs, unassigned clients, and not-found sessions.

#### 3. Shared Formatting

**File**: `src/lib/guided-workout/format-prescription.ts`

**Intent**: Reuse existing prescription formatting instead of inventing separate dashboard strings.

**Contract**: If the current helpers are insufficient for read-only actuals, extend them conservatively with pure formatting helpers and tests rather than formatting inline in the component.

### Success Criteria:

#### Automated Verification:

- Existing workout-session and guided-workout unit tests pass: `npm test -- src/lib/workout-sessions/form-validation.test.ts src/lib/guided-workout/format-prescription.test.ts`
- New readout tests remain green: `npm test -- src/lib/trainer-dashboard/readout.test.ts`
- Lint passes: `npm run lint`

#### Manual Verification:

- A not-started trainer session still opens the existing editable session form.
- A started/logged trainer session opens the same URL and shows read-only prescribed vs actual rows.
- The review page has no edit, save, delete, or archive controls when the session is not editable.
- Back navigation returns to the client plan date when `scheduled_date` exists.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the review view is understandable before proceeding.

---

## Phase 3: Trainer Dashboard Overview

### Overview

Replace the placeholder dashboard with the S-07 overview: summary cards, active client roster summary, setup checklist empty state, quick actions, and recent logged activity.

### Changes Required:

#### 1. Dashboard Page

**File**: `src/pages/trainer/dashboard.astro`

**Intent**: Load the SSR dashboard service for the authenticated trainer and render the new dashboard surface.

**Contract**: Use `Astro.locals.user?.id` as the trainer identity. Render a loading/configuration error if Supabase is unavailable, otherwise pass the service DTO into dashboard components. Keep `Layout` and existing topbar behavior.

#### 2. Dashboard Components

**File**: `src/components/trainer/TrainerDashboardOverview.astro`

**Intent**: Keep the dashboard page thin and make the overview easier to verify visually.

**Contract**: Render summary cards, active clients, quick actions, recent logged activity, and empty states from the service DTO. Use existing Tailwind patterns and `cn()` when class composition moves into React/TSX helpers.

#### 3. Activity Feed Links

**File**: `src/components/trainer/TrainerDashboardOverview.astro`

**Intent**: Make recent logged activity actionable.

**Contract**: Each activity item links to `/trainer/clients/{clientId}/sessions/{sessionId}`. Do not link to missed or unstarted sessions in this phase because missed surfacing is out of scope.

#### 4. Setup Empty State

**File**: `src/components/trainer/TrainerDashboardOverview.astro`

**Intent**: Give new trainers a clear next-step path instead of an empty dashboard.

**Contract**: Render a setup checklist with links to invite client, create template, create exercise, and schedule a session. Use existing routes: `/trainer/clients`, `/trainer/templates`, `/trainer/exercises`, and client plan links when a client exists.

### Success Criteria:

#### Automated Verification:

- Readout unit tests pass: `npm test -- src/lib/trainer-dashboard/readout.test.ts`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Trainer with no clients sees the setup checklist and invite/template/exercise links.
- Trainer with clients but no logged activity sees active client summary and a calm "no logged activity yet" state.
- Trainer with logged sessions sees recent activity linking to session review.
- Mobile width stacks stats, client summary, quick actions, and feed without horizontal overflow.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that dashboard content and ordering match the approved scope before proceeding.

---

## Phase 4: Rich Trainer Clients Roster

### Overview

Refresh `/trainer/clients` into the richer Pencil roster while preserving the shipped invite, pending invites, copy-link, and remove-client behavior.

### Changes Required:

#### 1. Clients Page Data

**File**: `src/pages/trainer/clients.astro`

**Intent**: Load enough metadata for richer roster cards: display name, assigned date, active plan name/date range, and no-plan state.

**Contract**: Keep active-client scoping. Extend the SSR query/service shape without exposing removed clients. Continue passing `invites`, `clients`, and `origin` into the client panel or its replacement.

#### 2. Invite Client Panel Roster UI

**File**: `src/components/trainer/InviteClientPanel.tsx`

**Intent**: Preserve invite management and removal while upgrading the active-client section to metadata cards.

**Contract**: Client cards show avatar fallback/initial, display name, joined date, active plan metadata when present, "No active plan" when absent, `Open calendar` link to `/trainer/clients/{clientId}/plan`, and existing remove-client behavior.

#### 3. Client DTO Types

**File**: `src/components/trainer/InviteClientPanel.tsx`

**Intent**: Make the richer client prop explicit so future work does not rely on loosely shaped nested objects.

**Contract**: Define or import a typed client roster DTO with `assignmentId`, `clientId`, `displayName`, `assignedAt`, and optional active plan metadata.

### Success Criteria:

#### Automated Verification:

- Lint passes for the updated React island and Astro page: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Pending invite generation/copying still works.
- Existing active clients render as metadata cards.
- Clients without an active plan show a clear no-plan state and a calendar/deep-link path where appropriate.
- Remove-client confirmation and success behavior still works.
- `/trainer/clients` remains usable on mobile with stacked cards.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the roster refresh did not regress invite management before proceeding.

---

## Phase 5: Final Verification And Workflow Handoff

### Overview

Run the full verification set, ensure the plan progress is ready for implementation tracking, and document any known limitations that remain after S-07.

### Changes Required:

#### 1. Verification Pass

**File**: `context/changes/trainer-dashboard/plan.md`

**Intent**: Keep the plan progress section accurate as implementation lands.

**Contract**: The implementer should check off progress items only after the matching automated or manual verification has completed. Commit SHAs should be appended only after pushed phase commits per `context/foundation/lessons.md`.

#### 2. Scope Notes

**File**: `context/changes/trainer-dashboard/change.md`

**Intent**: Keep future readers clear on what S-07 deliberately deferred.

**Contract**: If implementation reveals additional deferrals, add them as notes without changing the original scope decisions unless the user explicitly approves scope changes.

### Success Criteria:

#### Automated Verification:

- Full lint passes: `npm run lint`
- Full production build passes: `npm run build`
- New and relevant existing unit tests pass: `npm test -- src/lib/trainer-dashboard/readout.test.ts src/lib/guided-workout/format-prescription.test.ts src/lib/workout-sessions/form-validation.test.ts`

#### Manual Verification:

- Dashboard, session review, and clients roster pass desktop and mobile smoke checks.
- No exercise-library modal redesign was introduced.
- No missed-session cards or persisted status changes were introduced.
- The next command `/10x-implement trainer-dashboard phase 1` is ready to run.

**Implementation Note**: After this phase, the feature should be ready for implementation review and any follow-up scope should be opened as a separate change.

---

## Testing Strategy

### Unit Tests:

- `src/lib/trainer-dashboard/readout.test.ts` for display-only completion/readout derivation.
- Existing formatting tests if prescription/actual formatting helpers are extended.
- Existing session editability tests to guard the edit-vs-review branch.

### Integration Tests:

- No new Supabase integration test is required for this plan by default. Existing RLS tests already cover core table isolation; add an integration test only if implementation introduces a database RPC, view, or security-definer function.

### Manual Testing Steps:

1. Sign in as a trainer with no clients and verify dashboard setup checklist.
2. Sign in as a trainer with active clients and no logs; verify dashboard summary and no-activity state.
3. Log a client session, return as trainer, and verify dashboard recent activity links to session actuals review.
4. Open a not-started session and confirm the trainer can still edit it.
5. Open a started/logged session and confirm the trainer sees read-only actuals with no edit controls.
6. Open `/trainer/clients` and verify invite generation, pending invite display, active client metadata cards, open calendar links, and remove-client flow.
7. Repeat dashboard and clients smoke checks below 768px width.

## Performance Considerations

The dashboard service must use bounded queries and avoid N+1 per client session fetches. Recent activity should be limited for MVP, and active client/plan metadata should be batched by trainer assignment and active plan relationships. If this becomes difficult with Supabase joins, prefer a small number of explicit batched queries before introducing a database RPC.

## Migration Notes

No database migration is planned. The plan deliberately derives readout status from existing `set_logs` and prescription rows and does not add a missed/cancelled status.

## References

- Design: `docs/pencil/trainer_dashboard.pen`
- Design system: `DESIGN.md`
- Roadmap S-07: `context/foundation/roadmap.md:192`
- Dashboard placeholder: `src/pages/trainer/dashboard.astro:7`
- Clients route: `src/pages/trainer/clients.astro:14`
- Existing session route: `src/pages/trainer/clients/[clientId]/sessions/[sessionId].astro:99`
- Workout session services: `src/lib/workout-sessions/service.ts:127`
- Lessons: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Dashboard Data And Readout Contracts

#### Automated

- [x] 1.1 Readout unit tests pass for the new helper: `npm test -- src/lib/trainer-dashboard/readout.test.ts` — 1c3462f
- [x] 1.2 Type-aware lint passes for touched files: `npm run lint` — 1c3462f
- [x] 1.3 Production build still succeeds: `npm run build` — 1c3462f

#### Manual

- [x] 1.4 Service contract can be inspected from TypeScript without ambiguous `any` shapes leaking into page code. — 1c3462f
- [x] 1.5 Removed clients are not represented in the service output. — 1c3462f

### Phase 2: Read-Only Session Actuals Review

#### Automated

- [x] 2.1 Existing workout-session and guided-workout unit tests pass: `npm test -- src/lib/workout-sessions/form-validation.test.ts src/lib/guided-workout/format-prescription.test.ts` — ca2c5a3
- [x] 2.2 New readout tests remain green: `npm test -- src/lib/trainer-dashboard/readout.test.ts` — ca2c5a3
- [x] 2.3 Lint passes: `npm run lint` — ca2c5a3

#### Manual

- [x] 2.4 A not-started trainer session still opens the existing editable session form. — ca2c5a3
- [x] 2.5 A started/logged trainer session opens the same URL and shows read-only prescribed vs actual rows. — ca2c5a3
- [x] 2.6 The review page has no edit, save, delete, or archive controls when the session is not editable. — ca2c5a3
- [x] 2.7 Back navigation returns to the client plan date when `scheduled_date` exists. — ca2c5a3

### Phase 3: Trainer Dashboard Overview

#### Automated

- [x] 3.1 Readout unit tests pass: `npm test -- src/lib/trainer-dashboard/readout.test.ts` — 7817e30
- [x] 3.2 Lint passes: `npm run lint` — 7817e30
- [x] 3.3 Production build passes: `npm run build` — 7817e30

#### Manual

- [x] 3.4 Trainer with no clients sees the setup checklist and invite/template/exercise links. — 7817e30
- [x] 3.5 Trainer with clients but no logged activity sees active client summary and a calm "no logged activity yet" state. — 7817e30
- [x] 3.6 Trainer with logged sessions sees recent activity linking to session review. — 7817e30
- [x] 3.7 Mobile width stacks stats, client summary, quick actions, and feed without horizontal overflow. — 7817e30

### Phase 4: Rich Trainer Clients Roster

#### Automated

- [x] 4.1 Lint passes for the updated React island and Astro page: `npm run lint` — 5aaa7cb
- [x] 4.2 Production build passes: `npm run build` — 5aaa7cb

#### Manual

- [x] 4.3 Pending invite generation/copying still works. — 5aaa7cb
- [x] 4.4 Existing active clients render as metadata cards. — 5aaa7cb
- [x] 4.5 Clients without an active plan show a clear no-plan state and a calendar/deep-link path where appropriate. — 5aaa7cb
- [x] 4.6 Remove-client confirmation and success behavior still works. — 5aaa7cb
- [x] 4.7 `/trainer/clients` remains usable on mobile with stacked cards. — 5aaa7cb

### Phase 5: Final Verification And Workflow Handoff

#### Automated

- [x] 5.1 Full lint passes: `npm run lint`
- [x] 5.2 Full production build passes: `npm run build`
- [x] 5.3 New and relevant existing unit tests pass: `npm test -- src/lib/trainer-dashboard/readout.test.ts src/lib/guided-workout/format-prescription.test.ts src/lib/workout-sessions/form-validation.test.ts`

#### Manual

- [x] 5.4 Dashboard, session review, and clients roster pass desktop and mobile smoke checks.
- [x] 5.5 No exercise-library modal redesign was introduced.
- [x] 5.6 No missed-session cards or persisted status changes were introduced.
- [x] 5.7 All plan phases complete — change ready for archive or implementation review.
