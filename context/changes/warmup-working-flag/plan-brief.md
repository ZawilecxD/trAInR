# Warm-up vs Working Set Flag (S-10) — Plan Brief

> Full plan: `context/changes/warmup-working-flag/plan.md`
> Linear: [ZAW-15](https://linear.app/zawilecxd/issue/ZAW-15)

## What & Why

Trainers program warm-up rounds separately from working sets within the same exercise (e.g. bench: 2×40 kg warm-up, then 3×80 kg working). Clients should not re-tag every warm-up set at the gym. S-10 adds `is_warmup` on prescription rows and logged sets: trainer sets intent, client logs inherit the default and can override, and only working logged sets feed stats and hints.

## Starting Point

S-14 per-round prescription exists on `template_exercise_sets` and `session_exercise_sets`. `set_logs.is_warmup` exists (default `false`) but the set-log service hardcodes `false` and there is no UI. Trainer round editors and workout RPCs do not carry the flag yet.

## Desired End State

Trainer toggles warm-up/working on each round in the **main** phase only (template builder and session personalization). Warm-up-phase exercises always prescribe `is_warmup = true`; cool-down always `false`. Assignment RPCs snapshot the flag. Guided workout rows show muted warm-up vs full-strength working styling; new logs default from prescription; client can flip the toggle. Extra client-added rounds default to working. Lint, typecheck, build, and tests pass.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Prescription vs logging | Both tables + `set_logs` | Trainer intent reduces tap burden; log row is stats source of truth | Plan |
| Client override | Allowed | Gym reality: extra/fewer warm-ups than prescribed | Plan |
| Extra client rounds | Default working | No prescription row → treat as working set | Roadmap |
| Stats contract | `set_logs.is_warmup` only | Prescription alone must not affect 1RM/hints | PRD |
| Trainer readout | Defer to S-07 | Dashboard not built yet | Roadmap |
| UX pattern | Toggle per round / per log row | Matches existing OK-toggle and round editor patterns | Plan |
| Phase-scoped prescription | Toggle in **main** only; warm_up → always warm-up; cool_down → always working | Phase already segments session structure; per-round flag only matters where working sets are programmed | Implementation |
| Client toggle layout | Full "Warm-up" / "Working" labels; `text-[11px]` + min button width | Prevents label wrap in narrow set-log table cells | Implementation |

## Scope

**In scope:** DB migration; types/schemas; template + session forms; workout RPC snapshot; set-log API/service; guided workout UI + hook; unit/integration tests; ERD sync.

**Out of scope:** FR-019 hint filtering (no hints shipped yet); S-12 stats UI; S-07 trainer dashboard display; S-13 edit-window UI changes beyond passing `is_warmup` in edit list.

## Architecture / Approach

Vertical slices: (1) schema + RPCs, (2) trainer prescription UI, (3) client logging inherit/override, (4) tests. Mirror the `is_complete` logging chain and S-14 per-round field pattern for `is_warmup`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Schema + RPCs | `is_warmup` on prescription tables; RPCs persist flag | RPC JSON backward compat (`false` when absent) |
| 2. Trainer UI | Round toggle in TemplateForm + SessionForm | Duplicated round UI in two forms |
| 3. Client logging | Inherit default, override, muted styling | Autosave must include `is_warmup` |
| 4. Tests + docs | Unit/integration coverage; ERD types | Integration RPC test drift |

**Prerequisites:** S-02, S-04, S-06, S-14 (all done)

## Open Risks & Assumptions

- Existing templates/sessions backfill to `is_warmup = false` (all working) — acceptable.
- `create_workout_session` / `update_workout_session_snapshot` must be replaced in a new migration (do not edit old migration files).

## Success Criteria (Summary)

- Trainer can mark prescribed rounds warm-up/working in templates and sessions.
- Client sees correct default on log rows and can override; warm-up rows render muted.
- RPC snapshot and set-log upsert persist `is_warmup` correctly.
