# Session Comments Implementation Plan

## Overview

Add bidirectional session comment threads — both client and trainer can post and read comments on any training session they have access to. The database layer (`session_comments` table + RLS policies + integration tests) already exists; this plan covers the service, API, and UI layers only.

## Current State Analysis

The `session_comments` table was created in `supabase/migrations/20260526120400_sessions_logging_comments.sql` with full RLS:
- `session_comments_select_via_session` — any authenticated user who can access the session can read its comments
- `session_comments_insert_author` — must set `author_id = auth.uid()` + session access
- `session_comments_update_own` / `session_comments_delete_own` — only the author

`src/types.ts` already has `SessionComment`. No service, API routes, or UI exist yet.

## Desired End State

After this plan is complete:
- Trainer opens a client's session detail → sees a "Comments" section at the bottom of the review with a scrollable thread and a text composer to post new comments
- Client opens a session (any mode: overview, edit-list) → sees the same "Comments" section below the content
- Comments are ordered chronologically (oldest first), showing author display name, role badge (Trainer / You), and creation timestamp
- Submitting a comment clears the composer and appends optimistically (or re-fetches) without page reload
- Edit and delete are out of scope for MVP; comments are append-only in the UI
- `npm run lint` and `npm run build` pass

### Key Discoveries:

- DB + RLS is **already shipped** — no migration needed (`20260526120400_sessions_logging_comments.sql`)
- RLS integration tests pass for cross-tenant isolation (`tests/integration/rls/session-comments.test.ts`)
- `shadcn/ui Textarea` component is **not yet installed** — needed for the composer
- Both roles need access to comments on the same session → use a single API route family at `/api/sessions/[id]/comments` with an authenticated-user guard (role-agnostic), relying on RLS for tenant isolation
- `profiles` join gives `display_name` and `role` for author attribution — needed in the list response
- `SessionActualsReview` (trainer) and `SessionOverview` + `SessionEditList` (client) are the three injection points

## What We're NOT Doing

