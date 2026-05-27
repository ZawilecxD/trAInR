# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Deliver copy-paste Supabase Studio SQL for local manual verification

- **Context**: `/10x-implement` manual gates, RLS checks, migration verification, and any work verified in Supabase Studio SQL Editor.
- **Problem**: Without a ready script, `set_config` outside a transaction can produce false passes; Studio often runs with elevated privileges so RLS looks broken; and the user must invent JWT/session setup themselves.
- **Rule**: When manual SQL verification is expected, always deliver a single copy-paste Studio script using `begin`, `set local role authenticated`, and transaction-scoped `set_config` for `request.jwt.claim.sub` / `role` when the scenario needs it; include `select auth.uid()` sanity checks, explicit pass/fail expectations per query, and `rollback` at the end. Look up existing user UUIDs from the DB or create test users for the scenario, then clean up via rollback.
- **Applies to**: all (whenever manual SQL verification is expected)
