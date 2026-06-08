---
change_id: harden-complete-client-invite
title: Harden complete_client_invite p_client_id binding
status: new
created: 2026-06-08
updated: 2026-06-08
archived_at: null
---

## Notes

Close the KNOWN GAP documented in `tests/integration/security-definer/complete-client-invite.test.ts` (from archived `testing-rls-isolation-harness`).

**Current behaviour:** `complete_client_invite(p_token, p_client_id)` does not verify `p_client_id = auth.uid()`. A signed-in user with a valid unused token can assign the invite to a different user's UUID.

**Design constraint:** Pre-auth signup calls this RPC before a session exists — any hardening must preserve the anon signup path (`src/pages/api/auth/signup.ts`).

**Options to evaluate in /10x-frame or /10x-plan:**
- When caller is `authenticated`, require `p_client_id = auth.uid()`
- Restrict `authenticated` execute grant; keep `anon` only for signup flow
- Alternative token-binding scheme

**Desired end state:**
- Fraudulent cross-user assignment blocked for authenticated callers
- Signup-with-token flow still works for anon callers
- Flip the integration test assertion (remove `KNOWN GAP` from test name)

**References:**
- `supabase/migrations/20260604120000_invite_rpcs.sql`
- `src/pages/api/auth/signup.ts`
- Research: `context/archive/2026-06-07-testing-rls-isolation-harness/research.md` (after harness archive)
