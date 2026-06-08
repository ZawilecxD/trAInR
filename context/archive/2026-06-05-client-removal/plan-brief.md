# Client Removal (S-11) — Plan Brief

> Full plan: `context/changes/client-removal/plan.md`

## What & Why

Trainers need a safe way to undo a wrong client assignment (leaked invite, mistaken signup) without deleting the client's account or workout history. FR-006 requires soft removal: sever the active trainer–client link, hide the client from the trainer's roster, retain all data.

## Starting Point

S-03 delivered `/trainer/clients` with invite generation and a read-only active client list. F-01 already defined `trainer_clients.status`, `removed_at`, and RLS that hides non-active assignments from trainers. No remove RPC, API, or UI exists yet.

## Desired End State

On `/trainer/clients`, the trainer confirms removal in a dialog; the client vanishes from the list. Behind the scenes the assignment is `removed` with a timestamp, active plans are `archived`, and the client keeps their account and history but loses the active trainer link.

## Key Decisions Made

| Decision                    | Choice                                            | Why (1 sentence)                                                           | Source         |
| --------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- | -------------- |
| Removal mechanism           | Soft update (`status=removed`, `removed_at`)      | Matches schema design and roadmap retention policy                         | Research / ERD |
| Plan handling               | Archive active `client_plans` in same transaction | ERD Q3; prevents orphaned active plans                                     | ERD            |
| Backend entry point         | `remove_trainer_client` RPC + thin DELETE API     | Atomicity; mirrors S-03 invite RPC pattern                                 | Plan           |
| UX surface                  | Extend `InviteClientPanel` only                   | Avoid scope creep into S-04/S-07                                           | Plan           |
| "Reject" semantics          | Same as post-assignment remove                    | No pending-assignment state exists pre-signup                              | Plan           |
| Re-invite after removal     | Allow via existing invite flow (new row)          | No unique constraint; out of scope to block                                | Plan           |
| Post-removal trainer access | Tighten RLS — active assignment required          | Plan-review F1 Fix B; blocks trainer reads on plans/sessions after removal | Plan review    |

## Scope

**In scope:** `remove_trainer_client` RPC, RLS tightening (`can_access_client_plan` + trainer plan/session policies), `DELETE /api/trainer-clients/[id]`, remove button + confirmation on clients list, SQL verification script.

**Out of scope:** Trainer dashboard (S-07), plan assignment (S-04), archived-client browser, invite revocation, client-initiated unlink, notifications.

## Architecture / Approach

```
Trainer UI (InviteClientPanel)
  → DELETE /api/trainer-clients/[assignmentId]
    → supabase.rpc('remove_trainer_client')
      → archive active client_plans
      → trainer_clients.status = 'removed', removed_at = now()
```

RLS and existing active-only queries automatically hide the client from the trainer without list-query changes.

## Phases at a Glance

| Phase                      | What it delivers                                            | Key risk                                                        |
| -------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| 1. Remove client RPC + RLS | Transactional soft-remove, plan archival, trainer isolation | Archive must run before assignment removal; policy blast radius |
| 2. API + clients UI        | DELETE route, dialog, optimistic list update                | Missing shadcn alert-dialog install                             |

**Prerequisites:** S-03 implemented; local Supabase with F-01 migrations applied.

**Estimated effort:** ~1–2 sessions across 2 phases.

## Open Risks & Assumptions

- Assumes no `client_plans` rows exist yet in most dev scenarios — archival step is still required for ERD compliance when S-04 lands.
- Client dashboard copy ("Your trainer will assign…") is acceptable post-removal until a dedicated unassigned state ships.
- S-07 archived-client browse will need new explicit read policies — S-11 intentionally blocks trainer access to removed clients' data.

## Success Criteria (Summary)

- Trainer removes a client from `/trainer/clients` with confirmation.
- Removed client no longer visible to trainer (including after refresh).
- Assignment row and client data retained in database; active plans archived.
- Client account still accessible; no active trainer shown on dashboard.
