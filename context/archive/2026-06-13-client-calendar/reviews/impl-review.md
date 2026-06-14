<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Client Calendar (S-05)

- **Plan**: context/changes/client-calendar/plan.md
- **Scope**: All Phases (1–4 of 4)
- **Date**: 2026-06-13
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical · 2 warnings · 5 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Findings

### F1 — Stale fetch race in calendar navigation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/components/plans/ClientCalendarHub.tsx:82–131
- **Detail**: `loadSessions` had no request sequencing guard. Fast prev/next taps could let an older fetch resolve after a newer one, overwriting sessions state with stale data.
- **Fix A ⭐ Applied**: Added monotonic request counter (`requestRef`). Increments on each nav action; responses whose id ≠ latest are discarded. Zero layout impact, idiomatic React.
- **Decision**: FIXED via Fix A

### F2 — Silent 200 + empty list when session invalidated post-guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/lib/workout-sessions/service.ts:126–128
- **Detail**: `listMySessionsAsClient` returned `{ data: [], error: null }` when `getUser()` yielded no user — API sent 200 with empty sessions instead of 401. Superseded by F6 fix (userId now threaded from guard; internal `getUser()` removed entirely).
- **Decision**: FIXED (resolved by F6)

### F3 — week-view extraction placed in src/lib/ instead of src/components/hooks/

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/week-view.ts
- **Detail**: Plan said "extract to `src/components/hooks/`"; pure utility functions correctly landed in `src/lib/`.
- **Decision**: ACCEPTED-AS-RULE: Distinguish utility extraction from hook extraction in plans

### F4 — listMySessionsAsClient used getUser() instead of query-time auth.uid()

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/workout-sessions/service.ts:117–128
- **Detail**: Plan described relying on `auth.uid()` at query time; implementation called `auth.getUser()` explicitly. Root cause of F2; resolved by F6 fix (userId now an explicit param).
- **Decision**: ACCEPTED-AS-RULE: Thread userId from the guard into service functions rather than re-calling getUser()

### F5 — statusLabel / statusBadgeClass duplicated across 3 components

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: ClientCalendarHub.tsx:21–41, ClientWeekView.tsx:13–33, ClientPlanHub.tsx:21–41
- **Detail**: Lookup maps copy-pasted in three sibling components.
- **Fix**: Extracted to `src/lib/session-status.ts` (`sessionStatusLabel`, `sessionStatusBadgeClass`); all three components updated to import from the shared module.
- **Decision**: FIXED

### F6 — guard.userId unused; service made a second auth round-trip

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/client/sessions.ts:11–12
- **Detail**: `requireClient` returned `userId` but route discarded it; service re-called `auth.getUser()` internally (redundant round-trip, edge-case silent failure). Trainer pattern passes `userId` explicitly.
- **Fix**: Added `userId: string` param to `listMySessionsAsClient`; removed internal `getUser()` call; route now passes `guard.userId`; `plan.astro` passes `Astro.locals.user.id`.
- **Decision**: FIXED

### F7 — Inline isoDateSchema in plan.astro rather than shared utility

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/client/plan.astro:9
- **Detail**: Local regex defined in two Astro pages; already existed (unexported) in `schemas.ts`.
- **Fix**: Exported `isoDateSchema` from `src/lib/workout-sessions/schemas.ts`; both Astro pages now import it.
- **Decision**: FIXED
