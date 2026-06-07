# Client Removal (S-11) Implementation Plan

## Overview

Implement FR-006: a trainer can remove a wrongly-assigned client from `/trainer/clients`. The relationship is soft-removed (`trainer_clients.status = 'removed'`, `removed_at` set); active `client_plans` are archived per ERD Q3. All client workout history and account data remain; the trainer no longer sees the client in their roster or via active-assignment helpers.

## Current State Analysis

**Schema and RLS are ready; application layer is missing.**

| Layer                                                           | Status      | Evidence                                                                                                                             |
| --------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `trainer_client_status` enum (`active`, `removed`)              | Done        | `20260526120000_enums_profiles_helpers.sql:29`                                                                                       |
| `trainer_clients.status` + `removed_at`                         | Done        | `20260526120100_trainer_onboarding.sql:7-14`                                                                                         |
| Trainer SELECT active-only                                      | Done        | `trainer_clients_trainer_select_active` policy lines 87-94                                                                           |
| Trainer UPDATE any owned row                                    | Done        | `trainer_clients_trainer_update` lines 102-107                                                                                       |
| `is_trainer_for_client` / `is_assigned_trainer` filter `active` | Done        | Same migration lines 44-74                                                                                                           |
| `client_plan_status` includes `archived`                        | Done        | `20260526120000_enums_profiles_helpers.sql:31`                                                                                       |
| S-03 clients page + invite flow                                 | Done        | `context/changes/client-onboarding/change.md` (`implemented`)                                                                        |
| Remove RPC / API / UI                                           | **Missing** | No route, no service, read-only client list in `InviteClientPanel.tsx`                                                               |
| Trainer RLS isolation after removal                             | **Gap**     | `client_plans_trainer_select_own` and `can_access_client_plan` grant trainer access by `trainer_id` only — no active-assignment gate |

### Key Discoveries:

- `InviteClientPanel.tsx` lines 196-210 render client names only — no actions
- `clients.astro` lines 25-30 already filters `.eq("status", "active")` — removed clients disappear from SSR without extra query changes
- `client_plans_trainer_update_own` allows setting `status = 'archived'` because the WITH CHECK passes when new `status <> 'active'` — archival can run in the same transaction as assignment removal while assignment is still active
- `get_my_assigned_trainer` and client dashboard fallback both filter `status = 'active'` — client sees generic welcome copy after removal (`dashboard.astro` lines 47-49)
- ERD Q3 (`docs/ERD.md:504`): on removal archive active plans, retain all logged data
- Roadmap open question on data retention is **resolved** (`roadmap.md:263`): sever link, retain data, hide from trainer

## Desired End State

A trainer on `/trainer/clients` can click **Remove** next to an assigned client, confirm in a dialog, and the client disappears from the list immediately. The `trainer_clients` row remains with `status = 'removed'` and `removed_at` populated; any active `client_plans` for that pair become `archived`. The client account and workout history are unchanged; the client no longer has an active trainer assignment. After removal, RLS blocks the trainer from SELECT/UPDATE on that client's plans, sessions, exercises, sets, and comments — not only roster UI hiding.

Verification: assign client via invite (S-03) → remove from clients page → trainer list empty for that client → client dashboard shows no trainer name → SQL confirms `removed` row and archived plans exist.

## What We're NOT Doing

- **S-04 plan assignment** — no calendar/plan authoring UI
- **S-07 trainer dashboard** — no client overview or session detail pages
- **Browse archived / removed clients** — roadmap future enhancement; S-11 tightens trainer RLS so a later "archived client browser" (S-07+) must add explicit read policies
- **Hard delete** of profiles, sessions, or `trainer_clients` rows
- **Revoking unused invite links** — "reject" in FR-006 means post-assignment removal; unused invites stay as-is
- **Re-invite policy changes** — existing invite flow unchanged; a later invite may create a new `trainer_clients` row (no unique constraint today)
- **Client-side removal UX** — client cannot remove their trainer in this slice
- **Email / notifications** — PRD non-goal

## Implementation Approach

Two phases following established patterns from S-03: atomic database RPC plus RLS tightening first, then API route + React island UX on the existing clients page. No new pages or navigation entries — removal extends the S-03 surface in place.

## Critical Implementation Details

**RPC ordering:** Archive active `client_plans` while the assignment is still `active`, then set `trainer_clients.status = 'removed'`. Archival UPDATE must run before assignment removal so `is_trainer_for_client` remains true for the plan `USING` clause on `client_plans_trainer_update_own`.

