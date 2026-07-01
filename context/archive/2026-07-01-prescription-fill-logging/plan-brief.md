# Prescription Fill Logging — Plan Brief

> Full plan: `context/changes/prescription-fill-logging/plan.md`
> Linear: ZAW-50

## What & Why

Clients retype prescribed reps and load on every set during guided workouts. S-19 replaces the per-set OK/completed toggle with a one-click **Fill** action that copies prescription into editable log fields, and infers exercise progress from logged metric values instead of an explicit completion flag.

## Starting Point

S-06 shipped manual entry + OK toggle (`is_complete` on `set_logs`). Progress dots, edit-list resume, and trainer readout all key off `is_complete`. Session completion (finished/partial/cancelled) is already session-scoped via S-08.

## Desired End State

Each prescribed set row shows a Fill button that copies `prescribed_reps` / `prescribed_load_kg` / `prescribed_duration_seconds` into the log inputs (still editable before autosave). The OK column is gone. Nav progress and trainer readout treat a set as logged when metric-appropriate values are present (legacy `is_complete=true` rows still count). `is_complete` column remains in DB but is always `false` on new writes.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| `is_complete` column | Keep, stop using in UI | Avoid migration risk; legacy rows still readable | Plan |
| Fill behavior | Pre-fill editable fields on button click | Client can adjust before save; matches roadmap unknown resolution | Plan |
| Logged-set heuristic | Metric values present OR legacy `is_complete` | Smooth transition for existing data | Plan |
| Bulk fill | Per-row Fill only (no Fill all) | Minimal scope; one tap per set is enough for MVP | Plan |
| Session completion | Unchanged (S-08) | Explicitly out of scope per roadmap | Research |

## Scope

**In scope:** `isSetLogged` helper, `fillFromPrescription`, progress/readout heuristics, schema/service validation update, `SetLogRow` Fill button + OK removal, unit/integration/E2E tests, verification SQL.

**Out of scope:** Drop `is_complete` column, Fill-all bulk action, UI redesign (S-18), session status changes.

## Architecture / Approach

Pure helpers in `src/lib/guided-workout/` centralize logged-set detection and prescription-to-values mapping. `exercise-progress`, `logging-sets`, `format-prescription`, and `readout` import `isSetLogged`. API validates metric fields when values are present (not when `is_complete`). `SetLogRow` swaps OK column for Fill; autosave path unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Core lib + API | Heuristics, fill helper, schema/service | Legacy `is_complete` rows must still count as logged |
| 2. UI | Fill button, remove OK toggle | Hydration-sensitive E2E must use non-input control |
| 3. Tests + verify | Unit, integration, E2E, SQL script | E2E spec relied on OK toggle for hydration gate |

**Prerequisites:** S-06, S-08 shipped (done)

## Open Risks & Assumptions

- Rows with only `is_complete=true` and no metric values (edge case from S-06) remain "logged" via legacy path
- No DB migration required

## Success Criteria (Summary)

- Client taps Fill → prescribed values appear in inputs and persist via autosave
- Exercise nav progress updates from filled values without OK toggle
- Trainer readout reflects same heuristic
- All automated tests pass
