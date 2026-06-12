# Harden replace_exercise_muscle_groups RPC — Plan Brief

> Full plan: `context/changes/harden-replace-exercise-muscle-groups/plan.md`
> Change notes: `context/changes/harden-replace-exercise-muscle-groups/change.md`

## What & Why

`replace_exercise_muscle_groups` is a SECURITY DEFINER RPC that bypasses `exercise_muscle_groups` RLS without checking that the caller owns the target exercise. Any authenticated trainer can wipe or rewrite another trainer's muscle-group links. We close this gap so cross-tenant RPC calls fail at the database layer.

## Starting Point

The RPC exists from S-01 exercise library work (`20260529183853`). App code calls it only on exercises the trainer already owns, but the DB function has no `auth.uid()` guard. A KNOWN GAP integration test in `tests/integration/security-definer/` documents that Trainer B's call currently succeeds.

## Desired End State

Cross-trainer RPC calls return an error and leave junction rows untouched. Owning trainers can still replace muscle groups via the existing app flow. The KNOWN GAP test is flipped to assert rejection. Function has `search_path = public` and schema-qualified references.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Ownership guard | `exists` check on `exercises.trainer_id = auth.uid()` before mutation | Matches `remove_trainer_client` pattern; blocks cross-tenant abuse | Plan |
| Failure mode | `raise exception 'Exercise not found or not authorized'` | Opaque message avoids leaking exercise existence to non-owners | Plan |
| Migration strategy | New `create or replace` migration | Standard repo practice; keeps history immutable | Plan |
| App-layer changes | None | API already gates by trainer role + exercise ownership via RLS | Research |
| Test scope | Flip KNOWN GAP + add owner happy path + post-rejection row check | Proves both rejection and non-mutation in one file | Plan |
| Error assertion style | `expect(error).not.toBeNull()` only | Consistent with other integration tests; no brittle message matching | Plan |

## Scope

**In scope:** New migration hardening `replace_exercise_muscle_groups`; flip and extend `tests/integration/security-definer/replace-exercise-muscle-groups.test.ts`; Studio SQL verification script; update `change.md` status.

**Out of scope:** `complete_client_invite` hardening, RLS policy changes, API/UI changes, new composite RPCs.

## Architecture / Approach

Single ownership `exists` guard at RPC entry → existing delete-all-then-insert logic unchanged. Two phases: (1) ship migration and verify with Studio SQL, (2) flip integration test and run full integration suite. App `service.ts` unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Harden RPC | Migration with ownership check + `search_path` pin | Typo in guard could block legitimate owner calls — mitigated by happy-path test |
| 2. Flip integration test & verify | KNOWN GAP removed; cross-tenant + owner tests green | Must assert rows unchanged after rejection, not just error presence |

**Prerequisites:** Local Supabase running; S-01 exercise library and testing harness complete (both done).
**Estimated effort:** ~1 focused session across 2 phases.

## Open Risks & Assumptions

- Assumes only trainers (authenticated role) call this RPC — clients have no exercise write path; no client-role test needed.
- Generic error message means app layer cannot distinguish "not found" from "not authorized" — acceptable since `service.ts` only calls on exercises the trainer already created/selected.

## Success Criteria (Summary)

- Trainer B cannot mutate Trainer A's muscle groups via RPC; junction rows survive the rejected call.
- Trainer A's create/update exercise flow still replaces muscle groups successfully.
- `npm run test:integration` and CI `test-integration` job pass with no KNOWN GAP in test output.
