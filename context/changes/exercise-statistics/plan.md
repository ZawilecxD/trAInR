# Exercise Statistics (S-12) Implementation Plan

## Overview

Give a client a read-only, per-exercise performance history. For every exercise the client has logged at least one working set, they can open a stats page showing session-by-session history (top set, estimated 1RM, volume/tonnage) with the ability to expand any session into its individual working sets. Estimated 1RM uses the Epley formula and is labelled "estimated". Columns adapt to each exercise's metric so time-based and bodyweight movements don't show meaningless 1RM/tonnage.

Satisfies FR-024 (per-exercise history table), FR-025 (Epley estimated 1RM from working sets), FR-026 (volume/tonnage). Roadmap slice S-12, Linear ZAW-17.

## Current State Analysis

- **Logging data is fully in place** (S-06/S-10/S-13/S-21). Actuals live in `set_logs` (`reps`, `duration_seconds`, `load_kg`, `is_warmup`, `is_complete`, `rpe`, `logged_at`) keyed to `session_exercises` → `workout_sessions` → `client_plans` (`client_id`, `trainer_id`). Source: `supabase/migrations/20260526120400_sessions_logging_comments.sql`, `20260702120000_set_logs_rpe.sql`.
- **Working vs warm-up** is decided by `set_logs.is_warmup`; only `is_warmup = false` sets count toward stats/hints (S-10 contract, `context/foundation/roadmap.md:265`, `docs/ERD.md:389`).
- **RLS already covers client-scoped reads.** `set_logs` SELECT is gated by `can_access_session_exercise`; scoping a query with `client_plans.client_id = auth.uid()` returns only the caller's data with no new policy needed (`supabase/migrations/20260526120400_sessions_logging_comments.sql:365`, access chain `:154-167`).
- **No stats/calculation code exists.** Repo-wide search for `epley`/`1rm`/`tonnage`/`volume` returns nothing in `src/`. This is a greenfield calc layer.
- **No client stats/exercise route.** Client pages are `src/pages/client/{dashboard,plan}.astro` and `src/pages/client/sessions/[sessionId].astro`. Client Topbar nav (`src/components/Topbar.astro:33-36`) is Dashboard + My Plan only. Exercises are trainer-owned; a client can already SELECT accessible exercises via `exercises_client_select_via_assigned_session`.
- **Established patterns to follow:**
  - Pure calc util with injectable inputs + colocated Vitest test — `src/lib/guided-workout/edit-window.ts` (+ `edit-window.test.ts`), `src/lib/guided-workout/exercise-progress.ts`.
  - Metric-aware set predicate — `src/lib/guided-workout/set-logged.ts` (`isSetValuesLogged`).
  - Service: `src/lib/<domain>/service.ts`, first arg `supabase: SupabaseClient`, returns `{ data, error: string | null }`; nested `select` join pattern — `src/lib/workout-sessions/service.ts:222-229`.
  - SSR page → React island — `src/pages/client/plan.astro` (server fetch via service, pass serializable props to `client:load` island).
  - RLS/service integration test — `tests/integration/rls/set-logs.test.ts`, `tests/integration/workout-sessions/client-session-readout.test.ts`; fixtures `createTrainer` / `createClient_`.
- **`ExerciseMetric = "reps_weight" | "time" | "distance"`** (`src/types.ts:47`). Note `set_logs` has **no distance column** — distance-metric exercises can only carry reps/load/duration in logs.

## Desired End State

A client signed into the app sees a new **Exercises** item in the top nav. It opens `/client/exercises`, a list of every exercise they've logged working sets for (with last-logged date and session count). Selecting one opens `/client/exercises/:exerciseId`, showing:

- A headline **all-time estimated 1RM** (weighted exercises only) with an "estimated" qualifier.
- A **history table, one row per session** (most recent first): date, top working set (e.g. `8 × 60 kg`), estimated 1RM for that session, and volume/tonnage. Each row expands to its individual working sets.
- Columns **adapt to the exercise metric** — `reps_weight` shows load/1RM/volume; `time` shows duration and set counts, no 1RM/tonnage; bodyweight (load 0/null) shows reps & set counts, no 1RM/tonnage.

Verification: as a client, log ≥2 sessions of a weighted exercise, open its stats page, and confirm per-session rows, correct Epley 1RM, and volume equal to Σ(reps × load) over working sets. A client cannot see another client's history (RLS).

### Key Discoveries:

