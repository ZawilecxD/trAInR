# Prescription Fill Logging — Plan Brief

> Full plan: `context/changes/prescription-fill-logging/plan.md`

## What & Why

S-19 replaces the guided-workout per-set OK toggle with a one-click prescription fill action. This reduces gym-floor logging friction while keeping clients free to edit filled values and keeping workout outcome decisions at the session level.

## Starting Point

Guided workout rows currently autosave reps/load/duration plus `is_complete` and `is_warmup`. Progress, trainer readout, and one E2E hydration gate still depend on the old `is_complete` toggle.

## Desired End State

Clients tap a fill control on a prescribed round and the editable inputs populate from the prescription. Progress and trainer readout treat a set as logged when actual values exist, not when a completed flag is set. The database column stays for compatibility, but the product stops using it as state.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Schema strategy | Keep `set_logs.is_complete` | Avoids a destructive migration while the app can safely ignore the flag. |
| Fill behavior | Prefill editable inputs and autosave | Matches the current debounced logging model and lets clients adjust real performance. |
| Progress heuristic | Logged values only | Aligns client nav, continue targeting, and trainer readout with actual data. |
| E2E strategy | Add fill spec and update quick-nav spec | Covers the new primary path while preserving Risk #6 autosave safety. |

## Scope

**In scope:**

- Per-round prescription fill in guided workout rows.
- Removal of the visible per-set OK/completed toggle.
- Shared logged-value semantics for progress/readout/formatting.
- Unit, integration, and feasible E2E coverage.

**Out of scope:**

- Dropping `set_logs.is_complete`.
- Session status changes.
- Bulk fill-all controls.
- Broad UI redesign or React component test infrastructure.

## Architecture / Approach

Add a pure guided-workout helper for fill and logged-value detection, wire it through `SetLogRow`, then update progress/readout consumers to share that semantic. Persistence continues through the current `/api/client/set-logs` debounced upsert route.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Pure semantics and API compatibility | Helper + schema/service compatibility + unit tests | Compatibility with old `is_complete` payloads. |
| 2. Guided workout UI and derived progress | Fill button, no OK toggle, value-based nav progress | Controlled input hydration/autosave behavior. |
| 3. Trainer readout, integration, and E2E | Trainer semantics and cross-layer tests | Local Supabase/E2E environment availability. |

**Prerequisites:** S-06 guided logging exists; S-08 session completion remains separate; S-10 warm-up flags remain orthogonal.

## Open Risks & Assumptions

- Historical rows with `is_complete = true` and no values will now read as not logged.
- E2E can be run only when local Supabase/dev seed prerequisites are available.

## Success Criteria (Summary)

- Fill action populates prescribed reps/load or duration and persists after reload.
- Guided-workout progress and trainer readout no longer depend on the OK toggle.
- Unit and integration tests pass; E2E fill coverage runs where feasible.
