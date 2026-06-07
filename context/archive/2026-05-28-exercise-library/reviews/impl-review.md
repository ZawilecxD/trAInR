<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: S-01 Exercise Library

- **Plan**: context/changes/exercise-library/plan.md
- **Scope**: Full plan (Phases 1–3)
- **Date**: 2026-05-29
- **Verdict**: APPROVED
- **Findings**: 0 critical · 2 warnings · 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — Non-atomic muscle group replacement

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/exercises/service.ts:42–66
- **Detail**: replaceMuscleGroups performed DELETE then INSERT as two separate operations. If insert failed after delete succeeded, muscle group associations were permanently lost with no recovery path in updateExercise.
- **Fix A ⭐ Recommended**: Wrap delete+insert in an RPC transaction
  - Strength: Guarantees atomicity at DB layer; matches existing RLS-as-authority pattern.
  - Tradeoff: Adds one migration + Supabase RPC function.
  - Confidence: HIGH — standard Postgres transactional pattern.
  - Blind spot: Supabase JS client doesn't expose native transaction API.
- **Fix B**: Add client-side rollback in updateExercise
  - Strength: No migration needed; re-inserts previous muscle groups on failure.
  - Tradeoff: Requires caching previous state; rollback itself can fail.
  - Confidence: MEDIUM — compensating actions aren't as reliable as atomic DB transactions.
- **Decision**: FIXED via Fix A — added `replace_exercise_muscle_groups` RPC (migration `20260529183853`) and updated service.ts to call it.

### F2 — Unguarded response.json() in error paths

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/exercises/ExerciseForm.tsx:116, 158, 195
- **Detail**: When the API responded with non-2xx, code called response.json() without try/catch. Non-JSON bodies (gateway timeout, 502) threw unhandled exceptions, leaving the form silently unresponsive.
- **Fix**: Wrap each response.json() in try/catch via safeJsonParse helper; fall back to generic error message on parse failure.
- **Decision**: FIXED — added safeJsonParse helper, replaced all three call sites.

### F3 — No safety limit on list query

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/exercises/service.ts:92–110
- **Detail**: listExercises has no .limit() on the Supabase query. Plan explicitly excludes "advanced pagination" but a safety cap would prevent unexpectedly large result sets.
- **Fix**: Add .limit(200) to query builder chain.
- **Decision**: ACCEPTED — deferred to roadmap as simple pagination feature.
