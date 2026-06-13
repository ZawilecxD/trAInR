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

## Thread userId from the guard into service functions rather than re-calling getUser()

- **Context**: `src/lib/workout-sessions/service.ts` — `listMySessionsAsClient`
  called `supabase.auth.getUser()` internally even though `requireClient` in the
  API route had already verified and extracted the user.
- **Problem**: Re-calling `getUser()` inside the service creates a redundant auth
  round-trip and introduces a null-user edge case between guard and service (session
  expires in between → service returns empty data instead of an error). The trainer
  pattern (`listSessionsForClient` receiving `trainerId`) avoids this entirely.
- **Rule**: Service functions that operate on behalf of an authenticated caller should
  receive `userId` (or `trainerId`, `clientId`) as an explicit parameter from the API
  route guard, not re-derive identity from `auth.getUser()`. Reserve internal
  `auth.getUser()` calls for services that may be invoked outside of a guarded route.
- **Applies to**: plan, implement

## Distinguish utility extraction from hook extraction in plans

- **Context**: `src/lib/week-view.ts` — plan said "extract to `src/components/hooks/`
  if it grows beyond local state"; implementation put pure functions in `src/lib/`.
- **Problem**: Plans that say "extract to hooks/" are ambiguous when the extracted
  logic turns out to be pure utilities (no React state/effects). Pure utilities
  landed in the wrong stated location even though `src/lib/` is architecturally
  more correct.
- **Rule**: When planning an extraction, distinguish the outcome upfront: if the
  extracted logic needs React lifecycle (useState, useEffect, useRef), target
  `src/components/hooks/`; if it's pure computation (date math, grouping,
  formatting), target `src/lib/`. Write the target path accordingly in the plan
  so reviewers don't flag a correct decision as drift.
- **Applies to**: plan, plan-review

## Plan navigation for new user-facing routes

- **Context**: Any `/10x-plan` phase that adds new pages, routes, or primary user workflows (especially role-scoped areas like `/trainer/*`).
- **Problem**: Without planned entry points, implementers ship unreachable features; manual verification stalls because testers must know URLs, and the slice feels incomplete even when CRUD works.
- **Rule**: When a plan adds new user-facing pages or routes, include navigation and discoverability in the same phase—header/topbar links, dashboard entry points, and post-action redirects—not as a follow-up or implicit assumption.
- **Applies to**: plan, plan-review, implement
