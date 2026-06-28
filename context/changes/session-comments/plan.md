# Session Comments (S-09) Implementation Plan

## Overview

Implement FR-023: client and trainer can leave and read comments on a training session (bidirectional thread per session). The `session_comments` table, RLS policies, TypeScript type, and integration tests already exist from F-01. This slice adds the service layer, REST API, and UI on client guided-workout and trainer session-review surfaces.

## Current State Analysis

| Layer | Status | Evidence |
| ----- | ------ | -------- |
| `session_comments` table + RLS | Done | `supabase/migrations/20260526120400_sessions_logging_comments.sql` |
| `SessionComment` type | Done | `src/types.ts:171-178` |
| RLS integration tests | Done | `tests/integration/rls/session-comments.test.ts` |
| Service / API / UI | **Missing** | No `src/lib/session-comments/`, no API routes, no React components |
| Trainer readout (S-07) | Deferred comments | `SessionActualsReview.tsx` — FR-028 gap |
| Client session view (S-06) | No comments | `SessionOverview.tsx` — design spec G2 |

### Key Discoveries:

- RLS grants SELECT to both roles via `can_access_workout_session`; INSERT requires `author_id = auth.uid()`; UPDATE/DELETE own rows only
- `session_exercises.notes` is per-exercise prescription text — not the session comment thread
- Set-logs pattern (`src/lib/set-logs/`, `src/pages/api/client/set-logs.ts`) is the closest mutation reference
- Design spec (`docs/stitch-ui-design-prompt.md` G2/H2): flat chronological thread, composer at bottom, author name + timestamp
- Pull-only — no notifications (PRD Non-Goal #5)

## Desired End State

On the client session overview (`/client/sessions/[id]`) and trainer session review (`/trainer/clients/[clientId]/sessions/[sessionId]` read-only mode), users see a chronological comment thread with author display name and role label. Each user can compose a new comment and edit/delete their own comments. Cross-tenant isolation is enforced by existing RLS.

Verification: trainer posts comment on client session → client sees it on session overview → client replies → trainer sees reply on session review → third-party trainer cannot access.

## What We're NOT Doing

- **Notifications** (email/push) — PRD Non-Goal #5
- **Nested/threaded replies** — flat chronological list per design G2
- **Real-time sync** — pull-only; refresh on post/edit/delete
- **Comments on ad-hoc sessions (S-16)** — parked; existing RLS would allow when S-16 lands
- **New DB migration** — table and RLS sufficient unless body length constraint needed at DB level (app-level zod max is enough for MVP)
- **Embedding comments in SSR session detail DTOs** — React island loads via API (set-logs pattern)

## Implementation Approach

Two phases: (1) service + shared API + schema unit tests, (2) shared `SessionCommentsPanel` React island wired into client `SessionOverview` and trainer `SessionActualsReview`. Add `requireAuthenticated` guard for role-agnostic session-scoped routes.

## Critical Implementation Details

**Shared API route:** Both trainer and client need comment CRUD on sessions they can access. A single `/api/sessions/[sessionId]/comments` route with `requireAuthenticated` (any logged-in role) delegates access control to RLS — avoids duplicating client/trainer API files.

**Author display:** Join `profiles(display_name, role)` when listing comments. Fall back to role label ("Trainer" / "Client") when display_name is empty.

**Bottom composer padding:** Client `SessionOverview` has a fixed bottom CTA bar — comments section must sit above it with adequate `pb-` spacing so the composer is not obscured.

---

## Phase 1: Service, API, and Schema Tests

### Overview

Add session-comments service and zod schemas, a role-agnostic REST API, and `requireAuthenticated` guard. Unit-test schemas.

### Changes Required:

#### 1. Authenticated guard

**File**: `src/lib/api/guards.ts`

**Intent**: Allow API routes that both trainer and client may call without role-specific guards.

**Contract**: Export `requireAuthenticated(context)` returning `{ ok: true, userId }` when `context.locals.user` exists; `401` otherwise.

#### 2. Session comments schemas

**File**: `src/lib/session-comments/schemas.ts` (new)

**Intent**: Validate API inputs for comment CRUD.

**Contract**: `sessionIdParamSchema` (uuid), `createCommentBodySchema` (`body`: trimmed string min 1 max 2000), `updateCommentBodySchema` (same body field), `commentIdParamSchema` (uuid). Export inferred types.

#### 3. Session comments service

**File**: `src/lib/session-comments/service.ts` (new)

**Intent**: Thin Supabase wrappers for list/create/update/delete; join author profile for display.

**Contract**:

- `SessionCommentWithAuthor` extends `SessionComment` with `author_display_name: string | null` and `author_role: UserRole`
- `listSessionComments(supabase, sessionId)` — select with `profiles(display_name, role)`, order `created_at asc`
- `createSessionComment(supabase, userId, sessionId, body)` — insert with `author_id: userId`
- `updateSessionComment(supabase, userId, commentId, body)` — update own row
- `deleteSessionComment(supabase, userId, commentId)` — delete own row
- Discriminated union results with `not_found` error code when RLS blocks or row missing

#### 4. Comments API route

**File**: `src/pages/api/sessions/[sessionId]/comments.ts` (new)

**Intent**: REST surface for comment CRUD accessible to both roles.

**Contract**: `export const prerender = false`. `GET` lists comments. `POST` creates. `PATCH` updates (body includes `comment_id`). `DELETE` removes (`comment_id` query param). Use `requireAuthenticated`, zod validation, `formatZodIssues`.

#### 5. Schema unit tests

**File**: `src/lib/session-comments/schemas.test.ts` (new)

**Intent**: Cover valid/invalid bodies and UUID params.

**Contract**: Mirror `src/lib/set-logs/schemas.test.ts` style.

#### 6. Guard unit test extension

**File**: `src/lib/api/guards.test.ts`

**Intent**: Cover `requireAuthenticated` success and 401 paths.

**Contract**: Add cases alongside existing trainer/client guard tests.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test -- src/lib/session-comments src/lib/api/guards.test.ts`
- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- `GET/POST/PATCH/DELETE` against `/api/sessions/{id}/comments` return expected JSON with authenticated client or trainer cookie session

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Session Comments UI

### Overview

Shared React island for the comment thread + composer; embed in client session overview and trainer session review.

### Changes Required:

#### 1. SessionCommentsPanel component

**File**: `src/components/session-comments/SessionCommentsPanel.tsx` (new)

**Intent**: Interactive comment thread with fetch-on-mount, optimistic post, edit/delete for own comments.

**Contract**: Props: `sessionId`, `currentUserId`. Fetches `GET /api/sessions/{sessionId}/comments`. Composer textarea + submit. Each row: author name, role badge, relative timestamp, body. Own comments show edit/delete actions. Use `cn()` for Tailwind classes; shadcn `Button`, `Textarea` if available.

#### 2. Client session overview integration

**File**: `src/components/guided-workout/SessionOverview.tsx`

**Intent**: Show comment thread on client session overview per design G2.

**Contract**: Accept `currentUserId` prop. Render `SessionCommentsPanel` below phase breakdown, above fixed bottom CTA. Adjust bottom padding so composer is reachable.

**File**: `src/components/guided-workout/GuidedWorkoutHub.tsx`

**Intent**: Pass `currentUserId` from hub to overview.

**Contract**: Add `currentUserId` to `GuidedWorkoutHubProps`; forward to `SessionOverview`.

**File**: `src/pages/client/sessions/[sessionId].astro`

**Intent**: Pass authenticated user id into the hub island.

**Contract**: `currentUserId={userId}` on `GuidedWorkoutHub`.

#### 3. Trainer session review integration

**File**: `src/components/workout-sessions/SessionActualsReview.tsx`

**Intent**: Show comment thread on trainer read-only session detail per FR-028 / design H2.

**Contract**: Accept `currentUserId` prop. Render `SessionCommentsPanel` below exercise actuals section.

**File**: `src/pages/trainer/clients/[clientId]/sessions/[sessionId].astro`

**Intent**: Pass trainer user id into review component.

**Contract**: `currentUserId={userId}` on `SessionActualsReview`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`
- Integration tests pass: `npm test` (full suite including existing RLS harness)

#### Manual Verification:

- Client opens session overview → sees empty thread → posts comment → sees it with own name
- Trainer opens same session review → sees client comment → replies
- Client refreshes → sees trainer reply
- User can edit and delete own comment; cannot modify other's comment

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Schema validation edge cases (empty body, over max length, invalid UUIDs)
- Guard returns 401 without user

### Integration Tests:

- Existing `session-comments.test.ts` RLS harness — no changes required unless post-removal assertion added (out of scope)

### Manual Testing Steps:

1. Log in as trainer, open client session review, post a comment
2. Log in as client, open same session, verify comment visible, post reply
3. Edit own comment on each side; verify other's comment has no edit/delete controls
4. Delete own comment; verify removed from thread

## Performance Considerations

Comment lists per session are expected to be small (dozens, not thousands). No pagination for MVP.

## Migration Notes

None — schema already deployed.

## References

- Roadmap S-09: `context/foundation/roadmap.md`
- RLS tests: `tests/integration/rls/session-comments.test.ts`
- Set-logs pattern: `src/lib/set-logs/service.ts`, `src/pages/api/client/set-logs.ts`
- Design: `docs/stitch-ui-design-prompt.md` G2, H2

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Service, API, and Schema Tests

#### Automated

- [x] 1.1 Unit tests pass: `npm test -- src/lib/session-comments src/lib/api/guards.test.ts`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Production build passes: `npm run build`

#### Manual

- [x] 1.4 `GET/POST/PATCH/DELETE` against `/api/sessions/{id}/comments` return expected JSON with authenticated client or trainer cookie session

### Phase 2: Session Comments UI

#### Automated

- [x] 2.1 Linting passes: `npm run lint`
- [x] 2.2 Production build passes: `npm run build`
- [x] 2.3 Integration tests pass: `npm test` (full suite including existing RLS harness)

#### Manual

- [x] 2.4 Client opens session overview → sees empty thread → posts comment → sees it with own name
- [x] 2.5 Trainer opens same session review → sees client comment → replies
- [x] 2.6 Client refreshes → sees trainer reply
- [x] 2.7 User can edit and delete own comment; cannot modify other's comment