**RLS tightening (plan-review F1 — Fix B):** Replace `can_access_client_plan` trainer branch and policies that grant trainer access by `trainer_id` alone. Trainer reads/writes on plans and the session graph require `is_trainer_for_client(client_id)` (active assignment). Client history policies are unchanged.

**Idempotency:** If `remove_trainer_client` is called on an already-removed assignment, raise a clear exception (or no-op with 404 from API) — do not reset `removed_at`.

---

## Phase 1: Database — Remove Client RPC and RLS Tightening

### Overview

Add `remove_trainer_client(p_assignment_id uuid)` to atomically archive active plans and soft-remove the trainer–client assignment. Tighten RLS so trainers lose plan/session access after removal, not only roster visibility.

### Changes Required:

#### 1. Remove client RPC migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_remove_trainer_client.sql` (new)

**Intent**: Provide one transactional entry point for client removal so plan archival and assignment soft-delete cannot diverge.

**Contract**:

`remove_trainer_client(p_assignment_id uuid) returns void` — `SECURITY DEFINER` (trainer active-only SELECT blocks INVOKER soft-remove; same pattern as `complete_client_invite`), `search_path = public`.

1. Load `trainer_clients` row where `id = p_assignment_id`, `trainer_id = auth.uid()`, `status = 'active'`. If not found, raise exception `'Assignment not found or already removed'`.
2. `UPDATE client_plans SET status = 'archived', updated_at = now()` where `trainer_id = auth.uid()` and `client_id = <row.client_id>` and `status = 'active'`.
3. `UPDATE trainer_clients SET status = 'removed', removed_at = now()` where `id = p_assignment_id`.

Grant `EXECUTE` to `authenticated` only. Revoke from `public`.

#### 2. RLS tightening — active assignment required for trainer plan/session access

**File**: same migration

**Intent**: Close the gap where trainers retain SELECT/UPDATE on archived plans and workout data for removed clients via `trainer_id`-only policies. Aligns with FR-006 "trainer no longer sees removed client" at the RLS layer.

**Contract**:

Replace `can_access_client_plan(p_plan_id uuid)` trainer branch: require `cp.trainer_id = auth.uid() AND public.is_trainer_for_client(cp.client_id)` (client branch unchanged). Cascades to `can_access_workout_session`, `can_access_session_exercise`, and policies that use those helpers.

`DROP POLICY` + recreate on `client_plans`:

- `client_plans_trainer_select_own` — `USING (trainer_id = auth.uid() AND public.is_trainer_for_client(client_id))`
- `client_plans_trainer_update_own` — add `public.is_trainer_for_client(client_id)` to `USING` (keep existing `WITH CHECK`; archival still works while assignment is active)
- `client_plans_trainer_delete_own` — add `public.is_trainer_for_client(client_id)` to `USING`

`DROP POLICY` + recreate on `workout_sessions`:

- `workout_sessions_trainer_update` — require `public.is_trainer_for_client(cp.client_id)` in both `USING` and `WITH CHECK` subqueries (not `trainer_id` alone)
- `workout_sessions_trainer_delete` — same

`DROP POLICY` + recreate on `session_exercises`:

- `session_exercises_trainer_update` and `session_exercises_trainer_delete` — require `public.is_trainer_for_client(cp.client_id)` in subqueries

`workout_sessions_trainer_insert` and `session_exercises_trainer_insert` already gate active assignment for active plans; verify unchanged after `can_access_client_plan` update.

#### 3. Local verification script

**File**: `context/changes/client-removal/verification.sql` (new)

**Intent**: Copy-paste Supabase Studio script per `lessons.md` — transaction-wrapped JWT simulation, pass/fail expectations, `rollback` at end.

