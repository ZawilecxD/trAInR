<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Prescription Fill Logging

- **Plan**: `context/changes/prescription-fill-logging/plan.md`
- **Scope**: Full implemented code paths currently verifiable in this workspace
- **Date**: 2026-07-01
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Edit-list set-log transitions lacked flush protection

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/components/guided-workout/GuidedWorkoutHub.tsx`
- **Detail**: `SessionEditList` used the same debounced set-log rows but was rendered outside `SetLogFlushContext.Provider`, so edit-list navigation/completion/restart could unmount pending saves.
- **Fix**: Wrapped edit-list mode in the flush provider and guarded Calendar, Continue, exercise jump, restart, and completion transitions through `runGuardedTransition`.
  - Strength: Reuses the existing S-06 quick-navigation safety pattern.
  - Tradeoff: Calendar navigation is now programmatic after flush rather than a plain anchor.
  - Confidence: HIGH — focused unit/lint checks pass; E2E execution is environment-blocked here.
  - Blind spot: Browser E2E should confirm edit-list quick navigation when local Supabase is available.
- **Decision**: FIXED

### F2 — Delete could race with a pending save

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/components/guided-workout/SetLogRow.tsx`
- **Detail**: The row cancelled pending saves after awaiting DELETE, which left a window for a pending debounce to fire and recreate the deleted row.
- **Fix**: Cancel pending saves before DELETE and disable delete while `status === "saving"`.
- **Decision**: FIXED

### F3 — Reps and duration accepted invalid negative values

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/lib/set-logs/schemas.ts`
- **Detail**: `reps` and `duration_seconds` accepted negative integers even though set logging should only accept positive counts/durations.
- **Fix**: Added `.min(1)` validation for reps/duration and matching `min={1}` input constraints. Negative `load_kg` remains allowed for assisted exercises.
- **Decision**: FIXED

### F4 — Overlapping autosaves can still persist stale data out of order

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: `src/components/hooks/useDebouncedSetLogSave.ts`
- **Detail**: The existing generation guard prevents stale responses from updating React state, but it does not serialize writes at the database boundary if an older in-flight PUT lands after a newer PUT.
- **Fix**: Add a follow-up to serialize per-row saves or queue latest-only writes behind the current request.
  - Strength: Solves the underlying write-order class rather than patching one UI path.
  - Tradeoff: Needs careful hook-level tests with delayed/reordered fetches.
  - Confidence: MEDIUM — behavior is plausible from current hook code, but not newly introduced by S-19.
  - Blind spot: No hook test harness exists yet.
- **Decision**: FOLLOW-UP

### F5 — Locked-session protection is API-only

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: `supabase/migrations/20260526120400_sessions_logging_comments.sql`
- **Detail**: The set-log service rejects writes for locked sessions, but direct Supabase RLS policies do not appear to include `locked_at` predicates for insert/update/delete.
- **Fix**: Add a follow-up migration/RLS hardening slice with tests for locked-session insert/update/delete denial.
  - Strength: Enforces the invariant at the database boundary.
  - Tradeoff: Requires schema policy changes outside S-19's no-migration scope.
  - Confidence: MEDIUM — based on migration review; integration execution was blocked here.
  - Blind spot: Needs confirmation against a running Supabase instance.
- **Decision**: FOLLOW-UP

### F6 — Distance exercises remain unsupported for logging

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: `src/lib/set-logs/service.ts`
- **Detail**: `distance` remains an `ExerciseMetric`, but the service rejects distance logging. S-19 does not implement distance fill/logging.
- **Fix**: Keep out of scope for S-19; decide later whether to implement distance logging or hide/disable distance set-log controls consistently.
- **Decision**: FOLLOW-UP

## Verification Summary

- Passed: full unit suite (`npm test`) — 20 files, 181 tests.
- Passed: scoped lint for all S-19 touched files.
- Passed: Playwright spec discovery for the updated quick-navigation spec and new prescription-fill spec.
- Blocked: integration and E2E execution because this workspace lacks Docker/local Supabase and required `INTEGRATION_SUPABASE_*` variables.
- Failed baseline: full `npm run lint` due unrelated type-aware lint errors in `src/lib/supabase.ts`, `src/middleware.ts`, and `src/pages/auth/confirm-email.astro`.
