---
date: 2026-06-07T09:20:00+02:00
researcher: Cursor (Claude Opus 4.8)
git_commit: 5025f986344bff9152b82f439ea3c1f28ea558b4
branch: m3l1-test-plan
repository: trAInR
topic: "Static per-trainer invite link + trainer approval vs. per-client single-use links"
tags: [research, codebase, invite-links, onboarding, access-control, approval, s-03]
status: complete
last_updated: 2026-06-07
last_updated_by: Cursor (Claude Opus 4.8)
---

# Research: Static per-trainer invite link + trainer approval

**Date**: 2026-06-07T09:20:00+02:00
**Researcher**: Cursor (Claude Opus 4.8)
**Git Commit**: `5025f986344bff9152b82f439ea3c1f28ea558b4`
**Branch**: `m3l1-test-plan`
**Repository**: trAInR

## Research Question

Would it be better to have **one static link per trainer** that clients use to
register, where the trainer must **ACCEPT** each client (seeing the email they
registered with) before the account activates? This would remove the risk of
trainers generating tons of invite links and let a trainer advertise a single
link everywhere. What is the client-experience cost (clients can't log in until
accepted)? What other risks/chances exist, and what are the known best practices
of existing apps?

## Summary

**The proposal is sound, it is a recognized industry pattern, and it is a net
improvement over today's per-client single-use links — but it is a deliberate
departure from the locked PRD/ERD contract (auto-assign, no approval, no
pending state), so it needs a product decision, not just an implementation.**

Three findings drive the recommendation:

1. **It already exists in the market, almost verbatim.** Everfit ships a "Public
   Client Invite Link": one reusable link per coach with a setting to either
   _activate automatically_ or _always add to a "Waiting Activation" list_ the
   coach approves one-by-one. Trainerize and TrueCoach instead use
   trainer-enters-email invites (approval is implicit/upfront). The
   "pending → approve → active" membership model is the standard B2B SaaS
   access-control pattern (Slack, WorkOS, OpenAI). So your instinct matches
   real products.

2. **The client-UX cost is small and is the accepted trade-off in those
   products.** A client who registers and then waits on a "pending approval"
   screen is a well-understood flow. The one real cost is that, with
   notifications a hard non-goal (PRD), the client can't be _told_ the moment
   they're approved — they discover it by signing in again. That is acceptable
   for an MVP and is exactly how Everfit's waiting-activation list behaves.

3. **Technically it is a medium-sized change, not a tweak.** The codebase has
   _no_ pending state (`trainer_client_status` is only `active | removed`), the
   client's email is **not** stored anywhere the trainer can read it (it lives
   only in `auth.users`), Supabase Auth login **cannot** be blocked by the app
   (`enable_confirmations = false`, so there is no gate today), and the
   single-use RPCs (`validate_invite_token` / `complete_client_invite`) bake in
   one-time consumption. Each of these needs work.