- No migration required — read-only over existing tables (`supabase/migrations/20260526120400_sessions_logging_comments.sql`).
- Epley: `1RM = load × (1 + reps / 30)`. Meaningful only for weighted rep sets; label "estimated" and note inaccuracy above ~10 reps (`context/foundation/roadmap.md:296`, PRD FR-025 `context/foundation/prd.md:143-144`).
- Working-set filter `is_warmup = false` is the single source of truth for what counts (`src/lib/guided-workout/warmup-default.ts`, roadmap S-10).
- `SessionExerciseSummary` (`src/components/workout-sessions/SessionExerciseSummary.tsx`) is session-scoped — reuse its table styling as reference, not as a drop-in.

## What We're NOT Doing

- No trainer-facing stats view (client-only per S-12; trainer readout stays in S-07 surfaces).
- No schema changes, new columns, or new RLS policies.
- No charts/graphs or trend lines — tabular history only (trend comparison is post-MVP per PRD FR-026 note).
- No stats for warm-up sets, and no cross-exercise/whole-program aggregates.
- No RPE analytics (RPE stays display-only in session readouts; S-21 owns it).
- No new API route — pages fetch server-side and hand data to the island; expand/collapse is client-side over already-loaded data.
- No new shadcn primitives; follow the existing raw-`<table>` + Tailwind convention.

## Implementation Approach

Three vertical layers, each independently verifiable:

1. **Calculation core** — a pure, well-tested util that turns a set of working `set_logs` into per-session aggregates (top set, Epley 1RM, tonnage) and all-time bests, metric-aware. No I/O.
2. **Service layer** — cross-session Supabase queries scoped to the caller: list of logged exercises, and full history for one exercise. Compose the calc core into serializable view models. Covered by an RLS/service integration test.
3. **UI layer** — two client pages (`/client/exercises` list, `/client/exercises/[exerciseId]` detail) + the `ExerciseStatsView` island for the metric-adaptive, expandable table, plus the Topbar nav item.

## Phase 1: Statistics calculation core

### Overview

Create a pure calculation module that computes per-session aggregates and all-time bests from working set logs, metric-aware, with no Supabase dependency. Fully unit-tested.

### Changes Required:

#### 1. Stats calculation util

**File**: `src/lib/exercise-stats/calculations.ts`

**Intent**: Provide pure functions to compute a single set's estimated 1RM (Epley) and volume, aggregate a session's working sets into `{ topSet, bestEstimated1RM, totalVolumeKg, workingSetCount, ... }`, and reduce many sessions into an all-time best 1RM / best volume. 1RM and tonnage are only produced when `load_kg > 0` and `reps` is present; time/bodyweight sets contribute set/rep/duration counts only.

**Contract**:
- `EPLEY` estimate: `estimateOneRepMax(loadKg, reps): number | null` — returns `load × (1 + reps/30)`; `null` when `loadKg == null || loadKg <= 0 || reps == null || reps < 1`.
- `computeSetVolume(loadKg, reps): number | null` — `load × reps` when both present and `load > 0`, else `null`.
- `SessionStat` view type: `{ sessionId; scheduledDate; loggedAt; workingSetCount; topSet: { reps; loadKg; durationSeconds } | null; estimated1RM: number | null; totalVolumeKg: number | null; totalReps: number; totalDurationSeconds: number }`.
- `aggregateSessionStats(sets, metric): SessionStat` and `summarizeExerciseHistory(sessions, metric): { allTimeBest1RM; bestSessionVolumeKg; sessionCount; ... }`.
- "Top set" = the working set with the highest `estimateOneRepMax` for weighted metrics; for time metric, the longest `duration_seconds`; ties broken by higher load then reps.

#### 2. Colocated unit tests

**File**: `src/lib/exercise-stats/calculations.test.ts`

**Intent**: Table-driven Vitest tests mirroring `edit-window.test.ts` structure (local factory helpers, no mocks) covering Epley math, volume, null/bodyweight/time handling, top-set selection, empty input, and all-time best reduction.

**Contract**: Assert exact Epley values (e.g. `100 × (1 + 5/30) = 116.67`, rounding rule fixed in the util), tonnage sums, and that bodyweight (load 0) and time sets yield `null` 1RM/volume.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Unit tests pass: `npx vitest run src/lib/exercise-stats/calculations.test.ts`

#### Manual Verification:

- Spot-check a couple of Epley values against a hand calculation.

---

## Phase 2: Exercise-stats service layer

### Overview

