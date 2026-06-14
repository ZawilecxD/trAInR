# Guided Workout Logging (S-06) Implementation Plan

## Overview

Build the client guided workout flow (S-06): calendar → session overview → guided set-by-set logging with autosave, exercise navigation menu, and a minimal FR-020 edit-list for resumed sessions. UI follows `docs/pencil/guided_workout_logging.pen` (Screens 1–3). **FR-019 previous-performance hints are deferred** — prescription-only per exercise; park FR-019 on the roadmap for a future rethink slice.

## Current State Analysis

S-04/S-05 delivered trainer session assignment and a read-only client calendar. The logging data layer exists but has no application write path or UI.

- **Schema ready.** `workout_sessions` (`started_at`, `status`, `locked_at`), `session_exercises`, `session_exercise_sets` (per-round prescription), and `set_logs` (actual performance) are live (`supabase/migrations/20260526120400_sessions_logging_comments.sql`, `20260608120000_session_exercise_sets.sql`). RLS lets clients INSERT/UPDATE `set_logs` on their assigned sessions (`set_logs_client_insert` / `set_logs_client_update`). Clients can UPDATE `workout_sessions` via `workout_sessions_client_update` — sufficient for setting `started_at`.
- **No upsert safety on `set_logs`.** No `UNIQUE (session_exercise_id, set_number)` — concurrent autosaves can duplicate rows. Phase 1 adds the constraint plus `is_complete` for the OK toggle.
- **Service layer is trainer-centric for detail.** `getSessionWithExercises` (`src/lib/workout-sessions/service.ts:150`) joins prescriptions but not `set_logs`. No client ownership check on session detail fetch.
- **Client read path exists.** `listMySessionsAsClient`, `requireClient`, `GET /api/client/sessions` from S-05. Calendar (`ClientCalendarHub.tsx:219–227`) shows sessions view-only — no Open link.
- **No logging UI.** No `/client/sessions/[sessionId]` route, no set-log API, no React components for guided flow. `SetLog` type exists (`src/types.ts:158`).
- **Design spec.** `docs/pencil/guided_workout_logging.pen` defines Screens 1–3 and explicitly scopes out rest timer, warm-up flag (S-10), completion marking (S-08). No Screen 4 for FR-020 — use stitch F3 (`docs/stitch-ui-design-prompt.md:270–276`) as shape reference.

### Key Discoveries:

- Trainer session editor pattern at `src/pages/trainer/clients/[clientId]/sessions/[sessionId].astro` — SSR load + React island is the template for client session page.
- `session_exercise_sets` rows pair 1:1 with logging rows by `set_number` — prescription drives row count in the set table.
- `ExerciseMetric` (`src/types.ts:47`) — `reps_weight` shows Reps + kg columns; `time` shows duration column (per mockup design spec). `distance` is out of scope.
- Lessons.md: thread `userId` from `requireClient` into services; plan navigation (calendar Open link) ships in the same phase as the new route.
- Lessons.md: deliver copy-paste Supabase Studio SQL for RLS verification in Phase 1.

## Desired End State

A logged-in client opens **My Plan**, selects a day, taps **Open** on a session, and lands on `/client/sessions/[sessionId]`. For a new session they see the overview (mockup Screen 1): assigned-by meta, date, exercise count, trainer note, phase breakdown, and a bottom-anchored **Begin Workout** CTA. Tapping Begin sets `started_at` and enters guided logging (mockup Screen 2): progress counter, exercise header, prescription bar, set table with OK toggle, autosave feedback, Prev/Next, and ≡ menu. The nav menu (mockup Screen 3) lists exercises grouped by phase with status dots; tap jumps to that exercise. Returning to a session that already has logs opens the FR-020 edit list (all exercises, inline set editing) instead of the overview. No previous-performance hint block is shown.

Verified by: `npm run lint`, `npx astro check`, `npm run build`, `npm run test` pass; RLS verification script confirms client set-log isolation; manual mobile UX check on overview, logging, nav menu, and edit list.

