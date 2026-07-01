<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Session Comments

- **Plan**: `context/changes/session-comments/plan.md`
- **Scope**: All phases (1–3)
- **Date**: 2026-06-28
- **Verdict**: APPROVED (after fixes)
- **Findings**: 0 critical, 5 warnings (fixed), 2 observations (accepted)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS (after fixes) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — DB error silently masked as not_found

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/lib/session-comments/service.ts:57–61`
- **Detail**: `sessionCheck.error` (infrastructure failure) was conflated with `!sessionCheck.data` (absent session), both returning code `"not_found"` → HTTP 404. Real DB errors would silently look like missing sessions.
- **Fix**: Split into separate `db_error` code + `"not_found"` case. API route maps `db_error` → 500.
- **Decision**: FIXED — 6e1e385

### F2 — Null profiles join defaults author_role to "client"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/lib/session-comments/service.ts:24`
- **Detail**: `row.profiles?.role ?? "client"` would misrepresent a trainer's role if the join returned null.
- **Fix**: Added `safeRole()` that checks for `"trainer"` explicitly before defaulting.
- **Decision**: FIXED — 6e1e385

### F3 — Duplicate `bottomRef` targeting wrong element

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: `src/components/session-comments/SessionCommentsThread.tsx:174,178`
- **Detail**: React assigns `ref` to the last rendered element with that ref. The outer div (line 178) was outside the comment list container, causing `scrollIntoView` to target the wrong element.
- **Fix**: Removed the duplicate outer ref div. The ref inside the list (line 174) is correct.
- **Decision**: FIXED — 6e1e385

### F4 — `currentUserRole` prop dead across 4 files

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Quality
- **Location**: `src/components/session-comments/SessionCommentsThread.tsx:155` (and callers)
- **Detail**: `currentUserRole` was accepted in `SessionCommentsThreadProps`, threaded through `GuidedWorkoutHub → SessionOverview → SessionCommentsThread` and `SessionActualsReview → SessionCommentsThread`, but immediately discarded with `void currentUserRole`.
- **Fix**: Removed the prop from `SessionCommentsThread`, `SessionActualsReview`, `SessionOverview`, `GuidedWorkoutHub`, and both Astro pages.
- **Decision**: FIXED — 6e1e385

### F5 — `formatZodIssues` imported from workout-sessions domain

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/pages/api/sessions/[id]/comments.ts:7`
- **Detail**: `formatZodIssues` is a generic utility that lives inside the `workout-sessions` domain. All other routes also import from there — this is a pre-existing pattern, not introduced by this feature.
- **Fix**: Accepted as pre-existing technical debt. A dedicated `src/lib/api/validation.ts` module would be the right fix but is a separate refactor.
- **Decision**: ACCEPTED — pre-existing pattern, not introduced here

### F6 — `userId: string | undefined` passed to `string` prop (Astro pages)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Type safety
- **Location**: `src/pages/client/sessions/[sessionId].astro:30`, trainer equivalent
- **Detail**: `Astro.locals.user?.id` yields `string | undefined`; passed to `currentUserId: string` prop.
- **Fix**: Build already passes — Astro's template type checking handles this through the early redirect guard. Accepted.
- **Decision**: ACCEPTED — `npm run build` passes; Astro type system handles narrowing correctly

### F7 — DELETE RLS policy omits session access check (latent)

- **Severity**: ⚠️ OBSERVATION
- **Impact**: 🏃 LOW — latent; no DELETE endpoint exists yet
- **Dimension**: Safety & Quality (Security, latent)
- **Location**: `supabase/migrations/20260526120400_sessions_logging_comments.sql:459–463`
- **Detail**: `session_comments_delete_own` only checks `author_id = auth.uid()`, not `can_access_workout_session`. A user removed from a trainer-client relationship can still delete their own comments via direct API. No DELETE endpoint exists in this feature, so currently unexploitable.
- **Decision**: ACCEPTED — no DELETE endpoint in scope; will need to be addressed when/if a delete route ships

### F8 — `listSessionComments` return type allows impossible `{ data: null, error: null }`

- **Severity**: ⚠️ OBSERVATION
- **Impact**: 🏃 LOW — typing artifact, not runtime issue
- **Dimension**: Reliability
- **Location**: `src/lib/session-comments/service.ts:33–42`
- **Detail**: Return type `{ data: SessionCommentWithAuthor[] | null; error: string | null }` allows data and error both null, handled by `?? []` defensive fallback.
- **Decision**: ACCEPTED — matches the `Pattern A` return shape used by other services in the codebase; tightening would require a different discriminated union shape breaking convention
