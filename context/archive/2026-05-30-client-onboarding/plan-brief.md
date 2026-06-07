# Client Onboarding via Invite Link — Plan Brief

> Full plan: `context/changes/client-onboarding/plan.md`
> Research: `context/changes/client-onboarding/research.md`

## What & Why

Implement S-03: the trainer generates a single-use invite link, shares it via an external channel (WhatsApp, SMS, etc.), and the client registers through it — getting auto-assigned to the trainer. This is the core onboarding loop that unlocks the entire client-facing product (S-04 through S-13 depend on clients existing in the system).

## Starting Point

The database foundation is complete (F-01): `invite_links` and `trainer_clients` tables exist with trainer-only RLS, and the `handle_new_user()` trigger already resolves `role` from signup metadata. But there's no application layer — no invite generation API, no trainer management page, no token validation RPCs, no client signup path, and no role-based routing after sign-in.

## Desired End State

A trainer signs in, navigates to `/trainer/clients`, generates an invite link with one click, copies it, and shares it. A client opens the link, sees a personalized signup page with the trainer's name, registers, confirms their email, signs in, and lands on `/client/dashboard`. The trainer's invite list shows the link as "used."

## Key Decisions Made

| Decision                        | Choice                                                | Why (1 sentence)                                                                                             | Source   |
| ------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| Invite delivery method          | Copy-link only (no email send)                        | PRD non-goal #5 explicitly parks notifications post-MVP                                                      | Research |
| Default invite expiry           | 7 days                                                | Balances urgency with flexibility; PRD says "expiry or usage limits" without specifying duration             | Plan     |
| Google OAuth for client signup  | Email+password only for now                           | Avoids redirect/state complexity with token preservation; FR-001 Socrates note supports shipping email first | Plan     |
| Rate limit on invite generation | No limit                                              | Single-use + 7-day expiry provides sufficient abuse prevention for MVP                                       | Plan     |
| Trainer name on client signup   | Show trainer's display_name                           | Builds trust and confirms the client is joining the right trainer                                            | Plan     |
| Post-login redirect             | Role-based: `/trainer/clients` vs `/client/dashboard` | Clients and trainers need different landing pages; generic `/dashboard` becomes a redirect                   | Plan     |
| Invalid token UX                | Friendly error on signup page (no form)               | Keeps the user in context with clear guidance to request a new link                                          | Plan     |
| Token validation approach       | SECURITY DEFINER RPCs (no anon RLS)                   | Mandated by F-01 plan — never expose `invite_links` to anon SELECT                                           | Research |

## Scope

**In scope:**

- `validate_invite_token` and `complete_client_invite` SECURITY DEFINER RPCs
- Profile cross-visibility RLS (trainer ↔ client)
- `POST /api/invites` — invite creation endpoint
- `/trainer/clients` page with generate + copy + invite list
- Modified signup flow with token-based client registration
- Role-based post-login redirect
- Minimal `/client/dashboard` placeholder

**Out of scope:**

- Email sending from trainer UI (post-MVP)
- Google OAuth for clients
- Client removal (S-11)
- Trainer dashboard (S-07)
- Rate limiting or invite quotas
- Duplicate assignment prevention

## Architecture / Approach

Two SECURITY DEFINER RPCs handle the security boundary — `validate_invite_token` (called on page load for UX) and `complete_client_invite` (called after signup for atomic assignment). The existing `/auth/signup` route branches on the presence of a `token` query parameter: no token = trainer signup (unchanged), valid token = client signup with `role: client` metadata. Invite generation is a simple API route behind trainer auth; the trainer page fetches data server-side (Astro SSR) and passes it to a React island for interactivity.

## Phases at a Glance

| Phase                      | What it delivers                                                   | Key risk                                                                                  |
| -------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 1. Database RPCs           | Token validation + consumption RPCs, profile cross-visibility      | RPC grant permissions must include `anon` — easy to miss                                  |
| 2. Invite Generation       | `/trainer/clients` page with generate + copy UX                    | First trainer-facing page; sets UX patterns for future trainer pages                      |
| 3. Client Signup via Token | Modified signup flow handling both trainer and client registration | Race condition between page-load validation and form submission (mitigated by atomic RPC) |
| 4. Role-Based Routing      | Signin redirect by role + `/client/dashboard` placeholder          | Must update existing `signin.ts` and `dashboard.astro` without breaking current flow      |

**Prerequisites:** F-01 (database schema + RLS) — complete
**Estimated effort:** ~2-3 sessions across 4 phases

## Open Risks & Assumptions

- Tiny race window between `validate_invite_token` (page load) and `complete_client_invite` (form submit) — if the token is consumed in between, the client's `signUp` succeeds but invite completion fails, leaving an orphaned `role: client` profile with no trainer assignment. Acceptable for MVP; window is sub-second.
- `sonner` toast library operates via DOM-level global store; assumed to work across Astro React islands without shared React context. Needs verification in Phase 2.
- No unit test framework is configured — verification relies on lint, build, and manual testing.

## Success Criteria (Summary)

- A trainer can generate an invite link, copy it, and see its status update when used
- A client can register via a valid invite link, confirm email, sign in, and land on their dashboard — auto-assigned to the correct trainer
- Invalid/expired/used tokens show clear error states without allowing registration
