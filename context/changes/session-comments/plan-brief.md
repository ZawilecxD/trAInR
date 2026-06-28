# Session Comments (S-09) — Plan Brief

> Full plan: `context/changes/session-comments/plan.md`

## What & Why

Client and trainer need a simple bidirectional feedback channel on training sessions — the only in-app communication path (FR-023). Schema and RLS are already in place; this slice wires up service, API, and UI so both roles can post and read comments on sessions they can access.

## Starting Point

`session_comments` table with full RLS ships from F-01. Integration tests verify cross-tenant isolation. Client guided workout (S-06) and trainer session review (S-07) exist but defer comments to this slice.

## Desired End State

Chronological comment thread with composer appears on client session overview and trainer session review. Users edit/delete only their own comments. RLS enforces access; no notifications.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Display format | Flat chronological | Matches design G2; simpler than nested threads | Plan |
| API shape | Single shared route for both roles | RLS handles access; avoids duplicate endpoints | Plan |
| Data loading | React island fetches via API | Matches set-logs mutation pattern | Plan |
| DB changes | None | Table + RLS sufficient | Research |
| Body limit | 2000 chars (zod) | Prevent abuse; no DB migration needed | Plan |

## Scope

**In scope:** Service, schemas, API, shared UI component, client overview + trainer review integration, unit tests

**Out of scope:** Notifications, real-time sync, nested replies, ad-hoc session comments (S-16), new migration

## Architecture / Approach

`requireAuthenticated` guard → `/api/sessions/[sessionId]/comments` → `session-comments/service.ts` → Supabase `session_comments` (RLS). `SessionCommentsPanel` React island embedded in `SessionOverview` and `SessionActualsReview`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Service, API, and Schema Tests | CRUD API both roles can call | Guard must not bypass role checks RLS relies on |
| 2. Session Comments UI | Thread + composer on client and trainer views | Bottom CTA bar on client overview may overlap composer |

**Prerequisites:** S-04 (sessions exist), F-01 (schema + RLS)

## Open Risks & Assumptions

- Comments on cancelled sessions: allowed for any session both roles can access (S-08 not yet shipped)
- Trainer editable session view (`SessionForm`) does not show comments — only read-only review mode (acceptable for MVP)

## Success Criteria (Summary)

- Client and trainer can post and read each other's comments on a shared session
- Own-comment edit/delete works; cross-user modification blocked
- `npm run lint` and `npm run build` pass