## What We're NOT Doing

- **FR-019 previous-performance hints** — deferred; park on roadmap for rethink (user decision during planning).
- **FR-018 warm-up/working flag** (S-10) — `is_warmup` stays default `false`.
- **FR-021 session completion marking** (S-08) — no finished/partial controls.
- **FR-022 24h edit window / sealed state** (S-13) — edit list has no lock countdown or read-only seal.
- **Rest timer** — `rest_after_seconds` is display-only in prescription bar.
- **Trainer dashboard / session readout** (S-07).
- **Session comments** (S-09).
- **Exercise video links, muscle-group chips** — mockup embellishments; prescription + name suffice for MVP.
- **`default_metric: distance`** exercises — no UI in this slice.

## Implementation Approach

Bottom-up: lock the write path (migration + API + service) first, then ship the reachable overview page with calendar entry, then the guided logging core, then navigation menu and edit-list modes. Each phase is independently testable. UI tokens follow existing client pages (dark glass cards, shadcn/ui, `cn()` for classes) aligned to pencil mockup layout — not a pixel-perfect Pencil import.

## Critical Implementation Details

- **Mode routing in `GuidedWorkoutHub`:** `overview` when `started_at` is null; `edit-list` when `started_at` is set AND at least one `set_logs` row exists for the session; otherwise `guided` (resume in-progress). Edit list rows link into `guided` at the chosen exercise index.
- **Autosave contract:** debounce ~500ms after value change or OK toggle; upsert on `(session_exercise_id, set_number)`; per-row UI states `idle | saving | saved | error` with retry on error. Never silently discard failed saves.
- **OK toggle persistence:** requires `is_complete boolean` on `set_logs` (Phase 1 migration). Exercise "done" in nav menu = all prescribed sets for that exercise have `is_complete = true`.
- **Ownership:** every client API call verifies `client_plans.client_id = userId` for the session's plan — never accept a caller-supplied client id.

## Phase 1: Client session API + set-log service

### Overview

Add the migration for safe set upserts, extend the workout-session service for client-scoped detail + start, add a set-log service with upsert, zod schemas, API routes, and an RLS verification script.

### Changes Required:

#### 1. `set_logs` upsert constraint + `is_complete`

**File**: `supabase/migrations/YYYYMMDDHHmmss_set_logs_upsert_complete.sql` (new)

**Intent**: Make autosave upserts safe and persist OK-toggle completion state.

**Contract**: Add `is_complete boolean not null default false` to `set_logs`. Add `unique (session_exercise_id, set_number)`. Backfill: existing rows get `is_complete = false`. Update `SetLog` in `src/types.ts` with `is_complete: boolean`.

#### 2. Client session detail service

**File**: `src/lib/workout-sessions/service.ts`

**Intent**: Load a session with prescriptions, set logs, and trainer display name for the overview screen — scoped to the authenticated client.

**Contract**: `getMySessionDetail(supabase, userId, sessionId)` returns `{ data: ClientSessionDetail | null; error }`. Verify ownership: session → `client_plans` where `client_id = userId`. Select session fields, join `session_exercises` → `exercises(name, default_metric)`, `session_exercise_sets`, `set_logs`, and trainer `profiles.display_name` via `client_plans.trainer_id`. Sort exercises by `sort_order`; sets by `set_number`. Export `ClientSessionDetail`, `SessionExerciseDetail` (extends `SessionExerciseWithName` + `logs: SetLog[]`), `SessionMeta` types in service or `src/types.ts`.

#### 3. Start session service

**File**: `src/lib/workout-sessions/service.ts`

**Intent**: Set `started_at` when client taps Begin Workout — only once, only for owned sessions.

**Contract**: `startMySession(supabase, userId, sessionId)` — verify ownership; `update workout_sessions set started_at = now() where id = ? and started_at is null`; return error if not found or already started. Pass `userId` from guard, not `getUser()` inside service.

