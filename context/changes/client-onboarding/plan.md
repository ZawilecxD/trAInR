# Client Onboarding via Invite Link — Implementation Plan

## Overview

Implement S-03: a trainer generates a single-use invite link, copies it, shares it through an external channel (WhatsApp, SMS, etc.), and the client registers via `/auth/signup?token=…` — getting `role: client`, auto-assigned to that trainer in `trainer_clients`, and routed to a role-appropriate page after sign-in.

## Current State Analysis

**Foundation tables exist; application layer is missing.**

| Layer | Status | Evidence |
|-------|--------|----------|
| `invite_links` table + RLS | Done (F-01) | `20260526120100_trainer_onboarding.sql` |
| `trainer_clients` table + RLS | Done (F-01) | Same migration |
| `handle_new_user()` trigger (role from metadata) | Done | `20260526120000_enums_profiles_helpers.sql:77-107` |
| `InviteLink` / `TrainerClient` TS types | Done | `src/types.ts:23-31` |
| Middleware role guards (`/trainer/*`, `/client/*`) | Done | `src/middleware.ts:6-9` |
| Trainer signup API (hardcodes `role: "trainer"`) | Done | `src/pages/api/auth/signup.ts:19` |
| Token validation RPC (`validate_invite_token`) | **Missing** | Migration comment line 38: deferred to S-03 |
| Invite consumption RPC (`complete_client_invite`) | **Missing** | Planned in research |
| Invite generation API / trainer page | **Missing** | No `/api/invites`, no `/trainer/` pages |
| Client signup via token | **Missing** | `SignUpForm.tsx` has no token field |
| Role-based post-login redirect | **Missing** | `signin.ts` always redirects to `/` |
| shadcn `input`, `sonner`, `badge` | **Not installed** | Only `button` exists in `src/components/ui/` |

### Key Discoveries:

- `invite_links` has `token UNIQUE`, `expires_at`, `used_at`, `used_by_client_id` — all columns needed for single-use lifecycle; no schema changes required on this table
- `handle_new_user()` already resolves `role` from `raw_user_meta_data.role`, defaulting to `trainer` — client signup just needs to pass `role: 'client'` in metadata
- RLS on `invite_links` is trainer-only (no anon policies) — token validation must go through `SECURITY DEFINER` RPCs, not direct table access (`context/changes/database-schema-and-rls/plan.md:408`)
- Profiles RLS only allows `SELECT own` — trainers can't see clients' names and vice versa; needs cross-visibility policies for the clients page
- `confirm-email.astro` handles DEV (auto-confirmed) vs production (check email) — generic enough for both trainer and client flows
- Auth components (`FormField`, `SubmitButton`, `ServerError`) are reusable for the modified signup form

## Desired End State

A trainer can sign in, navigate to `/trainer/clients`, click "Generate invite link," copy the URL, and share it. A client opens the URL, sees a personalized signup page ("You've been invited by {trainer name}"), registers with email+password, confirms their email, signs in, and lands on `/client/dashboard`. The trainer sees the invite marked as "used" in their invite list.

Verification: a full round-trip — generate → share → register → confirm → sign in → role routing — works end-to-end with the correct `trainer_clients` row and `invite_links.used_at` set.

## What We're NOT Doing

- **Email sending from UI** — PRD non-goal #5 (`prd.md:177`); copy-link only for MVP
- **Google OAuth for client signup** — email+password first per FR-001 Socrates note; Google adds redirect/state complexity with token preservation
- **Client removal** — S-11 (separate slice, depends on S-03)
- **Trainer dashboard** — S-07 (depends on S-04 + S-06)
- **Rate limiting invite generation** — single-use + 7-day expiry is sufficient for MVP
- **Duplicate assignment prevention** — no unique constraint on `(trainer_id, client_id)` in `trainer_clients`; acceptable for MVP since each invite is single-use
- **Exercise library or session templates on trainer page** — out of scope; `/trainer/clients` shows invites and client list only

## Implementation Approach

Four sequential phases following the data flow: database RPCs → trainer-side generation → client-side registration → post-auth routing. Each phase builds on the previous and has independent verification points.

## Critical Implementation Details

