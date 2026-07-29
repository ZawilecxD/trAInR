<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Exercise Statistics (S-12)

- **Plan**: `context/changes/exercise-statistics/plan.md`
- **Scope**: Full plan (Phases 1–3 of 3)
- **Date**: 2026-07-18
- **Verdict**: APPROVED
- **Findings**: 0 critical · 1 warning · 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS (F1 hardening applied) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS (automated) — integration + manual pending environment |

## Findings

### F1 — client_id scoping lacked app-layer defense-in-depth

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/exercise-stats/service.ts (resolveRow + both query filters)
- **Detail**: Client scoping relied solely on the nested embed filter `.eq("session_exercises.workout_sessions.client_plans.client_id", clientId)` plus RLS, while `exerciseId` already had an app-layer post-filter. If ever reused with a trainer session (who can read many clients' set_logs via `can_access_client_plan`), the embed filter would be the only separation.
- **Fix**: Carry `client_id` through `resolveRow` and post-filter `row.clientId === clientId` in both functions, mirroring the `exerciseId` guard.
- **Decision**: FIXED — commit 112f8c3.

### F2 — Unbounded history query

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🔎 MEDIUM
- **Dimension**: Safety & Quality (Performance)
- **Location**: src/lib/exercise-stats/service.ts (listLoggedExercisesForClient)
- **Detail**: Fetches every working-set row the client has logged, then groups in app. Single query (no N+1), acceptable for MVP volumes; no pagination. Roadmap already flags an `session_exercises(exercise_id)` index as future work.
- **Fix**: None now; consider a DB-side aggregate/RPC or pagination if lifetime history grows large.
- **Decision**: ACCEPTED (out of scope per plan Performance section).

### F3 — Two date formatters

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: src/pages/client/exercises/index.astro (formatLoggedAt) vs src/components/exercise-stats/ExerciseStatsView.tsx (formatDate)
- **Detail**: One parses a timestamptz, the other a `YYYY-MM-DD` string; different inputs justify different handling, but a shared `src/lib/dates` helper would avoid drift.
- **Fix**: Optional consolidation into `src/lib/dates`.
- **Decision**: SKIPPED (inputs differ; low value).

### F4 — Cosmetic plan-vs-impl deviations

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: src/lib/exercise-stats/calculations.ts
- **Detail**: `summarizeExerciseHistory` dropped the unused `metric` param; `aggregateSessionStats` takes a `SessionStatInput` wrapper; extra exported helper `metricSupportsLoad`. All benign refinements; no behavioral drift.
- **Fix**: None.
- **Decision**: ACCEPTED.

### F5 — SHAs cited to Linear before branch push

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Process
- **Location**: ZAW-17 phase-complete comments
- **Detail**: Per `context/foundation/lessons.md` ("Verify commit on remote before citing SHAs externally"), phase SHAs were posted to Linear while `s-12-exercise-statistics` is not yet pushed. Commits are real and local; the branch should be pushed so the cited SHAs resolve on the remote.
- **Fix**: Push the branch (`git push -u origin s-12-exercise-statistics`).
- **Decision**: PENDING — awaiting user (push not performed autonomously).

## Success Criteria Status

- Automated: `npm run lint` clean · `npm run build` succeeds · `npx vitest run` 208 pass (incl. 13 new calc tests).
- Pending environment: `npm run test:integration -- exercise-stats` (local Supabase/Docker); manual UI walkthrough (3.4–3.7).
