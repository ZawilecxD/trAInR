# Data Edit Window — Plan Brief

> Full plan: `context/changes/data-edit-window/plan.md`
> Research: `context/changes/data-edit-window/research.md`

## What & Why

Logged workout data can be edited for 24 hours after first entry, then sealed immutable (FR-022). Trainers rely on accurate client logs; the 24h window balances correction with data integrity.

## Starting Point

`locked_at` column exists but is never populated. Services have placeholder lock checks with wrong semantics. Edit UI is always writable.

## Desired End State

First log sets a UTC seal deadline. Writes blocked after 24h in service and RLS. Client sees countdown while editable and read-only seal state afterward.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| `locked_at` meaning | Seal deadline (first log + 24h UTC) | Enables countdown UI without cron | Plan |
| Seal check | `now >= locked_at` | Deadline model, not boolean flag | Plan |
| S-08 interaction | Unchanged | Completion is separate from seal | Research |
| Timezone | UTC only | Roadmap MVP risk mitigation | Roadmap |
| Restart | Clears `locked_at` | Fresh session gets new window | Plan |

## Scope

**In scope:** Migration RLS, service deadline logic, edit-list/guided UI, tests

**Out of scope:** TZ localization, trainer edits, S-08 reopen policy

## Architecture / Approach

```
first set_log upsert → set locked_at = min(logged_at)+24h
write path → isSessionSealed? → reject 423
RLS → is_workout_session_sealed(session_id) on set_logs mutations
UI → countdown if open; readOnly if sealed
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | -------------- | -------- |
| 1. Lock deadline | Migration + service | Wrong seal semantics |
| 2. UI | Banner + read-only | Missing guided mode |
| 3. Tests | Unit + RLS | Flaky time boundaries |

**Prerequisites:** S-06 logging (done)
**Estimated effort:** 3 phases, single focused slice

## Open Risks & Assumptions

- UTC-only may confuse non-UTC users (document in UI copy)
- Mid-session seal after 24h away is edge case but handled read-only

## Success Criteria (Summary)

- Editable within 24h of first log (UTC)
- Immutable after deadline (service + RLS)
- UI shows countdown / sealed state