Add cross-session, client-scoped Supabase queries: (a) list distinct exercises the client has logged working sets for, and (b) load one exercise's full working-set history grouped by session. Compose Phase 1 aggregates into serializable view models. Verify client isolation and correctness with an integration test.

### Changes Required:

#### 1. Stats service

**File**: `src/lib/exercise-stats/service.ts`

**Intent**: Two query functions following the `{ data, error }` convention, joining `set_logs → session_exercises → exercises` and `→ workout_sessions → client_plans`, filtered to `is_warmup = false` and `client_plans.client_id = clientId`.

**Contract**:
- `listLoggedExercisesForClient(supabase, clientId): Promise<{ data: LoggedExerciseSummary[] | null; error: string | null }>` where `LoggedExerciseSummary = { exerciseId; name; defaultMetric; lastLoggedAt; sessionCount; loggedSetCount }`, sorted by `lastLoggedAt` desc. Derived in app code from the flat rows (distinct by `exercise_id`).
- `getExerciseHistoryForClient(supabase, clientId, exerciseId): Promise<{ data: ExerciseHistory | null; error: string | null }>` where `ExerciseHistory = { exercise: { id; name; defaultMetric }; sessions: SessionStat[]; summary }`. Returns `null` data (no error) when the client has no logged working sets for that exercise (drives 404/empty state). Sessions sorted most-recent-first; per-session sets passed through Phase 1 `aggregateSessionStats`.
- Query mirrors the nested-select pattern in `src/lib/workout-sessions/service.ts:222-229`; select working columns from `set_logs` plus nested `session_exercises(exercise_id, exercises(id,name,default_metric), workout_sessions(id, scheduled_date, completed_at, client_plans(client_id)))`, `.eq("is_warmup", false)`, and for the detail query `.eq("session_exercises.exercise_id", exerciseId)`.

#### 2. Integration test

**File**: `tests/integration/exercise-stats/exercise-stats.test.ts`