- No edit or delete comment controls in the UI (MVP — append-only comments)
- No real-time updates or push notifications (Non-Goal #5)
- No pagination of comments (sessions are short; thread is bounded)
- No comments on ad-hoc sessions (S-16 is parked)
- No per-comment reactions or threading

## Implementation Approach

Three clean phases: (1) service + schemas, (2) shared API routes, (3) UI integration. The DB is already done, so each phase is self-contained and testable independently.

A single role-agnostic guard (`requireAuthenticated`) will be added to `src/lib/api/guards.ts` so that both trainer and client can reach the same comment endpoints — the RLS layer enforces tenant isolation from there.

## Phase 1: Service Layer

### Overview

Create `src/lib/session-comments/` with Zod schemas, a `SessionCommentWithAuthor` type, and service functions for list and create.

### Changes Required:

#### 1. New type in `src/types.ts`

**File**: `src/types.ts`

**Intent**: Add `SessionCommentWithAuthor` extending `SessionComment` with `author_display_name` and `author_role` so UI can render attributions without a second lookup.

**Contract**: New exported interface:

```typescript
export interface SessionCommentWithAuthor extends SessionComment {
  author_display_name: string;
  author_role: UserRole;
}
```

#### 2. Schemas

**File**: `src/lib/session-comments/schemas.ts`

**Intent**: Zod validation for the POST body (`{ body: string }`) and the session-id URL param (shared with the existing workout-sessions schema).

**Contract**:
- `createSessionCommentBodySchema` — `z.object({ body: z.string().min(1).max(2000) })`
- Re-export `sessionIdParamSchema` from `@/lib/workout-sessions/schemas` (or import directly in the route — author's choice; keep DRY)
- Export `CreateSessionCommentBody` as the inferred type

#### 3. Service functions

**File**: `src/lib/session-comments/service.ts`

**Intent**: Two functions — one to list comments with author join, one to create a comment.

**Contract**:

```typescript
export async function listSessionComments(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<{ data: SessionCommentWithAuthor[] | null; error: string | null }>

type CreateSessionCommentResult =
  | { ok: true; data: SessionCommentWithAuthor }
  | { ok: false; code: "not_found" | "validation_error"; message: string }

export async function createSessionComment(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  body: CreateSessionCommentBody,
): Promise<CreateSessionCommentResult>
```

`listSessionComments` query: `.from("session_comments").select("*, profiles!author_id(display_name, role)").eq("session_id", sessionId).order("created_at", { ascending: true })`. Map results to `SessionCommentWithAuthor`.

`createSessionComment` inserts with `author_id: userId`, then re-selects with the profiles join to return a full `SessionCommentWithAuthor`.

#### 4. Add `requireAuthenticated` guard

**File**: `src/lib/api/guards.ts`

**Intent**: A guard that accepts any authenticated user (trainer or client) — returns `userId` and `role`. Needed for the shared comment endpoints.

**Contract**:

```typescript
export type AuthenticatedGuardResult =
  | { ok: true; userId: string; role: UserRole }
  | { ok: false; response: Response };

export function requireAuthenticated(context: APIContext): AuthenticatedGuardResult
```

Checks `context.locals.user` and `context.locals.role`; returns `unauthorized` if no user, otherwise returns the user id and role.

### Success Criteria:

#### Automated Verification:

- TypeScript type-check passes: `npm run build` (no `tsc --noEmit` separate script; build catches type errors)
- Lint passes: `npm run lint`

#### Manual Verification:

- Import `listSessionComments` and `createSessionComment` in a scratch test — confirm they compile with no TypeScript errors

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: API Routes

### Overview

Add two API route files: `GET /api/sessions/[id]/comments` (list) and `POST /api/sessions/[id]/comments` (create). Both use `requireAuthenticated`.

### Changes Required:

#### 1. GET comments route

**File**: `src/pages/api/sessions/[id]/comments.ts`

**Intent**: List all comments on a session. The `requireAuthenticated` guard ensures only logged-in users reach the DB; RLS handles tenant isolation so a trainer only sees comments on their client's session and a client only sees their own.

**Contract**: Exports `GET` and `POST` from the same file (Astro supports multiple method exports per route file):

```
GET /api/sessions/:id/comments
→ 200 { comments: SessionCommentWithAuthor[] }
→ 401 / 403 (guard fail)
→ 404 (session not found or not accessible)
→ 500 (fetch_failed)
```

```
POST /api/sessions/:id/comments
body: { body: string }
→ 201 { comment: SessionCommentWithAuthor }
→ 400 validation_error
→ 401 / 403
→ 404 not_found
```

Both `GET` and `POST` exported from the same file. `export const prerender = false` at top.

For POST, return `jsonResponse({ comment: result.data }, { status: 201 })` — check that `jsonResponse` accepts a second options arg, or construct the `Response` directly with `JSON.stringify` and `Content-Type: application/json` if it doesn't.

#### 2. Check `jsonResponse` signature

**File**: `src/lib/api/responses.ts`

**Intent**: Verify whether `jsonResponse` accepts an options object with `status`. If not, extend it to accept an optional `ResponseInit` second argument so the POST route can return 201.

**Contract**: After this change (or verification that no change is needed), `jsonResponse(body, { status: 201 })` must compile and return a `Response` with the correct status.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes (routes resolve, types match)

#### Manual Verification:

- Using curl or Postman: `GET /api/sessions/<real-session-id>/comments` as an authenticated client → 200 `{ comments: [] }`
- `POST /api/sessions/<real-session-id>/comments` with `{ "body": "test comment" }` → 201 with new comment in response
- `GET` again → comment appears in list with author attribution

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI Integration

### Overview

Install the shadcn Textarea component, create `SessionCommentsThread`, and wire it into `SessionActualsReview` (trainer) and `SessionOverview` (client). The component handles its own API fetch lifecycle.

### Changes Required:

#### 1. Install Textarea shadcn component

**File**: `src/components/ui/textarea.tsx` (created by shadcn CLI)

**Intent**: Add the shadcn/ui Textarea primitive needed by the comment composer.

**Contract**: Run `npx shadcn@latest add textarea` from the workspace root. Confirm the file lands at `src/components/ui/textarea.tsx`.

#### 2. `SessionCommentsThread` component

**File**: `src/components/session-comments/SessionCommentsThread.tsx`

**Intent**: A self-contained React island that fetches comments on mount, displays the thread, and provides a composer to submit new comments. Shared between trainer and client pages.

**Contract**:

```typescript
interface SessionCommentsThreadProps {
  sessionId: string;
  currentUserId: string;
  currentUserRole: UserRole;
}
```

Behavior:
- On mount: `fetch("/api/sessions/${sessionId}/comments")` → render list
- Thread items: show `author_display_name`, role badge ("Trainer" in amber, "Client" in blue, or "You" when `author_id === currentUserId`), relative or absolute timestamp (`created_at`), and `body` text
- Composer: `<Textarea>` + "Send" button. On submit: `fetch("/api/sessions/${sessionId}/comments", { method: "POST", body: JSON.stringify({ body }) })` → on success, append to thread and clear textarea; on error, show inline error message
- Loading and empty states handled (spinner while fetching, "No comments yet" when empty)
- No edit/delete controls

#### 3. Wire into trainer `SessionActualsReview`

**File**: `src/components/workout-sessions/SessionActualsReview.tsx`

**Intent**: Append a "Comments" section at the bottom of the review, below the exercise table. Pass `sessionId`, `currentUserId`, and `currentUserRole` as props.

**Contract**: `SessionActualsReviewProps` gains three new fields: `sessionId: string`, `currentUserId: string`, `currentUserRole: UserRole`. The trainer Astro page passes these from `session.id` and `context.locals.user.id` / `context.locals.role`. Add `<SessionCommentsThread client:load ...>` at the bottom of the returned JSX.

#### 4. Update trainer session Astro page

**File**: `src/pages/trainer/clients/[clientId]/sessions/[sessionId].astro`

**Intent**: Pass `sessionId`, `currentUserId`, and `currentUserRole` into `SessionActualsReview` so the comment thread has what it needs.

**Contract**: `context.locals.user.id` and `context.locals.role` are already available via middleware. Extract them and forward to the component.

#### 5. Wire into client `SessionOverview`

**File**: `src/components/guided-workout/SessionOverview.tsx`

**Intent**: Add `SessionCommentsThread` as a section below the phase breakdown (above the fixed "Begin Workout" button bar). Scope: show on overview mode only.

**Contract**: `SessionOverviewProps` gains `currentUserId: string` and `currentUserRole: UserRole`. `sessionId` is derivable from `session.id`. Add `<SessionCommentsThread client:load ...>` in the `pb-28` content area, after the phase breakdown section.

#### 6. Update client session Astro page

**File**: `src/pages/client/sessions/[sessionId].astro`

**Intent**: Pass `currentUserId` and `currentUserRole` down to `GuidedWorkoutHub` so it can forward them to `SessionOverview`.

**Contract**: Follow the same prop-drilling path: Astro page → `GuidedWorkoutHub` → `SessionOverview`. Confirm how `GuidedWorkoutHub` receives and passes session-related props — add the two new props there too if needed.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes (no ESLint errors in new/modified files)
- `npm run build` passes (no type errors, routes resolve)

#### Manual Verification:

- Trainer opens a client's session detail → "Comments" section visible below exercise readout; can type and submit a comment → comment appears with "You (Trainer)" attribution and timestamp
- Client opens the same session overview → comments thread shows the trainer comment with "Trainer" badge; client can add a reply → comment appears with "You" attribution
- Trainer refreshes → client's comment visible
- Empty session → "No comments yet" state shown
- Long comment body (near 2000 chars) → submits without error
- Invalid session ID in URL → API returns 404; UI shows error state gracefully

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `src/lib/session-comments/schemas.ts`: valid body, empty body (reject), body > 2000 chars (reject)
- `src/lib/session-comments/service.ts`: mock supabase client, confirm select/insert query shapes

### Integration Tests:

- RLS tests already exist in `tests/integration/rls/session-comments.test.ts` — no new tests needed for RLS
- Optional: Vitest route test for `GET /api/sessions/[id]/comments` with mocked supabase

### Manual Testing Steps:

1. Log in as trainer → open a client's session → verify comments thread renders
2. Post a comment as trainer → verify it appears immediately with correct attribution
3. Log in as client → open same session → verify trainer comment visible, add own comment
4. Reload as trainer → verify client comment visible
5. Try accessing `/api/sessions/<id>/comments` as unauthenticated → expect 401

## Performance Considerations

Comments are fetched on component mount with a single query. No polling or subscriptions. Thread is bounded (sessions last hours, not months), so pagination is not needed.

## Migration Notes

No migration. Database schema, RLS policies, and integration tests for `session_comments` shipped in `20260526120400_sessions_logging_comments.sql`.

## References

- Roadmap: `context/foundation/roadmap.md` (S-09)
- DB migration: `supabase/migrations/20260526120400_sessions_logging_comments.sql`
- RLS tests: `tests/integration/rls/session-comments.test.ts`
- Reference API: `src/pages/api/client/sessions/[id].ts`
- Reference service: `src/lib/set-logs/service.ts`
- Trainer review UI: `src/components/workout-sessions/SessionActualsReview.tsx`
- Client overview UI: `src/components/guided-workout/SessionOverview.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Service Layer

#### Automated

- [x] 1.1 npm run build passes with new types and service
- [x] 1.2 npm run lint passes

#### Manual

- [ ] 1.3 Service functions compile without TypeScript errors

### Phase 2: API Routes

#### Automated

- [ ] 2.1 npm run lint passes
- [ ] 2.2 npm run build passes (routes resolve, types match)

#### Manual

- [ ] 2.3 GET /api/sessions/:id/comments returns 200 with empty array for authenticated user
- [ ] 2.4 POST /api/sessions/:id/comments returns 201 with new comment
- [ ] 2.5 GET again returns the posted comment with author attribution

### Phase 3: UI Integration

#### Automated

- [ ] 3.1 npm run lint passes
- [ ] 3.2 npm run build passes

#### Manual

- [ ] 3.3 Trainer sees comments thread on session detail page and can post
- [ ] 3.4 Client sees comments thread on session overview and can post
- [ ] 3.5 Cross-role visibility: trainer comment visible to client and vice versa
- [ ] 3.6 Empty state ("No comments yet") shown on sessions with no comments