#### 4. Set-log service

**File**: `src/lib/set-logs/service.ts` (new)

**Intent**: Upsert a single set log with ownership verification and metric-aware validation.

**Contract**: `upsertSetLog(supabase, userId, body: UpsertSetLogBody)` — resolve `session_exercise_id` → session → plan → `client_id = userId`; upsert on `(session_exercise_id, set_number)` with fields `reps`, `duration_seconds`, `load_kg`, `is_complete`, `is_warmup` (always `false` in S-06). Reject writes when session `locked_at` is set (forward-compat for S-13). Return the saved `SetLog`.

#### 5. Zod schemas

**File**: `src/lib/set-logs/schemas.ts` (new)

**Intent**: Validate set-log upsert payloads.

**Contract**: `upsertSetLogBodySchema` — `session_exercise_id` (uuid), `set_number` (int ≥ 1), `reps` (int nullable), `duration_seconds` (int nullable), `load_kg` (number nullable — negatives allowed for assisted), `is_complete` (boolean). Refine: at least one of `reps` or `duration_seconds` when `is_complete` is true; metric-appropriate fields enforced in service using exercise `default_metric`.

#### 6. API routes

**Files**:
- `src/pages/api/client/sessions/[id].ts` (new) — `GET`, `requireClient`, call `getMySessionDetail`
- `src/pages/api/client/sessions/[id]/start.ts` (new) — `POST`, `requireClient`, call `startMySession`
- `src/pages/api/client/set-logs.ts` (new) — `PUT`, `requireClient`, parse `upsertSetLogBodySchema`, call `upsertSetLog`

**Intent**: Client-guarded HTTP surface for the React island.

**Contract**: All export `prerender = false`. Follow `src/pages/api/client/sessions.ts` response patterns (`jsonResponse` / `jsonError`). 404 when session not found or not owned; 409 when start called on already-started session.

#### 7. RLS verification script

**File**: `context/changes/guided-workout-logging/verification.sql` (new)

**Intent**: Prove client can upsert own set logs and cannot write to another client's session.

**Contract**: Single copy-paste Studio script per lessons.md: `begin; set local role authenticated;` transaction-scoped JWT claims; sanity `select auth.uid()`; assert INSERT/UPDATE succeeds on own `set_logs`; assert zero access to foreign session; `rollback;`.

#### 8. Unit tests

**Files**: `src/lib/set-logs/schemas.test.ts`, extend `src/lib/api/guards.test.ts` if needed

**Intent**: Lock validation and guard behaviour.

**Contract**: Cover `upsertSetLogBodySchema` happy path, missing metric fields, negative `load_kg`, invalid uuid.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset` (local) or `npx supabase migration up`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test`
- Build passes: `npm run build`

#### Manual Verification:

- `context/changes/guided-workout-logging/verification.sql` in Supabase Studio confirms client set-log isolation.
- `GET /api/client/sessions/[id]` returns 200 with exercises + logs for own session, 404 for foreign session.
- `POST /api/client/sessions/[id]/start` sets `started_at` once; second call returns 409.
- `PUT /api/client/set-logs` upserts without duplicate rows on repeated calls.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Session overview + calendar entry

### Overview

Add the client session page with overview screen (mockup Screen 1) and wire calendar Open links. SSR loads initial session data; island handles Begin → guided transition.

### Changes Required:

#### 1. Client session page

**File**: `src/pages/client/sessions/[sessionId].astro` (new)

**Intent**: SSR entry point for guided workout — loads session detail for the logged-in client.

**Contract**: `prerender = false`. Read `sessionId` from `Astro.params`; create SSR Supabase client; resolve `context.locals.user`; call `getMySessionDetail`; 404 Astro redirect if null; render `ClientLayout` with `GuidedWorkoutHub` island passing `initialSession` prop. Follow `src/pages/client/plan.astro` SSR pattern.

#### 2. `GuidedWorkoutHub` shell + overview screen