**Recommendation: adopt a hybrid that matches Everfit.** Keep a single reusable
per-trainer link, add a `pending` assignment state and an approval queue, and
make approval a **per-trainer toggle** (auto-accept vs. require-approval) rather
than a hard rule. This captures the "advertise one link everywhere" win,
neutralizes the link-spam concern, keeps the door open for the existing
auto-assign UX where a trainer wants frictionless onboarding, and degrades
gracefully under the notifications non-goal. See
[Recommendation](#recommendation) and [Migration sketch](#migration-sketch).

## The two questions you actually asked

### "Are we losing much on client experience?"

**Not much — and what we lose is mostly cosmetic given the notifications
non-goal.** Concretely:

| Client-UX dimension           | Today (single-use link)                     | Static link + approval                                                 |
| ----------------------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| Steps to register             | Open link → register → in                   | Open link → register → **wait** → in                                   |
| Can use app immediately?      | Yes (auto-assigned, `active`)               | No — blocked until trainer accepts                                     |
| How they learn they're in     | N/A                                         | Sign in again / refresh "pending" page (no notification — Non-Goal #5) |
| Failure mode if link is stale | "Link unavailable, ask for a new one"       | None — the link never expires/consumes                                 |
| Wrong-trainer / typo risk     | Trainer must remove after the fact (FR-006) | Trainer simply doesn't accept (cleaner)                                |

The honest losses: (a) a **time-to-value gap** between "I signed up" and "I can
train," bounded by how fast the trainer checks their queue; and (b) without
notifications, the client must **re-check** to discover approval. Both are the
same trade-off Everfit's "Waiting Activation" users accept. Mitigations: a clear
"You're all set — [Trainer] just needs to approve you" screen, and (post-MVP,
when notifications land) an "you've been approved" email.

There is also a **latent UX win**: today a stale/used link shows "invite link
unavailable" (`src/pages/auth/signup.astro:45-58`); a static link removes that
entire failure class — the link a trainer prints on a flyer keeps working
forever.

### "What's the abuse problem you're actually fixing?"

Today every client needs a **freshly generated** single-use link
(`src/pages/api/invites/index.ts:39-49` creates one row per click, 7-day expiry,
consumed on first signup). That means: a trainer who recruits at scale generates
many rows; links can't be reused, so they can't be put on a website, business
card, or Instagram bio; and the trainer's invite list grows unbounded. A single
static link fixes all of that. **But note:** the current single-use design is
not actually a strong anti-abuse control — anyone with the link can register, and
auto-assign means they immediately become an `active` client. The static-link +
**approval** model is what adds the real control: the trainer becomes the gate,
so a leaked/over-shared link only produces _pending_ registrants the trainer can
ignore or reject, not active clients in their roster.

## Detailed Findings

### A. What the codebase does today (per-client, single-use, auto-assign)

- **One row per generated link, 7-day expiry, single-use.** `POST /api/invites`
  mints `crypto.randomUUID()`, sets `expires_at = now + 7d`, inserts an
  `invite_links` row, returns `/auth/signup?token=…`
  (`src/pages/api/invites/index.ts:39-61`).
- **Consumption is atomic and terminal.** `complete_client_invite` `UPDATE`s the
  row `used_at = now(), used_by_client_id = …` only `where used_at is null` and
  not expired, then inserts the `trainer_clients` row — i.e. immediate
  **auto-assign as `active`** (`supabase/migrations/20260604120000_invite_rpcs.sql:49-80`).
- **Validation is anon-safe and single-use aware.** `validate_invite_token`
  returns `valid:false` once `used_at` is set or expiry passes
  (`…invite_rpcs.sql:7-40`); the signup page renders trust copy or an
  "unavailable" state from it (`src/pages/auth/signup.astro:14-35,45-58`).
- **Assignment lifecycle has exactly two states.**
  `create type public.trainer_client_status as enum ('active', 'removed')`
  (`supabase/migrations/20260526120000_enums_profiles_helpers.sql:29`). There is
  **no pending/requested state**.
- **`trainer_clients` has no uniqueness guard** on `(trainer_id, client_id)`
  (`…trainer_onboarding.sql:7-15`) — fine when links are single-use, a duplicate
  risk once a link is reusable.

### B. The "trainer sees the email" requirement is non-trivial

- **`profiles` stores no email** — only `id, role, display_name, avatar_url,
timestamps` (`…enums_profiles_helpers.sql:43-50`). The email lives solely in
  `auth.users`, which `authenticated`/`anon` cannot select.
- `handle_new_user()` reads `new.email` only to derive a fallback
  `display_name`; it never persists the address
  (`…enums_profiles_helpers.sql:99-104`).
- **Therefore "trainer sees the email used for registration" requires a new
  `SECURITY DEFINER` RPC** that joins pending `trainer_clients` to
  `auth.users.email`. There is precedent for this exact pattern:
  `get_my_assigned_trainer` and the invite RPCs are all `SECURITY DEFINER`
  reaching across RLS (`…get_my_assigned_trainer.sql:3-31`).

### C. "Block login until approved" must be an app-layer gate

- **Email confirmation is OFF**: `enable_confirmations = false`
  (`supabase/config.toml:209`). The signup flow redirects to
  `/auth/confirm-email` for messaging, but Supabase does **not** actually block
  sign-in. So there is **no pre-app gate today** — a registered user can sign in
  immediately.
- `signInWithPassword` will always succeed for a valid credential
  (`src/pages/api/auth/signin.ts:15-31`); it then redirects by role to
  `/client/dashboard`. Supabase Auth has no native "approved" concept.
- **Middleware only checks role, not assignment status**
  (`src/middleware.ts:39-49`). The gate for a pending client must be added
  either in middleware (preferred: redirect pending clients to a
  `/client/pending` waiting screen) or on the client dashboard itself
  (`src/pages/client/dashboard.astro:11-31` already branches on "no active
  trainer" — natural seam to show "waiting for approval").

### D. The approval gate's blast radius (everything keyed on `status='active'`)

Adding a `pending` state is _safe-by-default_ for visibility — every existing
filter treats non-`active` as invisible, which is what we want for a pending
client — but it means a **new dedicated surface** is required for the trainer to
see pending registrants. Places that filter `active`:

- Profiles cross-visibility (both directions) require an **active** assignment —
  so a pending client is invisible to the trainer and vice-versa
  (`…invite_rpcs.sql:89-113`).
- `trainer_clients_trainer_select_active` lets a trainer SELECT **only active**
  rows (`…trainer_onboarding.sql:87-94`) → the pending queue can't be a plain
  table read; it needs an RPC.
- `is_trainer_for_client` / `is_assigned_trainer` helpers are active-only
  (`…trainer_onboarding.sql:44-74`) — these gate all downstream RLS (plans,
  sessions), which is correct: a pending client should reach nothing.
- `get_my_assigned_trainer` is active-only (`…get_my_assigned_trainer.sql:25`).
- UI reads: `src/pages/trainer/clients.astro:29` and
  `src/pages/client/dashboard.astro:21` both `.eq("status","active")`.

### E. Product/PRD contract this would change

The current behavior is **locked** in the product docs, and the proposal
contradicts several points — this is the main reason to treat it as a product
decision:

- **FR-004 / US-01: auto-assignment on registration.** "Invite link leads to a
  registration page; client is auto-assigned to the trainer on completion." The
  proposal inserts an approval step _before_ assignment is effective.
- **FR-006 + roadmap: abuse is handled by removal, not pre-approval.** The
  accepted model is auto-assign then **remove/reject after the fact** (S-11,
  shipped). The proposal moves the gate to _before_ activation.
- **ERD Q5: single-use token** is the locked invite decision; a static reusable
  link reverses it.
- **"No pending-assignment state exists"** was an explicit prior decision
  (`context/archive/2026-06-05-client-removal/plan-brief.md:25`).
- **Non-Goal #5: no notifications (email/push), post-MVP**
  (`context/foundation/roadmap.md:285`). This is the binding constraint on the
  _client_ side of approval: we cannot proactively tell a client they were
  accepted. Pull-based discovery only.
- **Non-Goal #9: single-trainer model** — simplifies things: no multi-coach
  routing like Everfit's gym/admin case.

> These aren't blockers, but they mean the change should update the PRD/ERD and
> roadmap (S-03 is marked `done`/archived), ideally via `/10x-frame` →
> `/10x-plan`, not a silent reimplementation.

## Best practices from existing apps

| App                                                        | Join model                                                                                                                                                                           | Approval / gating                                                                                                                                                          | Takeaway for trAInR                                                                                                                                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Everfit**                                                | **Public per-coach invite link** (on social, emails, anywhere)                                                                                                                       | Setting per workspace: _auto-activate_ **or** _always add to "Waiting Activation" list_ the coach activates individually; overflow → waiting list when seats run out       | **Direct precedent for the proposal.** Validates static link + per-trainer approval toggle + a waiting/pending queue.                                                                                                       |
| **Trainerize**                                             | Coach enters name+email → system emails an activation link (valid 30 days; resend invalidates prior). Manual "copy setup link" alternative; newer beta _shareable_ links + referrals | Approval is _implicit_ — the coach initiates by entering the email                                                                                                         | Email-seat model sidesteps the public-link problem; their newer shareable links show the market drifting toward your idea.                                                                                                  |
| **TrueCoach**                                              | Coach adds client → invitation email → client accepts, sets password → **account activated**                                                                                         | Implicit (coach-initiated); email verification required before billing                                                                                                     | "Accept invitation → activate" wording/flow is a clean client-side model to mirror.                                                                                                                                         |
| **Slack / WorkOS / OpenAI (general SaaS)**                 | "Request to join" / invite                                                                                                                                                           | **Explicit pending → approve → active** membership status; pending members **cannot sign in until accepted**; requests land in a queue; requester **notified** on decision | The canonical access-control shape. WorkOS literally: pending memberships "won't be able to sign in until the invitation is accepted, at which point they become active." Mirror their `pending/active/inactive` lifecycle. |
| **Public-link security (Realm, better-auth, invite libs)** | Reusable/public links                                                                                                                                                                | Treat as **public entry points**: support **disable/rotate/revoke**, optional **max-uses & expiry**, rate-limit, cryptographically-secure tokens, monitor failed attempts  | Tells us what to build _around_ a static link so it stays safe.                                                                                                                                                             |

**Synthesis of best practice:** separate the **invitation** (a pending claim on
access) from the **membership** (actual active access); model an explicit status
lifecycle; let the admin/trainer approve from a queue; make public links
**revocable/rotatable**; and notify the requester on decision _if_ you have
notifications (we don't yet — so use a pending screen).

## Risks & chances

### Chances (upside)

- **One link to advertise everywhere** (bio, flyer, website, QR) — the headline
  win; impossible with single-use links today.
- **Stronger, cleaner gate than post-hoc removal**: leaked/over-shared link only
  yields _pending_ rows; nothing enters the roster without a trainer click.
- **Eliminates the "link unavailable" failure class** (no expiry/consumption to
  trip over).
- **Trainer sees who's knocking** (email) before granting access — useful for
  filtering randoms and confirming identity.
- **Aligns with a real, successful product (Everfit)** and the standard SaaS
  pattern — low product risk.

### Risks (and mitigations)

- **Spam/junk registrations on a public link** → pending rows pile up. _Mitigate:_
  rate-limit registration, allow the trainer to **rotate/disable** the link,
  cap pending rows, add a captcha later if needed.
- **Auth accounts created for unapproved users** (a `auth.users` + `profiles`
  row exists before approval). _Mitigate:_ the pending state grants zero access
  via RLS; add a cleanup job for long-unapproved/rejected pendings (GDPR-friendly).
- **Notifications non-goal makes approval feel "silent"** to the client.
  _Mitigate:_ explicit pending screen; revisit when notifications ship.
- **Contradicts locked PRD/ERD (auto-assign, single-use, no pending)** →
  _Mitigate:_ run it through `/10x-frame` + update PRD/ERD/roadmap before build.
- **Migration blast radius** (enum, RPCs, RLS, middleware, 2 dashboards, email
  RPC) → _Mitigate:_ the hybrid keeps changes additive (pending is invisible by
  default), and a toggle lets you ship without forcing the gate on everyone.
- **Duplicate/abusive re-registration** (reusable link) → _Mitigate:_ unique
  partial index on `(trainer_id, client_id)` for non-removed rows.

## Recommendation

Adopt the **Everfit-style hybrid**:

1. **One reusable invite link per trainer** (stop minting per-client rows for the
   default flow). Make the link **rotatable/disable-able** (regenerate token to
   invalidate the old one).
2. **Add a `pending` status** to `trainer_client_status` (`pending → active` on
   accept; `pending → removed` or a new `rejected` on decline). Pending is
   invisible to all existing `active`-keyed reads by default (safe).
3. **Approval queue for the trainer** via a `SECURITY DEFINER` RPC that returns
   pending registrants **with their `auth.users.email`** + accept/reject RPCs.
4. **Per-trainer "require approval" toggle** (auto-accept vs. waiting list),
   defaulting to the behavior you prefer for launch. This preserves today's
   frictionless auto-assign as an option and de-risks the rollout.
5. **App-layer login gate**: middleware/`/client/*` routes send a client with no
   `active` assignment to a `/client/pending` screen instead of the dashboard.
6. **Keep the door open for notifications** later (the "you're approved" email)
   without blocking MVP.

Why hybrid over a hard switch: it banks the advertising/anti-spam wins, matches a
proven product, but doesn't bet the whole onboarding funnel on the (currently
un-notifiable) approval gate, and keeps the migration additive.

## Migration sketch

> Indicative only — formalize in `/10x-plan`. Follows repo conventions:
> migration `YYYYMMDDHHmmss_*.sql`, RLS on every table, `SECURITY DEFINER` for
> cross-RLS reads, API routes `export const prerender = false` + zod.

**Schema / DB**

- `alter type public.trainer_client_status add value 'pending';` (and decide
  whether to add `'rejected'` or reuse `'removed'`). Note: adding an enum value
  can't run inside the same txn as its use — sequence migrations accordingly.
- Reusable token: either add `is_reusable`/drop single-use semantics on
  `invite_links` and a unique active token per trainer, **or** move the token to
  a `profiles.invite_token` / dedicated `trainer_invite` row. Add a `rotate`
  path.
- `trainer_clients`: add `requested_at`; add unique partial index on
  `(trainer_id, client_id) where status <> 'removed'` to stop duplicates.
- New RPCs (`SECURITY DEFINER`): `request_client_assignment(p_token)` (client
  self-registers → inserts `pending` row, **does not** consume the token);
  `list_pending_clients()` → returns pending rows **+ email** for the calling
  trainer; `accept_client(p_assignment_id)` (`pending→active`);
  `reject_client(p_assignment_id)`.
- Update `validate_invite_token` to validate a **reusable** token (drop the
  `used_at is null` consumption check for this path).
- Add a per-trainer `require_approval boolean` (on `profiles` or a settings row);
  `request_client_assignment` inserts `active` directly when false.

**App**

- `POST /api/auth/signup` (token branch): call `request_client_assignment`
  instead of `complete_client_invite` (`src/pages/api/auth/signup.ts:56-59`).
- Middleware: route `client` users with no `active` assignment to
  `/client/pending` (`src/middleware.ts:39-49`).
- New `/client/pending.astro` waiting screen; reuse the empty-state seam in
  `src/pages/client/dashboard.astro:42-50`.
- Trainer `/trainer/clients`: add a "Pending requests" section (email + Accept /
  Reject) backed by `list_pending_clients` /
  accept/reject RPCs; replace per-click "Generate link" with a single
  copy-or-rotate link (`src/components/trainer/InviteClientPanel.tsx:87-183`).
- Types: extend `TrainerClientStatus` (`src/types.ts:12`) and add the
  pending/email DTOs.

**Tests / verification**

- Studio SQL harness (per `lessons.md`): prove a `pending` client sees **no**
  plans/sessions and is blocked from `/client/dashboard`; prove a trainer reads
  pending email via RPC but **not** raw `auth.users`; prove accept flips
  visibility on; prove reject/`removed` keeps history; prove RLS still isolates
  cross-tenant.

## Code References

- `src/pages/api/invites/index.ts:39-61` — per-click single-use link minting (7-day expiry)
- `supabase/migrations/20260604120000_invite_rpcs.sql:7-40` — `validate_invite_token` (single-use aware)
- `supabase/migrations/20260604120000_invite_rpcs.sql:49-80` — `complete_client_invite` (consume + auto-assign active)
- `supabase/migrations/20260604120000_invite_rpcs.sql:89-113` — profiles cross-visibility requires `active`
- `supabase/migrations/20260526120000_enums_profiles_helpers.sql:29` — `trainer_client_status enum ('active','removed')`
- `supabase/migrations/20260526120000_enums_profiles_helpers.sql:43-50,99-104` — `profiles` has no email; trigger discards it
- `supabase/migrations/20260526120100_trainer_onboarding.sql:7-15,44-74,87-94` — `trainer_clients` schema, active-only helpers/policy
- `supabase/migrations/20260604193000_get_my_assigned_trainer.sql:3-31` — SECURITY DEFINER cross-RLS read precedent (active-only)
- `supabase/migrations/20260605120000_remove_trainer_client.sql:7-41` — soft-remove (post-hoc abuse handling, FR-006)
- `supabase/config.toml:209` — `enable_confirmations = false` (no login gate today)
- `src/pages/api/auth/signin.ts:15-31` — login always succeeds, redirect by role
- `src/pages/api/auth/signup.ts:28-71` — token branch → `complete_client_invite`
- `src/middleware.ts:39-49` — role gate only, no assignment-status gate
- `src/pages/client/dashboard.astro:11-31,42-50` — natural "waiting for approval" seam
- `src/pages/trainer/clients.astro:25-34` — trainer reads only `active` clients
- `src/components/trainer/InviteClientPanel.tsx:87-183` — generate/copy link UI to rework
- `src/types.ts:12,23-44` — `TrainerClientStatus`, `InviteLink`, `InviteValidation` DTOs

## Architecture Insights

1. **Pending is safe-by-default here.** Because every cross-tenant read is keyed
   on `status='active'`, a new `pending` row is automatically invisible to plans,
   sessions, dashboards, and the trainer's own client list — the gate is mostly a
   matter of _adding_ surfaces (queue + waiting screen), not auditing leaks.
2. **The hard part is identity exposure, not the gate.** Showing the trainer the
   registrant's email crosses into `auth.users`; it must go through a
   `SECURITY DEFINER` RPC (the repo already uses this pattern for every
   cross-RLS read).
3. **There is no auth-level gate to lean on.** With confirmations off, "can't log
   in until approved" is purely an application redirect concern — Supabase will
   authenticate the user regardless.
4. **Single-use is woven into both RPCs and the UI copy** ("each link works
   once", "invite link unavailable") — a reusable link is a cross-cutting change,
   not a flag.

## Historical Context (from prior changes)

- `context/archive/2026-05-30-client-onboarding/research.md` — original S-03
  decision: copy-link + single-use + auto-assign; email onboarding parked as a
  "future alternative"; abuse via expiry/usage limits noted as under-specified.
- `context/archive/2026-06-05-client-removal/plan-brief.md:25` — explicit prior
  decision that **no pending-assignment state exists**.
- `context/foundation/roadmap.md:113-121` — S-03 outcome (generate link →
  register → auto-assign); :277 removal retains data; :285,:289 notifications &
  multi-trainer parked.

## Open Questions

1. **Default toggle at launch:** require-approval ON (gate everyone) or OFF
   (auto-assign, approval opt-in)? Recommend OFF→opt-in to de-risk, or ON if the
   anti-spam goal is the priority.
2. **Reject semantics:** new `rejected` enum value vs. reuse `removed`? Affects
   whether a rejected email can ever re-request.
3. **Link rotation UX:** one token regenerated on demand, or allow several named
   campaign links (Everfit/Realm pattern) so a leaked one can be killed in
   isolation?
4. **Cleanup policy** for long-pending / rejected `auth.users` rows (privacy +
   seat hygiene) — needs a scheduled job.
5. **PRD/ERD update path:** S-03 is archived/`done`; this should re-open via
   `/10x-frame` and amend FR-004/US-01 + ERD Q5 rather than silently diverge.
