---
topic: S-13 data edit window
researcher: cursor-agent
date: 2026-07-01
---

# Research: Data Edit Window (S-13)

## Summary

`workout_sessions.locked_at` exists but is never set. App services check `if (locked_at)` (truthy) but RLS has no seal enforcement. Edit-list UI is always writable. S-08 completion mode is separate (terminal status → read-only `completed` view).

## Code References

- `src/lib/set-logs/service.ts:99-101` — forward-compat lock check (wrong semantics: treats any `locked_at` as locked)
- `src/lib/workout-sessions/service.ts:331-333` — restart lock check (same issue)
- `src/lib/guided-workout/session-mode.ts` — ignores `locked_at`
- `src/components/guided-workout/SessionEditList.tsx` — no countdown or seal banner
- `src/components/guided-workout/SetLogRow.tsx` — no `readOnly` prop
- `supabase/migrations/20260526120400_sessions_logging_comments.sql:50,391-424` — column + RLS without seal gate

## Architecture Insights

- **Deadline model**: `locked_at` stores the UTC instant when editing seals (`first_logged_at + 24h`). Set on first `set_log` upsert. Sealed when `now() >= locked_at`.
- **S-08 interaction**: Terminal session status still routes to `completed` mode (no reopen). Seal applies to in-progress (`not_started`) sessions with logs.
- **Restart**: Must clear `locked_at` when logs are wiped.

## Gaps for S-13

1. Set `locked_at` on first log
2. Fix seal checks (`now >= locked_at`, not truthy)
3. RLS deny INSERT/UPDATE/DELETE on `set_logs` when sealed
4. UI countdown + read-only inputs when sealed
5. Tests (unit helpers, RLS integration)
