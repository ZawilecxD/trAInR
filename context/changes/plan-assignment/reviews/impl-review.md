<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Plan Assignment (S-04)

- **Plan**: context/changes/plan-assignment/plan.md
- **Scope**: All 4 phases (full plan)
- **Date**: 2026-06-12
- **Verdict**: NEEDS ATTENTION → triaged; all critical/warnings addressed
- **Findings**: 0 critical  6 warnings  4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — TOCTOU race in update_workout_session_snapshot

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260608130000_workout_session_rpcs.sql (update RPC)
- **Detail**: The RPC reads status/started_at once, then deletes all session_exercises and re-inserts. No SELECT FOR UPDATE lock is held between the guard check and the destructive rewrite. A client starting a workout concurrently could set started_at after the guard passes but before the delete, wiping a live session's exercises.
- **Fix A ⭐ Recommended**: Add `SELECT … FOR UPDATE` before the guard
  - Approach: Open with `SELECT status, started_at FROM workout_sessions WHERE id = p_session_id FOR UPDATE`, re-check the guard, then proceed.
  - Strength: Standard pattern for guard-then-mutate in PL/pgSQL; removes the race class entirely with minimal code change.
  - Tradeoff: Serializes concurrent writes to same session row. Negligible — trainer edits are single-user.
  - Confidence: HIGH — identical pattern is safe and idiomatic.
  - Blind spot: None significant.
- **Fix B**: Accept the current risk and defer to S-06
  - Approach: Document the race in migration comments; fix when S-06 adds proper locking architecture.
  - Strength: MVP scope; concurrent trainer edit + client start is vanishingly unlikely now.
  - Tradeoff: Leaves a real data-loss bug that will recur at S-06 and doubles the work.
  - Confidence: MED — acceptable for current scale, not for production.
  - Blind spot: S-06 will need this anyway.
- **Decision**: FIXED via Fix A — supabase/migrations/20260612131600_fix_rpc_row_locking.sql

### F2 — TOCTOU race in delete_workout_session

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260608130000_workout_session_rpcs.sql (delete RPC)
- **Detail**: Same pattern as F1 — started_at checked without row lock before the cascade delete. Risk is lower than F1 (delete vs. data rewrite) but the guard can still be bypassed.
- **Fix**: Add `SELECT … FOR UPDATE` before the started_at/status check in delete_workout_session.
- **Decision**: FIXED — supabase/migrations/20260612131600_fix_rpc_row_locking.sql

### F3 — Silent error absorption in ClientPlanHub.fetchSessions

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/plans/ClientPlanHub.tsx (~line 43–50)
- **Detail**: fetchSessions returns [] on any non-OK HTTP response. Auth failures, 403s, and 500s all silently produce "No sessions yet" on the calendar — trainer cannot distinguish real empty month from error.
- **Fix**: Check response.ok and surface an error state, matching plan.astro's loadError pattern.
- **Decision**: FIXED — src/components/plans/ClientPlanHub.tsx

### F4 — selectedDate not clamped on month navigation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/plans/ClientPlanHub.tsx (~line 78–88)
- **Detail**: handleMonthChange updates the visible month and fetches sessions but does not update selectedDate. After navigating months the day panel shows the old selected day while the calendar shows a different month — "No sessions on this day" appears incorrectly.
- **Fix**: On month change, reset selectedDate to the 1st of the new month (or same day-of-month clamped to the month's length).
- **Decision**: FIXED — src/components/plans/ClientPlanHub.tsx

### F5 — Unbounded date range in listSessionsQuerySchema

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/workout-sessions/schemas.ts (~line 45–49)
- **Detail**: from/to date pair validated for format but not for from ≤ to or a maximum span. A crafted request can load arbitrarily wide session ranges in one query.
- **Fix**: Add a .refine() check: from ≤ to and (to - from) ≤ 366 days.
- **Decision**: FIXED — src/lib/workout-sessions/schemas.ts

### F6 — No max exercise count in RPC or API body schema

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260608130000_workout_session_rpcs.sql + src/lib/workout-sessions/schemas.ts
- **Detail**: Sets per exercise are capped at 20 but the exercises array has no upper bound. A large payload triggers many sequential DB inserts.
- **Fix**: Add max(exercises, 50) in sessionExerciseInputSchema's parent array and a jsonb_array_length guard in the create/update RPCs.
- **Decision**: FIXED — src/lib/workout-sessions/schemas.ts + supabase/migrations/20260612131600_fix_rpc_row_locking.sql

### F7 — SessionExercise.sets typed as optional in types.ts

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/types.ts (SessionExercise interface)
- **Detail**: Plan specified sets: SessionExerciseSet[] (required). Implementation has sets?: SessionExerciseSet[] (optional). Service always populates sets, so no runtime null-access risk, but callers can reference SessionExercise without sets without a type error.
- **Fix**: Change sets? to sets in SessionExercise, or add SessionExerciseWithSets overloaded type matching the TemplateExercise pattern.
- **Decision**: DISMISSED — sets is already required in the current file; drift agent read an earlier state.

### F8 — ClientPlanHub unplanned extraction

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/plans/ClientPlanHub.tsx
- **Detail**: ClientPlanHub not described in plan; absorbs interactive calendar/day panel/CTA responsibilities. Better Astro SSR architecture, not scope creep, but plan.md doesn't document the split.
- **Fix**: Add addendum note to plan.md or change.md documenting the React island extraction.
- **Decision**: FIXED — context/changes/plan-assignment/change.md (addendum added)

### F9 — [id].ts missing isTrainerAssignedToClient check

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/workout-sessions/[id].ts
- **Detail**: index.ts verifies active trainer–client assignment before GET/POST. [id].ts does not, relying on RLS and RPC ownership checks alone (which are sufficient). The inconsistency produces different 403 vs 404 semantics and a less uniform guard layer.
- **Fix**: Add isTrainerAssignedToClient check on [id].ts GET/PATCH/DELETE for defense-in-depth consistency.
- **Decision**: SKIPPED — RLS and RPC ownership checks are sufficient.

### F10 — Raw DB message exposed in fallthrough RPC errors

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/workout-sessions/rpc-errors.ts (~line 33)
- **Detail**: Unrecognized Postgres/RPC errors fall through to { status: 500, code: "rpc_failed" } with raw DB error message in the API response. Can leak schema/function names.
- **Fix**: Strip raw message from 500 responses; log server-side only. Return generic "Internal server error" to client.
- **Decision**: FIXED — src/pages/api/workout-sessions/[id].ts + index.ts
