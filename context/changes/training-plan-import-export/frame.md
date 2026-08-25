# Frame Brief: Training plan import/export

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

ZAW-57 assumed JSON-only import/export of a client training plan (prescriptions; no `set_logs`). The product owner wants trainers to also generate a human-readable XLSX of stacked session tables. Screenshot layout is inspiration only, not 1:1.

## Initial Framing (preserved)

- **User's stated cause or approach**: The Linear description is wrong because it only assumed JSON; the real job is JSON + spreadsheet of the same plan, with optional actuals on import.
- **User's proposed direction**: Export JSON and XLSX; import both; on import pick a client and whether to include filled results; later also let clients import/export behind a config flag (CSV was dropped after first narrowing).
- **Pre-dispatch narrowing**: Leading concern = fillable workout sheet. Either trainer or client may fill empty cells. CSV dropped; keep JSON and XLSX.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Job fusion** — JSON plan-clone onto a client calendar vs XLSX fillable sheet vs trainer template library. ← initial framing (“add XLSX as another format of the client plan, optional actuals”)
2. **Sheet layout vs app schema** — screenshot-style compact rows vs per-set kg / reps-or-duration / rest / warmup.
3. **Actuals as a second write path** — filled cells are `set_logs` + seals, not template/session create.
4. **Who may write what** — trainer vs client; library vs assigned calendar.
5. **Portable object** — `session_templates` (undated, trainer-owned) vs `client_plans` / `workout_sessions` (dated, assigned). ← **revised user direction**

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Job fusion: JSON clone ≠ XLSX sheet ≠ template library | Templates = one session (`src/types.ts:81–88`); client calendar is dated snapshots via `create_workout_session`; PRODUCT.md replaces spreadsheet loop | STRONG |
| “Same client plan, two formats + optional logs” | Prescription create never writes `set_logs`; trainer cannot INSERT logs; seals block historical writes | NONE as the product job (user withdrew actuals and client-calendar import) |
| Schema mismatch vs screenshot extras | Native template sets match session sets (`src/types.ts:90–109`); no `%1RM` / wellbeing | STRONG; user locked native fields |
| Actuals = second write path | Client-only `PUT /api/client/set-logs`; trainer writes blocked | STRONG; user then **removed actuals from scope** |
| Actor: trainer import ≠ client import | Trainer-owned `exercises` and templates; clients cannot INSERT sessions | STRONG; user locked **trainer only** |
| Portable object is session templates, not client calendars | Template APIs: `src/pages/api/session-templates/index.ts`, `[id].ts`; assignment is “add session from template” on `ClientPlanHub` | STRONG after revision |

## Narrowing Signals

First round (then superseded):

- User wanted both JSON and XLSX in one slice, log backfill including existing sessions, trainer-only, native fields only.

Revision (authoritative):

- **Trainer only.** No client import/export, no config flag this slice.
- **Prescription only.** No empty result columns as a product feature; import **does not** write `set_logs` or edit what the client lifted. Clients log reps/weight/RPE in the app.
- **Portable object = session templates** (existing trainer library: one session per template, no dates).
- **Assignment is out of import.** Placing an imported template onto a client is the existing day-by-day calendar flow.
- **JSON and XLSX both round-trip** the same prescription; XLSX is the human-readable form of that payload.
- CSV out. Screenshot extras (`%1RM`, wellbeing, compact intensity-as-source-of-truth) out.

## Cross-System Convention

This repo already splits **authoring** (`session_templates` → `template_exercises` → `template_exercise_sets`) from **assignment** (snapshot copy onto `workout_sessions` via `create_workout_session` / ClientPlanHub) from **logging** (`set_logs`, client-only).

The revised job sits entirely in the authoring layer. That matches FR-010/011 (templates, snapshot-on-assign) and avoids PRODUCT.md’s “replace the spreadsheet loop” conflict *as a logging channel*. XLSX remains a trainer file for the template library, not a client workout sheet.

Independent check still stands for the *withdrawn* backfill idea; it does not apply to template-only prescription files except: nested per-round schema, exercise UUID/name resolution, and XLSX as a lossy pivot of native fields.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: trainers need to import and export their **session template library** as JSON and as a human-readable XLSX of native per-set prescriptions — not to clone a client calendar, and not to ingest workout results.

ZAW-57 as written (export an assigned client’s active plan; import writes sessions onto that client) is the wrong object. The library is templates. Dates and client identity are not in the file. Import creates or updates templates in the trainer’s library; the trainer still assigns sessions one by one from that library.

The earlier “fillable sheet + optional actuals + pick a client on import” framing fused logging and assignment into a file format. Those stay in-app.

## Confidence

**HIGH.** The portable object, actor, and “no logs” rule are now explicit. Remaining plan-level questions (one template vs whole library per file, create vs overwrite on name clash, XLSX table layout that still round-trips per-set rows) are solution design, not framing.

## What Changes for /10x-plan

Plan **trainer session-template import/export** (JSON + XLSX, same prescription schema, native per-set fields). Do **not** write `workout_sessions` or `set_logs` on import. Do **not** take `client_id` as the import target. Reuse existing template create/update APIs and exercise-library resolution. Update Linear ZAW-57 acceptance criteria to match this object (templates, not client-plan calendar clone). UI lives with the template library, not as “import onto this client’s plan.”

## References

- Linear: [ZAW-57](https://linear.app/zawilecxd/issue/ZAW-57/add-importexport-for-training-plans) — description still reflects the withdrawn client-plan + JSON-only shape
- Types: `src/types.ts:81–109` (templates), `139–171` (sessions/logs — out of import)
- APIs: `src/pages/api/session-templates/index.ts`, `src/pages/api/session-templates/[id].ts`
- Assignment (unchanged): `src/components/plans/ClientPlanHub.tsx`, `create_workout_session` RPC
- Logging (out of scope): `src/pages/api/client/set-logs.ts`
- Product: `PRODUCT.md:13`, `context/foundation/prd.md` FR-010–012, Non-Goal #12 (no multi-week plan templates)
