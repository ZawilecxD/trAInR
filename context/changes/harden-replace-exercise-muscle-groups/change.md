---
change_id: harden-replace-exercise-muscle-groups
title: Harden replace_exercise_muscle_groups RPC ownership check
status: implementing
created: 2026-06-08
updated: 2026-06-09
archived_at: null
---

## Notes

Close the KNOWN GAP documented in `tests/integration/security-definer/replace-exercise-muscle-groups.test.ts` (from archived `testing-rls-isolation-harness`).

**Current behaviour:** `replace_exercise_muscle_groups` is SECURITY DEFINER with no `auth.uid()` ownership check — any authenticated trainer can mutate another trainer's `exercise_muscle_groups` rows.

**Desired end state:**
- RPC rejects calls where `exercises.trainer_id <> auth.uid()`
- Pin `search_path = public` on the function
- Flip the integration test: expect error (remove `KNOWN GAP` from test name)

**References:**
- `supabase/migrations/20260529183853_replace_muscle_groups_rpc.sql`
- `src/lib/exercises/service.ts` (happy-path caller)
- Research: `context/archive/2026-06-07-testing-rls-isolation-harness/research.md` (after harness archive)