**Anon grants on SECURITY DEFINER RPCs:** Both `validate_invite_token` and `complete_client_invite` must be callable by unauthenticated users (the Supabase client in the API route uses the anon key during signup). Grant `EXECUTE` to both `anon` and `authenticated`. This does not weaken `invite_links` RLS — the RPCs encapsulate all access; the table remains trainer-only for direct queries.

**Token validation timing:** The token is validated twice — once server-side when the signup page loads (to decide whether to render the client form or an error), and once atomically inside `complete_client_invite` (to prevent race conditions between page load and form submission). If the token is consumed between page load and submission, `complete_client_invite` raises an exception and the API route returns an error.

---

## Phase 1: Database — Invite RPCs and Profile Cross-Visibility

### Overview

Create the two `SECURITY DEFINER` RPCs that the application layer needs to validate and consume invite tokens, plus RLS policies allowing trainers and clients to see each other's profile info.

### Changes Required:

#### 1. Invite RPCs migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_invite_rpcs.sql` (new)

**Intent**: Add `validate_invite_token(p_token text)` and `complete_client_invite(p_token text, p_client_id uuid)` as `SECURITY DEFINER` functions. The first returns token validity plus the trainer's display name for the signup page trust copy. The second atomically marks the invite used and creates the `trainer_clients` assignment — it must raise an exception if the token is invalid, expired, or already consumed.

**Contract**:

`validate_invite_token(p_token text) returns json` — returns `{ valid: true, trainer_id, trainer_display_name }` for a valid unused unexpired token; `{ valid: false, trainer_id: null, trainer_display_name: null }` otherwise. Joins `invite_links` to `profiles` for the trainer's name. Granted to `anon` and `authenticated`. `search_path = public`, revoke from `public`.

`complete_client_invite(p_token text, p_client_id uuid) returns void` — updates `invite_links` setting `used_at = now()` and `used_by_client_id = p_client_id` where `token = p_token AND used_at IS NULL AND (expires_at IS NULL OR expires_at > now())`. If no row updated, raise exception (token invalid/used/expired). Then inserts `trainer_clients` row linking the invite's `trainer_id` to `p_client_id`. Granted to `anon` and `authenticated`. `search_path = public`, revoke from `public`.

#### 2. Profile cross-visibility RLS policies

**File**: same migration

**Intent**: Allow trainers to SELECT their active clients' profiles (for the clients list page) and clients to SELECT their trainer's profile (for the client dashboard). Currently `profiles_select_own` only permits `id = auth.uid()`.

**Contract**: Two new SELECT policies on `public.profiles` for `authenticated`: one where `id IN (SELECT client_id FROM trainer_clients WHERE trainer_id = auth.uid() AND status = 'active')` and one where `id IN (SELECT trainer_id FROM trainer_clients WHERE client_id = auth.uid() AND status = 'active')`.

#### 3. InviteValidation TypeScript type

**File**: `src/types.ts`

**Intent**: Add a type matching the `validate_invite_token` RPC response for use in the signup page and API route.

**Contract**: `InviteValidation { valid: boolean; trainer_id: string | null; trainer_display_name: string | null; }`

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset`
- Lint passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- `validate_invite_token` returns valid data for a fresh unused token with the correct trainer name
- Returns `{ valid: false }` for expired, used, and nonexistent tokens
- `complete_client_invite` atomically marks `used_at` and creates `trainer_clients` row
- Calling `complete_client_invite` a second time with the same token raises an exception (single-use enforced)
- Trainer can SELECT their client's profile after assignment; client can SELECT their trainer's profile
- Neither can SELECT unrelated users' profiles

**Local manual verification** — Local Studio SQL Editor runs as a role that **cannot** `INSERT` into `auth.users` (`permission denied for table users`). Do **not** grant `INSERT` on `auth.users` to `authenticated`. Use the postgres-backed script instead:

```bash
# Requires: npx supabase start (Docker) and migrations applied
npm run verify:client-onboarding-p1
```

Script: `scripts/verify-client-onboarding-phase1.sql` (rolls back all test data). Expect: 2 profile rows, valid/invalid/expired RPC results, `PASS: second consume rejected` notice, trainer sees client (1 row), stranger blocked (0 rows), client sees trainer (1 row).

<details>
<summary>Studio-only fallback (hosted dashboard postgres role, or RPC-only if users already exist)</summary>

If you already have trainer + client profiles from app signup, replace the fixed UUIDs below with `select id, role from public.profiles`. Skip `auth.users` inserts. Hosted Supabase **SQL Editor** often runs as `postgres` and may allow `auth.users` inserts; local Studio does not.

```sql
begin;