**File**: `src/components/guided-workout/GuidedWorkoutHub.tsx` (new)

**Intent**: Root React island owning mode state (`overview | guided | edit-list`) and routing between screens.

**Contract**: Props: `initialSession: ClientSessionDetail`. Overview screen per mockup Screen 1: back link to `/client/plan` ("Calendar"), session title, meta card (assigned by, date, total exercises), trainer note card (if present), phase breakdown list (group exercises by `phase` with counts), bottom-fixed **Begin Workout** primary button. On Begin: `POST /api/client/sessions/[id]/start`, then switch to `guided` at exercise index 0. If `initialSession.started_at` set and logs exist → start in `edit-list`; if `started_at` set and no logs → `guided`.

#### 3. Overview subcomponents

**Files**: `src/components/guided-workout/SessionOverview.tsx`, `src/components/guided-workout/PhaseBreakdown.tsx` (new)

**Intent**: Decompose overview layout matching pencil frame `1 · Session Overview`.

**Contract**: Use shadcn `Button`, `Card` (or existing glass card classes from client plan). Phase labels: `WARM-UP`, `MAIN PHASE`, `COOL-DOWN` (JetBrains Mono uppercase per mockup). Date formatted like mockup (`Sat, Jun 14 2026`).

#### 4. Calendar Open links

**File**: `src/components/plans/ClientCalendarHub.tsx`

**Intent**: Make sessions reachable from the calendar per US-01 and lessons.md navigation rule.

**Contract**: In day-panel session list (`lines 219–227`), wrap each session row with a link to `/client/sessions/${session.id}` and an explicit **Open** action (button or chevron). Preserve status badge. Optional: same link in `ClientWeekView` session cards for parity.

#### 5. Middleware

**File**: `src/middleware.ts`

**Intent**: Ensure `/client/sessions/*` is protected for client role.

**Contract**: Verify `/client/*` guard already covers new route; add to `PROTECTED_ROUTES` only if not already matched by prefix.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Client taps Open on calendar session → overview loads with correct meta and phase breakdown.
- Begin Workout transitions to guided shell (exercise content can be placeholder until Phase 3).
- Back to Calendar returns to `/client/plan`.
- Trainer or signed-out user cannot access `/client/sessions/[id]`.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Guided logging UI

### Overview

Implement the primary gym screen (mockup Screen 2): prescription bar, set table with autosave, OK toggle, progress counter, Prev/Next navigation. No previous-performance hint block (FR-019 deferred).

### Changes Required:

#### 1. Guided exercise view

**File**: `src/components/guided-workout/GuidedExerciseView.tsx` (new)

**Intent**: One-exercise-at-a-time logging screen per mockup Screen 2.

**Contract**: Top nav: back to overview (only if `!started_at` — else hide or go to edit-list), center progress (`{index + 1} of {total}`), right ≡ menu button (wired in Phase 4). Exercise header: phase label, exercise name (large), optional notes line. Prescription bar: summarize rounds from `session_exercise_sets` (e.g. `3 sets · 8 reps · 80 kg · Rest 2 min`). Set table: columns Set / Reps or Duration / kg / OK; active row highlight; `time` metric swaps Reps for duration input. Bottom: Prev / Next buttons (large, thumb-zone). Disabled Prev on first exercise; Next on last shows "Finish" label (no status change — S-08).

#### 2. Set row component

**File**: `src/components/guided-workout/SetLogRow.tsx` (new)

**Intent**: Single set row with inputs and OK toggle.

**Contract**: Number inputs with large tap targets (≥44px). OK toggle (checkbox or icon button) sets `is_complete`. Active row: accent border per mockup `Set 3` highlight. Load kg allows negative, zero, empty (bodyweight).

#### 3. Autosave hook

**File**: `src/components/hooks/useDebouncedSetLogSave.ts` (new)

**Intent**: Debounced per-set persistence with per-row save state.