**Intent**: Seed a trainer + two clients, log working (and one warm-up) set across ≥2 sessions for one exercise via the existing session-graph helpers, then assert the service returns correct per-session aggregates for the owning client and **empty/other-client isolation** (client B sees none of client A's history).

**Contract**: Follows `tests/integration/workout-sessions/client-session-readout.test.ts` — authenticated Supabase clients, `createTrainer`/`createClient_`, direct service calls; assert working-set-only counting (warm-up excluded), Epley 1RM, tonnage, and cross-client isolation (`data` empty for the non-owner).

### Success Criteria:

#### Automated Verification:

- Type checking / lint passes: `npm run lint`
- Unit tests still pass: `npx vitest run`
- Integration test passes: `npm run test:integration -- exercise-stats` (requires local Supabase per AGENTS.md)

#### Manual Verification:

- With local Supabase seeded, confirm `getExerciseHistoryForClient` returns expected rows for a seeded client.

---

## Phase 3: Client stats pages, table UI, and navigation

### Overview

Expose the feature: a `/client/exercises` list page, a `/client/exercises/[exerciseId]` detail page rendering the metric-adaptive, expandable history via a new `ExerciseStatsView` island, and an "Exercises" item in the client Topbar nav.

### Changes Required:

#### 1. Client exercises list page

**File**: `src/pages/client/exercises/index.astro`

**Intent**: SSR page (guard client, `prerender = false`) that calls `listLoggedExercisesForClient` and renders a list of links to each exercise's stats page, each showing name, metric, last-logged date, and session count. Empty state when the client has logged nothing yet. Mirror `src/pages/client/plan.astro` structure (create client, redirect if no user, layout + heading). Static list → plain Astro markup, no island needed.

**Contract**: Route `/client/exercises`; each row links to `/client/exercises/{exerciseId}`.

#### 2. Client exercise stats detail page

**File**: `src/pages/client/exercises/[exerciseId].astro`

**Intent**: SSR page that validates the `exerciseId` param (zod uuid, mirroring `[sessionId].astro`), calls `getExerciseHistoryForClient`, redirects to `/client/exercises` (or shows not-found) when data is `null`, and passes the history to `ExerciseStatsView client:load`.

**Contract**: Route `/client/exercises/:exerciseId`; passes `history: ExerciseHistory` prop.

#### 3. Stats view island

**File**: `src/components/exercise-stats/ExerciseStatsView.tsx`

**Intent**: React island rendering the headline all-time estimated 1RM (weighted only, with "estimated" label + >10-rep caveat text), then the per-session history table with expand/collapse per row to reveal that session's individual working sets. Columns adapt to `history.exercise.defaultMetric`. Reuse `SessionExerciseSummary` table styling (raw `<table>` + Tailwind, `rounded-2xl border border-white/10 bg-white/5` card).

**Contract**: Props `{ history: ExerciseHistory }`. Formats loads/reps/duration consistently with existing display helpers (`src/lib/guided-workout/format-prescription.ts` conventions); 1RM/volume columns hidden for `time` metric and for bodyweight sessions.

#### 4. Topbar nav item

**File**: `src/components/Topbar.astro`

**Intent**: Add `{ href: "/client/exercises", label: "Exercises" }` to `clientNav` (`:33-36`). Active-state highlighting already handled by `isActive`.

**Contract**: Client nav becomes Dashboard · My Plan · Exercises.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`
- Full unit suite passes: `npx vitest run`

#### Manual Verification:

- As a client with logged sessions: "Exercises" appears in nav, `/client/exercises` lists logged exercises, a detail page shows correct per-session rows, expand reveals working sets, and time/bodyweight exercises hide 1RM/tonnage.
- As a client, direct-navigating to another client's exercise id shows the empty/not-found path (no data leak).
- Layout is usable one-handed on a narrow (phone) viewport.

---

## Testing Strategy

### Unit Tests:

- `calculations.test.ts`: Epley values, volume, null/bodyweight/time handling, top-set selection, all-time-best reduction, empty input.

### Integration Tests:

- `exercise-stats.test.ts`: working-set-only aggregation across sessions, warm-up exclusion, correct 1RM/tonnage, and cross-client RLS isolation.

### Manual Testing Steps:

1. Seed/log ≥2 sessions of a weighted exercise as a client; open its stats page; verify per-session rows, Epley 1RM, and Σ(reps×load) volume.
2. Log a time-based exercise; verify duration columns and hidden 1RM/tonnage.
3. Log a bodyweight (load 0) set; verify no 1RM/tonnage, reps/set counts shown.
4. Confirm warm-up sets are excluded from all figures.
5. Attempt to view another client's exercise stats by id — confirm no data.

## Performance Considerations

The history query is bounded by one client's logged sets for one exercise; the list query by the client's total logged sets. Both are small for MVP data volumes. If history grows, an index on `session_exercises(exercise_id)` would help (roadmap risk `context/foundation/roadmap.md:224`) — out of scope now.

## Migration Notes

None — read-only over existing tables and RLS.

## References

- Roadmap slice: `context/foundation/roadmap.md:287-297`
- PRD: `context/foundation/prd.md:139-146` (FR-024/025/026)
- Linear: ZAW-17
- Nested-select pattern: `src/lib/workout-sessions/service.ts:222-229`
- Pure-util + test pattern: `src/lib/guided-workout/edit-window.ts`, `edit-window.test.ts`
- SSR page → island: `src/pages/client/plan.astro`
- Table styling reference: `src/components/workout-sessions/SessionExerciseSummary.tsx`
- Integration test pattern: `tests/integration/workout-sessions/client-session-readout.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Statistics calculation core

#### Automated

- [x] 1.1 Type checking passes: `npm run lint`
- [x] 1.2 Unit tests pass: `npx vitest run src/lib/exercise-stats/calculations.test.ts`

#### Manual

- [ ] 1.3 Spot-check Epley values against a hand calculation

### Phase 2: Exercise-stats service layer

#### Automated

- [ ] 2.1 Type checking / lint passes: `npm run lint`
- [ ] 2.2 Unit tests still pass: `npx vitest run`
- [ ] 2.3 Integration test passes: `npm run test:integration -- exercise-stats`

#### Manual

- [ ] 2.4 Confirm `getExerciseHistoryForClient` returns expected rows for a seeded client

### Phase 3: Client stats pages, table UI, and navigation

#### Automated

- [ ] 3.1 Lint passes: `npm run lint`
- [ ] 3.2 Production build succeeds: `npm run build`
- [ ] 3.3 Full unit suite passes: `npx vitest run`

#### Manual

- [ ] 3.4 Client nav + list + detail + expand behave correctly with logged data
- [ ] 3.5 Time/bodyweight exercises hide 1RM/tonnage
- [ ] 3.6 Another client's exercise id shows empty/not-found (no data leak)
- [ ] 3.7 Usable one-handed on a narrow (phone) viewport