**Contract**: Covers happy path (trainer removes client, row `removed`, plan `archived`), trainer cannot SELECT removed assignment via active policy, trainer cannot SELECT archived `client_plans` or `workout_sessions` for removed client after removal, client retains plan history SELECT, double-remove raises exception.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset`
- Lint passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- `remove_trainer_client` soft-removes assignment and sets `removed_at`
- Active `client_plans` for that trainer–client pair become `archived`
- Second call on same assignment raises exception
- Trainer SELECT via app query (active filter) returns no row after removal
- Client can still SELECT own archived plan rows
- Trainer cannot SELECT `client_plans` or `workout_sessions` for removed client (RLS returns empty)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: API and Clients Page UI

### Overview

Expose removal via `DELETE /api/trainer-clients/[id]` and add confirmed remove action to the existing clients list in `InviteClientPanel`.

### Changes Required:

#### 1. shadcn alert-dialog

**File**: `src/components/ui/alert-dialog.tsx` (new via `npx shadcn@latest add alert-dialog`)

**Intent**: Confirmation pattern before destructive remove — matches shadcn new-york variant used elsewhere.

**Contract**: Standard shadcn alert-dialog exports usable from `InviteClientPanel`.

#### 2. Remove client API route

**File**: `src/pages/api/trainer-clients/[id].ts` (new)

**Intent**: Authenticated trainer-only endpoint that validates the assignment UUID and calls `remove_trainer_client`.

**Contract**: `export const prerender = false`. `DELETE` handler: 401 unauthenticated, 403 non-trainer, 400 invalid UUID (zod), 404/409 when RPC reports not found or already removed, 200 `{ ok: true }` on success. Use `createClient` from `@/lib/supabase` with request cookies.

#### 3. Clients list remove UX

**File**: `src/components/trainer/InviteClientPanel.tsx`

**Intent**: Add per-client **Remove** control with alert-dialog confirmation, loading/error state, optimistic removal from local `clients` state, and success toast via existing `sonner` pattern.

**Contract**: Dialog copy references client `display_name`. On confirm, `DELETE /api/trainer-clients/${row.id}`. Disable button while in-flight. No new routes or navigation — extend existing "Your clients" section only.

#### 4. Optional type export

**File**: `src/types.ts`

**Intent**: Only if needed — no new types expected; `TrainerClient` already includes `status` and `removed_at`.

**Contract**: No change unless API response type is introduced.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Trainer sees **Remove** on each client row on `/trainer/clients`
- Confirmation dialog appears; cancel leaves list unchanged
- Confirm removes client from list without full page reload
- Removed client no longer appears after browser refresh
- Client dashboard shows no trainer name (generic welcome copy)
- Non-trainer or wrong assignment id returns 403/404
- No regressions to invite generate/copy flow

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None required for MVP — RPC verified via SQL script; API is thin wrapper.

### Integration Tests:

- None in CI today; manual round-trip covers invite → assign → remove.

### Manual Testing Steps:

1. Sign in as trainer with at least one assigned client (use S-03 invite flow).
2. Open `/trainer/clients` → click **Remove** on a client → cancel → verify still listed.
3. Click **Remove** → confirm → verify toast and client disappears.
4. Refresh page → client still absent.
5. Sign in as that client → `/client/dashboard` shows generic welcome (no trainer name).
6. In Supabase SQL: verify `trainer_clients.status = 'removed'`, `removed_at` set, active plans archived.
7. Repeat remove on same assignment via API → expect error.
8. Verify invite generation still works.

## Performance Considerations

- Single RPC + one API round-trip per removal — negligible for MVP scale (tens of clients per trainer).
- Optimistic UI update avoids SSR refetch on success.

## Migration Notes

- Additive function + `CREATE OR REPLACE` / policy replacements — no table DDL changes.
- Depends on F-01 onboarding migration and S-03 invite RPCs already applied.
- Rollback: drop `remove_trainer_client`; restore prior `can_access_client_plan` and dropped policies from F-01 migrations.
- Future S-07 "browse archived clients" must add explicit trainer read policies — current tightening intentionally blocks that until designed.

## References

- PRD FR-006: `context/foundation/prd.md:79-80`
- Roadmap S-11: `context/foundation/roadmap.md:206-216`
- ERD Q3: `docs/ERD.md:504`
- S-03 plan (boundary): `context/changes/client-onboarding/plan.md:45`
- Schema: `supabase/migrations/20260526120100_trainer_onboarding.sql`
- Clients page: `src/pages/trainer/clients.astro`
- Clients panel: `src/components/trainer/InviteClientPanel.tsx`
- Invite API pattern: `src/pages/api/invites/index.ts`
- Lessons: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database — Remove Client RPC and RLS Tightening

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset`
- [x] 1.2 Lint passes: `npm run lint` — 6923636
- [x] 1.3 Build succeeds: `npm run build`

#### Manual

- [x] 1.4 `remove_trainer_client` soft-removes assignment and archives active plans — 6923636
- [x] 1.5 Double-remove raises exception; trainer active SELECT returns no row; client retains plan history — 6923636
- [x] 1.6 Trainer cannot SELECT archived plans or sessions for removed client after RLS tightening — 6923636

### Phase 2: API and Clients Page UI

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — b214bc1
- [x] 2.2 Build succeeds: `npm run build` — b214bc1

#### Manual

- [x] 2.3 Remove button + confirmation dialog on `/trainer/clients` — b214bc1
- [x] 2.4 Confirm removes client from list; refresh persists; client dashboard shows no trainer — b214bc1
- [x] 2.5 Auth errors and invite flow regressions verified — b214bc1