-- Setup: auth.users → handle_new_user() creates profiles (profiles.id FK → auth.users)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'b1000001-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'trainer-verify@example.com',
    crypt('testpass123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"trainer","display_name":"Test Trainer"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b1000001-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'client-verify@example.com',
    crypt('testpass123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"client","display_name":"Test Client"}'::jsonb,
    now(), now()
  );

select id, role, display_name from public.profiles
where id in (
  'b1000001-0000-4000-8000-000000000001',
  'b1000001-0000-4000-8000-000000000002'
)
order by role;
-- Expect 2 rows

insert into public.invite_links (trainer_id, token, expires_at)
values (
  'b1000001-0000-4000-8000-000000000001',
  'test-token-plan-verification',
  now() + interval '7 days'
);

-- 1.4: validate valid / invalid / expired
select public.validate_invite_token('test-token-plan-verification');
-- Expect valid=true, trainer_display_name='Test Trainer'

select public.validate_invite_token('does-not-exist');
-- Expect valid=false

update public.invite_links
set expires_at = now() - interval '1 day'
where token = 'test-token-plan-verification';

select public.validate_invite_token('test-token-plan-verification');
-- Expect valid=false

update public.invite_links
set expires_at = now() + interval '7 days', used_at = null, used_by_client_id = null
where token = 'test-token-plan-verification';

-- 1.5: complete + single-use enforcement
select public.complete_client_invite(
  'test-token-plan-verification',
  'b1000001-0000-4000-8000-000000000002'::uuid
);

select used_at, used_by_client_id from public.invite_links
where token = 'test-token-plan-verification';

select trainer_id, client_id, status from public.trainer_clients
where trainer_id = 'b1000001-0000-4000-8000-000000000001';

do $do$
begin
  perform public.complete_client_invite(
    'test-token-plan-verification',
    'b1000001-0000-4000-8000-000000000002'::uuid
  );
  raise exception 'FAIL: second consume should have raised';
exception
  when others then
    raise notice 'PASS: second consume rejected: %', sqlerrm;
end;
$do$;

-- 1.6: profile cross-visibility (RLS as authenticated user)
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000001-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select auth.uid() as trainer_uid;

select id, display_name from public.profiles
where id = 'b1000001-0000-4000-8000-000000000002';
-- Expect 1 row

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  'b1000001-0000-4000-8000-000000000099',
  'authenticated', 'authenticated',
  'stranger-verify@example.com',
  crypt('testpass123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"role":"client","display_name":"Stranger"}'::jsonb,
  now(), now()
);

select id, display_name from public.profiles
where id = 'b1000001-0000-4000-8000-000000000099';
-- Expect 0 rows

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000001-0000-4000-8000-000000000002', true);
select auth.uid() as client_uid;

select id, display_name from public.profiles
where id = 'b1000001-0000-4000-8000-000000000001';
-- Expect 1 row

rollback;
```

</details>

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Invite Generation — Trainer Clients Page

### Overview

Build the trainer-facing invite generation flow: an API route to create invites and a `/trainer/clients` page with copy-link UX and an invite status list.

### Changes Required:

#### 1. Install shadcn components

**Intent**: Add `input`, `sonner`, and `badge` — needed for the read-only URL display, copy-to-clipboard toast feedback, and invite status indicators.

**Contract**: `npx shadcn@latest add input sonner badge`. Components land in `src/components/ui/`.

#### 2. Toaster provider in layout

**File**: `src/layouts/Layout.astro`

**Intent**: Mount the `<Toaster />` component from sonner so toast notifications work across all pages. Since sonner uses a DOM-level store, a single toaster instance in the layout serves all React islands.

**Contract**: Import and render `<Toaster client:load />` inside the body, after the `<slot />`.

#### 3. Invite creation API route

**File**: `src/pages/api/invites/index.ts` (new)

**Intent**: `POST /api/invites` — authenticated trainer generates a new invite link. Validates the user is authenticated with `role: trainer`, generates a cryptographically random token, inserts into `invite_links` with 7-day expiry, and returns the full invite URL.

**Contract**: `export const prerender = false`. `POST` handler. Request: no body needed (trainer identity from session). Response: JSON `{ url: string, invite: InviteLink }` on success; 401/403 JSON error for unauthenticated or wrong role; 500 for DB errors. Token generation via `crypto.randomUUID()`. Expiry: `now() + 7 days`.

#### 4. Trainer clients page

**File**: `src/pages/trainer/clients.astro` (new)

**Intent**: Trainer-only page at `/trainer/clients` that serves as the primary invite management surface. Fetches the trainer's invites and active clients server-side in the frontmatter and passes them as props to a React island.

**Contract**: Guarded by existing middleware (`/trainer/*` → requires authenticated user with `role: trainer`). Uses `Layout.astro`. Queries `invite_links` (ordered by `created_at desc`) and `trainer_clients` joined with `profiles` for client names. Renders the `InviteClientPanel` React island with the data.

#### 5. Invite client panel component

**File**: `src/components/trainer/InviteClientPanel.tsx` (new)

**Intent**: React island handling the invite generation UX — "Generate invite link" button, read-only URL display, clipboard copy with toast feedback, and a list of recent invites with computed status (active / used / expired). Also shows assigned clients if any exist.

**Contract**: Props: `invites: InviteLink[]`, `clients: (TrainerClient & { client: Pick<Profile, 'display_name'> })[]`, `origin: string`. Internal state holds the invite list (initialized from props, updated optimistically after POST). "Generate invite link" calls `POST /api/invites`. "Copy" uses `navigator.clipboard.writeText()` + `toast()` from sonner. Invite status computed from `used_at` and `expires_at` fields. Uses shadcn `input` (read-only for URL), `badge` (status), and `Button` (generate + copy).

### Success Criteria:

#### Automated Verification:

- Build succeeds: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Trainer can navigate to `/trainer/clients` after sign-in
- Clicking "Generate invite link" creates a link and displays the URL
- Clicking "Copy" copies the URL to clipboard and shows a toast
- Invite list shows correct status: active (green), used (gray), expired (red/amber)
- Non-trainer user accessing `/trainer/clients` is redirected to `/dashboard`
- Unauthenticated user accessing `/trainer/clients` is redirected to `/auth/signin`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Client Signup via Token

### Overview

Modify the existing signup flow to handle token-based client registration — validating the invite server-side, rendering a personalized client signup form, and completing the invite assignment after successful registration.

### Changes Required:

#### 1. Signup page token handling

**File**: `src/pages/auth/signup.astro`

**Intent**: Read the `token` query parameter and, when present, validate it server-side via the `validate_invite_token` RPC before rendering. If valid, pass the token and trainer name to `SignUpForm` for a personalized client signup. If invalid, render an error state explaining the token is expired/used/invalid with guidance to request a new link from the trainer. When no token is present, render the existing trainer signup form unchanged.

**Contract**: Reads `token` from `Astro.url.searchParams`. If token present, calls `supabase.rpc('validate_invite_token', { p_token: token })`. Passes `token`, `trainerName`, and `tokenError` props to `SignUpForm`. Error state: no form rendered, just an error message with a link back to `/auth/signin`. Preserves existing `?error=` handling for server-side form errors.

#### 2. SignUpForm token mode

**File**: `src/components/auth/SignUpForm.tsx`

**Intent**: Extend the signup form to support a client-mode when a valid invite token is provided. Shows the trainer's name as trust copy ("You've been invited by {name}"), includes a hidden input carrying the token through form submission, and adjusts heading and button text for the client context.

**Contract**: New optional props: `token?: string`, `trainerName?: string`. When `token` is present: heading changes to "Create your client account", trust copy shows trainer name, hidden `<input name="token" value={token} />` is included in the form, submit button says "Join as client". When `token` is absent: existing trainer signup behavior unchanged.

#### 3. Signup API token branch

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Branch the signup handler on the presence of a `token` form field. When a token is present: call `supabase.auth.signUp()` with `role: 'client'` in metadata, then call `complete_client_invite` RPC to atomically mark the invite used and create the `trainer_clients` assignment. On any failure, redirect back with `?token=…&error=…` to preserve context.

**Contract**: Reads `token` from form data. If token present: `signUp({ email, password, options: { data: { role: 'client' } } })`. On success, calls `supabase.rpc('complete_client_invite', { p_token: token, p_client_id: data.user.id })`. If RPC fails (token consumed/expired between page load and submit), redirects with error. If no token: existing trainer flow (`role: 'trainer'`). Both paths redirect to `/auth/confirm-email` on success.

### Success Criteria:

#### Automated Verification:

- Build succeeds: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- `/auth/signup?token=VALID_TOKEN` shows "Create your client account" with trainer name
- `/auth/signup?token=INVALID_TOKEN` shows friendly error (no form)
- `/auth/signup?token=EXPIRED_TOKEN` shows friendly error
- `/auth/signup?token=USED_TOKEN` shows friendly error
- `/auth/signup` (no token) shows trainer signup unchanged
- Client registration via valid token creates `profiles` row with `role: client`
- `trainer_clients` row links the correct trainer and client
- `invite_links.used_at` is set and `used_by_client_id` matches the new client
- Same token cannot be used for a second registration
- After registration, client sees "check your email" / "registration successful" (DEV)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Role-Based Post-Login Routing

### Overview

Update the signin flow to redirect users to role-appropriate pages and create a minimal client dashboard placeholder so clients have a landing page after sign-in.

### Changes Required:

#### 1. Signin role-based redirect

**File**: `src/pages/api/auth/signin.ts`

**Intent**: After successful `signInWithPassword`, look up the user's role from `profiles` and redirect to `/trainer/clients` (trainers) or `/client/dashboard` (clients) instead of the current hardcoded `/`.

**Contract**: After `signInWithPassword` succeeds, query `profiles` for `role` using the authenticated user's ID. Redirect: `trainer` → `/trainer/clients`, `client` → `/client/dashboard`, fallback → `/dashboard`.

#### 2. Client dashboard placeholder

**File**: `src/pages/client/dashboard.astro` (new)

**Intent**: Minimal landing page for clients after sign-in. Shows a welcome message and the trainer's name. Future slices (S-04, S-05) will add plan and calendar content here.

**Contract**: Guarded by middleware (`/client/*` requires `role: client`). Uses `Layout.astro`. Queries `trainer_clients` joined with `profiles` to get the trainer's display name. Renders welcome heading, trainer name, and a placeholder message about upcoming features.

#### 3. Update dashboard redirect

**File**: `src/pages/dashboard.astro`

**Intent**: The generic `/dashboard` page should redirect users to their role-specific page rather than showing a shared dashboard.

**Contract**: Read `Astro.locals.role` in frontmatter. If `trainer`, redirect to `/trainer/clients`. If `client`, redirect to `/client/dashboard`. If no role (shouldn't happen for authenticated users), stay on page as fallback.

### Success Criteria:

#### Automated Verification:

- Build succeeds: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Trainer sign-in redirects to `/trainer/clients`
- Client sign-in redirects to `/client/dashboard`
- Client dashboard shows welcome message with trainer name
- `/dashboard` redirects to the correct role-specific page
- Unauthenticated access to `/client/dashboard` redirects to `/auth/signin`
- Trainer accessing `/client/dashboard` is redirected to `/dashboard` (middleware)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:

- No unit test framework is configured yet; verification is via lint, build, and manual testing

### Integration Tests:

- Full round-trip: trainer generates invite → client registers via token → client signs in → lands on client dashboard → trainer sees invite marked as "used"
- Invalid token scenarios: expired, used, nonexistent — all show appropriate errors
- Role isolation: trainer cannot access `/client/*`, client cannot access `/trainer/*`

### Manual Testing Steps:

1. Sign in as trainer → navigate to `/trainer/clients` → generate invite link
2. Copy the invite URL → open in incognito/private window
3. Verify signup page shows "Create your client account" with trainer name
4. Register with email+password → confirm email (or auto-confirm in DEV)
5. Sign in as the new client → verify landing on `/client/dashboard` with trainer name
6. Switch back to trainer window → verify invite shows "used" status
7. Try opening the same invite URL again → verify error state (token already used)
8. Generate a new invite → wait for expiry (or manually set `expires_at` in past via SQL) → verify expired state

## Performance Considerations

- `validate_invite_token` RPC is a single indexed lookup (`token UNIQUE`) — negligible latency
- Invite list on `/trainer/clients` is fetched server-side (no client-side waterfall)
- No pagination needed for invites in MVP (trainers will have tens, not thousands)
- Clipboard API is synchronous and instant

## Migration Notes

- New migration adds RPCs and RLS policies only — no table schema changes
- Migration is additive; no rollback concern beyond dropping the new functions/policies
- Must run after `20260526120100_trainer_onboarding.sql` (depends on `invite_links`, `trainer_clients`, `profiles` tables)
- `SECURITY DEFINER` functions require explicit `REVOKE ALL FROM public` + selective `GRANT`

## References

- Research: `context/changes/client-onboarding/research.md`
- Resend reference (post-MVP): `context/changes/client-onboarding/resend-docs.md`
- PRD requirements: `context/foundation/prd.md:68-80` (FR-003/004/005)
- PRD non-goals: `context/foundation/prd.md:177` (no notifications)
- PRD access control: `context/foundation/prd.md:154-169`
- Roadmap S-03: `context/foundation/roadmap.md:110-120`
- ERD Q5 (single-use): `docs/ERD.md:498-506`
- F-01 plan (S-03 boundary): `context/changes/database-schema-and-rls/plan.md:47-48,64-65,408`
- Existing migration (invite_links schema): `supabase/migrations/20260526120100_trainer_onboarding.sql`
- Existing migration (handle_new_user): `supabase/migrations/20260526120000_enums_profiles_helpers.sql:77-107`
- Existing signup API: `src/pages/api/auth/signup.ts`
- Existing middleware: `src/middleware.ts`
- Existing types: `src/types.ts:23-31`
- Lessons learned: `context/foundation/lessons.md` (SQL verification scripts)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database — Invite RPCs and Profile Cross-Visibility

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — e7ab4a0
- [x] 1.2 Lint passes: `npm run lint` — e7ab4a0
- [x] 1.3 Build succeeds: `npm run build` — e7ab4a0

#### Manual

- [x] 1.4 `validate_invite_token` returns correct data for valid/invalid/expired/used tokens — e7ab4a0
- [x] 1.5 `complete_client_invite` atomically marks used + creates trainer_clients; second call raises exception — e7ab4a0
- [x] 1.6 Profile cross-visibility: trainer sees client profile, client sees trainer profile, neither sees unrelated users — e7ab4a0

### Phase 2: Invite Generation — Trainer Clients Page

#### Automated

- [x] 2.1 Build succeeds: `npm run build` — e7dfaca
- [x] 2.2 Lint passes: `npm run lint` — e7dfaca

#### Manual

- [x] 2.3 Trainer navigates to `/trainer/clients` and generates invite link — e7dfaca
- [x] 2.4 Copy button copies URL to clipboard with toast feedback — e7dfaca
- [x] 2.5 Invite list shows correct status (active/used/expired) — e7dfaca
- [x] 2.6 Non-trainer/unauthenticated access redirected correctly — e7dfaca

### Phase 3: Client Signup via Token

#### Automated

- [ ] 3.1 Build succeeds: `npm run build`
- [ ] 3.2 Lint passes: `npm run lint`

#### Manual

- [ ] 3.3 Valid token shows client signup with trainer name; invalid/expired/used shows error
- [ ] 3.4 Client registration creates profile with `role: client` and `trainer_clients` row
- [ ] 3.5 Token marked as used; second use rejected
- [ ] 3.6 Trainer signup (no token) still works unchanged

### Phase 4: Role-Based Post-Login Routing

#### Automated

- [ ] 4.1 Build succeeds: `npm run build`
- [ ] 4.2 Lint passes: `npm run lint`

#### Manual

- [ ] 4.3 Trainer sign-in → `/trainer/clients`; client sign-in → `/client/dashboard`
- [ ] 4.4 Client dashboard shows welcome with trainer name
- [ ] 4.5 `/dashboard` redirects to role-specific page
- [ ] 4.6 Role isolation enforced (middleware redirects wrong-role access)