**Contract**: `useDebouncedSetLogSave({ sessionExerciseId, setNumber, values, debounceMs: 500 })` returns `{ status, error, retry }`. Calls `PUT /api/client/set-logs`. Idempotent upsert. On error: show retry affordance; do not clear user input.

#### 4. Prescription formatter

**File**: `src/lib/guided-workout/format-prescription.ts` (new)

**Intent**: Pure helper for prescription bar text from `SessionExerciseSet[]`.

**Contract**: `formatPrescription(sets, defaultMetric): string` — e.g. uniform reps/load → `3 sets · 8 reps · 80 kg`; include rest if present. Target `src/lib/` per lessons.md (pure computation, not a hook).

#### 5. Wire into `GuidedWorkoutHub`

**File**: `src/components/guided-workout/GuidedWorkoutHub.tsx`

**Intent**: Track `exerciseIndex` state; render `GuidedExerciseView` in `guided` mode; pass exercise + logs; merge upsert responses into local session state.

**Contract**: Ordered exercise list = `sort_order` across all phases. Prev/Next mutate `exerciseIndex` only (no API).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test` (add `format-prescription.test.ts`)
- Build passes: `npm run build`

#### Manual Verification:

- Log reps + weight on a set → autosave shows saving → saved.
- OK toggle persists on reload.
- Timed exercise shows duration column instead of reps.
- Prev/Next moves between exercises in prescribed order.
- Airplane mode / failed save shows error + retry without data loss.

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Navigation menu + edit list (FR-016 / FR-020)

### Overview

Add the exercise list sheet (mockup Screen 3) and the minimal edit-list view for sessions with existing logs (stitch F3 shape).

### Changes Required:

#### 1. Exercise nav menu sheet

**File**: `src/components/guided-workout/ExerciseNavMenu.tsx` (new)

**Intent**: Full exercise list overlay per mockup Screen 3.

**Contract**: shadcn `Sheet` from bottom or full-screen on mobile. Header: "Exercises" + Close. Progress summary: `N done · M active · K remaining`. Groups by phase with section headers. Each row: status dot (green = all sets complete, accent = current, empty = pending), exercise name, set progress (`2/3`). Tap row → set `exerciseIndex`, close sheet, stay in `guided` mode.

#### 2. Edit list view

**File**: `src/components/guided-workout/SessionEditList.tsx` (new)

**Intent**: FR-020 minimal list view for sessions with existing logs.

**Contract**: Scrollable all-exercises list; each exercise expandable/card with inline set rows (same `SetLogRow` + autosave). Header: session name, date, back to calendar. No 24h countdown (S-13). Tap exercise name → jump to `guided` at that index for focused editing. Entry: automatic when reopening session with logs (per mode routing).

#### 3. Completion helpers

**File**: `src/lib/guided-workout/exercise-progress.ts` (new)

**Intent**: Pure functions for nav-menu status dots and progress counts.

**Contract**: `getExerciseProgress(prescribedSetCount, logs: SetLog[])` → `{ completedSets, isDone, isActive }`. `isDone` = all prescribed sets have `is_complete`. Used by nav menu and hub.

#### 4. Wire menu + edit list in hub

**File**: `src/components/guided-workout/GuidedWorkoutHub.tsx`

**Intent**: Connect ≡ button to `ExerciseNavMenu`; render `SessionEditList` in `edit-list` mode; allow switching edit-list ↔ guided.

**Contract**: Menu accessible from guided mode only. Edit list shows "Continue workout" CTA → `guided` at first incomplete exercise.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test` (add `exercise-progress.test.ts`)
- Build passes: `npm run build`

#### Manual Verification:

- ≡ menu lists all exercises with correct status dots; tap jumps to exercise.
- Reopen session with logged data → edit list loads; inline edits autosave.
- Jump from edit list to guided mode works at chosen exercise.
- Phase grouping matches overview and prescription order.

**Implementation Note**: Final manual sign-off for S-06 slice complete.

---

## Testing Strategy

### Unit Tests:

- `upsertSetLogBodySchema` validation edge cases
- `formatPrescription` for uniform and mixed rounds
- `getExerciseProgress` for complete, partial, empty exercises
- `requireClient` guard (existing pattern)

### Integration Tests:

- Extend or add `tests/integration/rls/set-logs.test.ts` for `is_complete` column and unique constraint behaviour
- Optional: API route smoke test if project pattern supports it

### Manual Testing Steps:

1. Trainer assigns session → client sees it on calendar → Open → overview matches mockup structure.
2. Begin Workout → log all sets across 3+ exercises with OK toggles → reload page → data persists.
3. Open ≡ menu mid-workout → jump to last exercise → verify progress dots.
4. Close browser mid-workout → reopen → resume in guided or edit-list as appropriate.
5. Toggle airplane mode during save → error + retry recovers.
6. Timed exercise session logs duration correctly.
7. Verify trainer can no longer edit session prescription after client began (`started_at` set).

## Performance Considerations

- Session detail fetch is one joined query — acceptable for typical session sizes (≤50 exercises, ≤20 sets each).
- Autosave debounce (500ms) limits write frequency during rapid input.
- FR-019 hint query deliberately omitted — removes cross-session join cost from this slice.

## Migration Notes

- Phase 1 migration adds `is_complete` and unique constraint — zero-downtime on empty/new projects; on DBs with duplicate `(session_exercise_id, set_number)` rows, dedupe before applying.
- Update `context/foundation/roadmap.md` to park FR-019 as a new proposed slice (e.g. S-06b or backlog item) when implementation starts — not blocking code work.

## References

- Mockups: `docs/pencil/guided_workout_logging.pen` (Screens 1–3, Design Spec frame)
- Stitch UI shape for edit list: `docs/stitch-ui-design-prompt.md` (F3)
- PRD: `context/foundation/prd.md` (FR-015–017, FR-020; FR-019 deferred)
- Roadmap: `context/foundation/roadmap.md` (S-06)
- ERD: `docs/ERD.md` (`set_logs`, session graph)
- Prior slice: `context/archive/2026-06-13-client-calendar/plan.md` (deferred navigation)
- Service pattern: `src/lib/workout-sessions/service.ts`
- Client API pattern: `src/pages/api/client/sessions.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Client session API + set-log service

#### Automated

- [x] 1.1 Migration applies cleanly
- [x] 1.2 Type checking passes
- [x] 1.3 Linting passes
- [x] 1.4 Unit tests pass
- [x] 1.5 Build passes

#### Manual

- [x] 1.6 RLS verification script confirms client set-log isolation
- [x] 1.7 Client session GET/start/set-log API manual checks

### Phase 2: Session overview + calendar entry

#### Automated

- [ ] 2.1 Type checking passes
- [ ] 2.2 Linting passes
- [ ] 2.3 Build passes

#### Manual

- [ ] 2.4 Calendar Open link reaches session overview
- [ ] 2.5 Begin Workout sets started_at and transitions to guided shell
- [ ] 2.6 Unauthorized users cannot access client session route

### Phase 3: Guided logging UI

#### Automated

- [ ] 3.1 Type checking passes
- [ ] 3.2 Linting passes
- [ ] 3.3 Unit tests pass
- [ ] 3.4 Build passes

#### Manual

- [ ] 3.5 Set autosave and OK toggle persist across reload
- [ ] 3.6 Timed exercise duration input works
- [ ] 3.7 Prev/Next navigation and save error retry verified

### Phase 4: Navigation menu + edit list (FR-016 / FR-020)

#### Automated

- [ ] 4.1 Type checking passes
- [ ] 4.2 Linting passes
- [ ] 4.3 Unit tests pass
- [ ] 4.4 Build passes

#### Manual

- [ ] 4.5 Exercise nav menu jump and status dots verified
- [ ] 4.6 Edit list loads for sessions with logs; inline edits autosave
- [ ] 4.7 Edit list ↔ guided mode switching works
