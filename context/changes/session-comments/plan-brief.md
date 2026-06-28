# Session Comments — Plan Brief

> Full plan: `context/changes/session-comments/plan.md`

## What & Why

Add bidirectional session comment threads so client and trainer can communicate about a training session directly in trAInR (FR-023). This replaces the chat-and-spreadsheet fragmentation the product is designed to eliminate — coaches can leave pre-workout notes, clients can report how a session felt, and both parties can read each other's comments in context.

## Starting Point

The `session_comments` table, RLS policies, and integration tests already exist (shipped in `20260526120400_sessions_logging_comments.sql`). `src/types.ts` has `SessionComment`. Nothing in the service, API, or UI layers reads or writes comments yet.

## Desired End State

Trainer opens a client's session detail → sees a chronological comment thread below the exercise readout and can post comments. Client opens the same session (overview mode) → sees the thread and can reply. Comments show author attribution (display name, "Trainer"/"Client"/"You" role badge, timestamp). No edit/delete controls in this MVP slice.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| API route shape | Single `/api/sessions/[id]/comments` (role-agnostic) | Avoid duplicating identical logic under `/api/client/` and `/api/trainer/`; RLS enforces tenant isolation | Plan |
| Role guard | New `requireAuthenticated` (accepts trainer or client) | Both roles need the same endpoints; existing guards are role-specific | Plan |
| Edit/delete UI | Out of scope for MVP | S-09 outcome says "leave and read comments" — no edit/delete requirement in FR-023 | Plan |
| Author attribution | Join `profiles` in service query | `author_role` and `display_name` needed for UI badges; no extra round-trip | Plan |
| Comment ordering | Chronological ascending | Natural conversation thread order; no specification for reverse | Plan |
| UI injection points | `SessionActualsReview` (trainer) + `SessionOverview` (client) | These are the primary session views for each role | Plan |

## Scope

**In scope:**
- `SessionCommentWithAuthor` type
- Zod schemas for create
- `listSessionComments` and `createSessionComment` service functions
- `GET` and `POST` API routes at `/api/sessions/[id]/comments`
- `requireAuthenticated` guard in `src/lib/api/guards.ts`
- Extend `jsonResponse` to accept optional `ResponseInit` (for 201 status)
- shadcn Textarea component installation
- `SessionCommentsThread` React island (fetch + display + composer)
- Wire thread into trainer `SessionActualsReview` and client `SessionOverview`

**Out of scope:**
- Comment edit/delete UI
- Real-time updates / push notifications
- Comment pagination
- Comments on ad-hoc sessions (S-16 parked)

## Architecture / Approach

```
client/trainer page (Astro SSR)
  → SessionActualsReview / SessionOverview (React island)
    → SessionCommentsThread (React island, client:load)
      → GET /api/sessions/[id]/comments → listSessionComments → supabase
      → POST /api/sessions/[id]/comments → createSessionComment → supabase
```

RLS ensures that only parties on the session (the trainer who owns the plan and the assigned client) can read or write comments.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Service Layer | Types, Zod schemas, `listSessionComments`, `createSessionComment`, `requireAuthenticated` guard | Supabase `profiles!author_id` join alias may need explicit FK hint |
| 2. API Routes | `GET` + `POST /api/sessions/[id]/comments`, 201 response for POST | `jsonResponse` may not accept options arg — needs extension |
| 3. UI Integration | Textarea component, `SessionCommentsThread`, wired into trainer + client views | Prop-drilling through `GuidedWorkoutHub` adds props to multiple components |

**Prerequisites:** S-04 done (sessions exist in DB); Supabase project running locally for manual verification
**Estimated effort:** ~3 implementation phases; medium complexity

## Open Risks & Assumptions

- The `profiles!author_id` FK hint in the Supabase select query must correctly disambiguate the `author_id → profiles` join; if Supabase can't resolve the alias, an explicit RPC or a two-step query is the fallback
- `GuidedWorkoutHub` prop-drilling may require touching more files than anticipated if the component has a complex prop interface

## Success Criteria (Summary)

- Trainer and client can each post a comment on a shared session via the UI
- Comments from each role are visible to the other after reload
- `npm run lint` and `npm run build` pass with no errors
