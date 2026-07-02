# Optional RPE Logging — Plan Brief

> Full plan: `context/changes/optional-rpe-logging/plan.md`
> Linear: ZAW-53

## What & Why

Clients can optionally record RPE (Rate of Perceived Exertion, 1–10) for each exercise round when logging a session. Trainers and clients see RPE in session readouts when logged; leaving it blank remains valid so gym logging stays low-friction.

## Starting Point

Set logging via `SetLogRow` + `/api/client/set-logs` persists reps, load, duration, and warmup. `set_logs` has no RPE column. `SessionExerciseSummary` and trainer readout show prescribed vs actual metrics but not effort.

## Desired End State

A nullable `rpe` column on `set_logs` (1–10 integer). Guided workout rows expose an optional RPE input that autosaves with other set fields. Trainer dashboard and client summary/completed views show an RPE column with values or "—". Edit-window semantics (S-13) apply to RPE like other set fields.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Who logs RPE | Client only | v1 scope; no prescribed target RPE | Linear / Plan |
| Scale | Integer 1–10 (Borg CR-10) | Matches roadmap default; simpler mobile input | Plan |
| Empty display | Show "—" in summary tables | Consistent with reps/load columns | Plan |
| Stats impact | Display-only | S-12 not in scope; avoid coupling | Plan |
| Logged-set heuristic | RPE does not affect `isSetLogged` | Effort is optional metadata, not completion | Plan |

## Scope

**In scope:** DB migration, types, API schema/service, `SetLogRow` input, readout surfaces, unit + integration + E2E tests, Studio verification SQL.

**Out of scope:** Prescribed target RPE, half-step values, stats aggregation, trainer editing RPE.

## Architecture / Approach

Add nullable `rpe` to `set_logs` → extend `SetLog` type and zod schema → include in upsert payload → add compact RPE input column in `SetLogRow` → show RPE in `SessionExerciseSummary` (shared readout). RLS unchanged (column inherits existing row policies).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data layer | Migration + types + API | Migration ordering on remote Supabase |
| 2. UI surfaces | Logging input + readouts | Mobile table width |
| 3. Tests + verify | Unit, integration, E2E, SQL script | E2E hydration timing |

**Prerequisites:** S-06 guided logging, S-13 edit window (done).
**Estimated effort:** 3 phases, single focused slice.

## Open Risks & Assumptions

- Remote Supabase must run migration before integration tests pass locally against linked DB.
- Adding a table column in `SetLogRow` may require horizontal scroll on narrow mobile — acceptable per DESIGN.md instrument-panel pattern.

## Success Criteria (Summary)

- Client can save a set with or without RPE; value persists and appears in trainer + client readouts.
- Sealed sessions block RPE edits (inherits S-13).
- Automated tests cover schema validation, RLS upsert with nullable `rpe`, and E2E persistence.
