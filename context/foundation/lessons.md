# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Deliver copy-paste Supabase Studio SQL for local manual verification

- **Context**: `/10x-implement` manual gates, RLS checks, migration verification, and any work verified in Supabase Studio SQL Editor.
- **Problem**: Without a ready script, `set_config` outside a transaction can produce false passes; Studio often runs with elevated privileges so RLS looks broken; and the user must invent JWT/session setup themselves.
- **Rule**: When manual SQL verification is expected, always deliver a single copy-paste Studio script using `begin`, `set local role authenticated`, and transaction-scoped `set_config` for `request.jwt.claim.sub` / `role` when the scenario needs it; include `select auth.uid()` sanity checks, explicit pass/fail expectations per query, and `rollback` at the end. Look up existing user UUIDs from the DB or create test users for the scenario, then clean up via rollback.
- **Applies to**: all (whenever manual SQL verification is expected)

## Verify commit on remote before citing SHAs externally

- **Context**: `/10x-implement` phase-end ritual, `/linear-sync` `phase-*-complete` comments, PR descriptions, or any tracker comment that cites `git rev-parse --short HEAD`.
- **Problem**: A SHA can exist locally while `plan.md` progress, `linear_issue` linkage, or the cited hash are still uncommitted or unpushed — the external comment then disagrees with what anyone sees on the remote branch and looks fabricated even when the commit was real.
- **Rule**: Finish the phase-end commit (code + `change.md` + plan checkboxes), push the branch, run `git rev-parse --short HEAD` on the commit that contains the phase work, then write that SHA into Progress and external sync; never post a phase-complete SHA to Linear before push, and amend or follow up if the phase commit was incomplete when first cited.
- **Applies to**: implement, linear-sync
