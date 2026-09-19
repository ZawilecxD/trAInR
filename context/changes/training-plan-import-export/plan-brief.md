# Session template import/export — Plan Brief

> Full plan: `context/changes/training-plan-import-export/plan.md`
> Frame brief: `context/changes/training-plan-import-export/frame.md`

## What & Why

> **The actual problem to plan around is**: trainers need to import and export their **session template library** as JSON and as a human-readable XLSX of native per-set prescriptions — not to clone a client calendar, and not to ingest workout results.

Files are name-based. Exercise names become unique per trainer so that is safe.

## Starting Point

Templates already have CRUD (`createTemplate` / `updateTemplate`) and a library UI (`TemplatesHub`). Exercises are trainer-owned but names are not unique. There is no export/import or xlsx stack. Assignment and logging stay as they are.

## Desired End State

A trainer downloads one template as JSON or XLSX, edits it outside the app if they want, and imports it back with a create/skip/overwrite preview. Unknown exercise names abort the file. Clients still log results in the app. Calendar placement is still day-by-day from the library.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Portable object | Session templates | Calendar clone and log ingest were the wrong job | Frame |
| Actor | Trainer only | Clients cannot create sessions; logging stays in-app | Frame |
| Actuals | Out | Import must not write `set_logs` | Frame |
| File grain | One template per file | Simpler clash/preview than a whole library | Plan |
| Exercise identity | Name only + unique per trainer | No UUIDs in files; uniqueness makes names unambiguous | Plan |
| Archived on import | Fix-list error, do not bind | Unique includes archived; trainer unarchives or edits the file | Plan review |
| Uniqueness | CI trim, includes archived; suffix existing dupes | Matches how trainers think of names; index can apply | Plan |
| Clash | Preview create / skip / overwrite | Trainer decides; skip is a no-op | Plan |
| Failure | Abort whole file, fix-list, no writes | Partial imports would hide missing exercises | Plan |
| XLSX grain | One row per prescribed set | Native schema; round-trips with JSON DTO | Plan |
| XLSX library | ExcelJS on the server | `writeBuffer` / `load`; keep it out of React islands | Plan |

## Scope

**In scope:** unique exercise names; versioned JSON + XLSX of one template; name resolver + metric check; preview/commit APIs; TemplatesHub import/export; tests; Linear AC rewrite for ZAW-57.

**Out of scope:** client import, CSV, calendar import, `set_logs`, auto-create exercises, UUIDs in files, multi-week programs, unique **template** names (ambiguous template names abort).

## Architecture / Approach

DTO (`schema_version: 1`) ↔ JSON or XLSX encodings ↔ resolve names to `exercise_id` ↔ `createTemplate` / `updateTemplate`. Export/import HTTP under `/api/session-templates/…` with `requireTrainer`. UI on `/trainer/templates` only.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Unique exercise names | Index + suffix backfill + 409 on duplicate | Suffixes surprise trainers who already duplicated names |
| 2. Schema + resolver | DTO + name match + clash helper | Metric mismatch vs name-only identity |
| 3. JSON APIs | Export + preview/commit | Overwrite must not cross trainers |
| 4. XLSX | ExcelJS round-trip | Humans breaking the header row |
| 5. TemplatesHub UI | Import/export in the library | Hook vs lib split; Linear AC still describing client plans |

**Prerequisites:** local Supabase for Phase 1 integration/Studio checks; ExcelJS added in Phase 4.
**Estimated effort:** ~4–6 implementation sessions across 5 phases.

## Open Risks & Assumptions

- Duplicate exercise names in prod/local will be renamed with ` (2)` etc.; sessions keep UUIDs so history is intact.
- Template names may still collide; import then aborts until the trainer renames templates.
- PRODUCT.md “replace spreadsheets” still holds for **logging**; XLSX here is a trainer authoring file.

## Success Criteria (Summary)

- Trainer can round-trip one template as JSON and as XLSX using exercise names only.
- Duplicate exercise names (including case) cannot be created after Phase 1.
- Import never writes logs or calendar sessions; clash is an explicit preview choice.
