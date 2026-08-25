<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Session template import/export

- **Plan**: context/changes/training-plan-import-export/plan.md
- **Mode**: Deep
- **Date**: 2026-08-25
- **Verdict**: SOUND (after triage)
- **Findings**: 0 critical 4 warnings 2 observations (all FIXED)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

10/10 paths ✓, 6/6 symbols ✓, brief↔plan ✓

## Findings

### F1 — Resolver via listExercises misses archived names

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 2 — Resolver; uniqueness includes archived
- **Detail**: Phase 1 unique index includes archived rows. Phase 2 says load the trainer library via a path that today is `listExercises`, which always filters `is_archived = false` (`src/lib/exercises/service.ts:85`). After a name is archived, import of that name aborts, and the trainer cannot recreate it (unique). Import is stuck until they unarchive.
- **Fix A ⭐ Recommended**: Resolver queries all exercises for trainerId, including archived (dedicated list, not `listExercises`).
  - Strength: Matches “unique includes archived”; import can bind to the existing row.
  - Tradeoff: Imported template can point at an archived exercise.
  - Confidence: HIGH — unique + name-only requires this.
  - Blind spot: Whether the picker shows archived when placing a session.
- **Fix B**: Uniqueness only for active rows (partial unique index).
  - Strength: Archived names can be reused.
  - Tradeoff: Reopens Phase 1; two “Bench Press” rows if one is archived.
  - Confidence: MED — contradicts the locked uniqueness decision.
- **Decision**: FIXED — user: archived name is a fix-list error (`Exercise {name} is archived and cannot be used for import`); resolver loads archived rows to distinguish missing vs archived; does not bind archived UUIDs; uniqueness unchanged

### F2 — Commit does not say how overwrite finds the row, or that it re-validates

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Import preview + commit
- **Detail**: Preview returns `existing_template.id`. Commit body only adds `action`. Overwrite calls `updateTemplate(existingId, …)` but `existingId` is not on the commit contract. Implementer may trust a client-supplied id or skip re-resolve.
- **Fix**: Commit re-parses, re-resolves, re-runs clash on the uploaded document. Do not accept `existing_template_id` from the client. Derive id from name match. Re-check action vs current clash.
- **Decision**: FIXED — commit re-runs full pipeline; template id derived from name match; no client-supplied existing_template_id

### F3 — Two “pick one” API contracts left to the implementer

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 errors; Phase 4 upload
- **Detail**: Duplicate names: `duplicate_name` 409 OR `validation_error`. XLSX upload: multipart OR base64. Exercise UX file unnamed (`ExerciseForm.tsx`).
- **Fix**: Lock `duplicate_name` 409 + map in `ExerciseForm.tsx`; lock multipart field `file`; name `ExerciseForm.tsx` in Phase 1.
- **Decision**: FIXED — 409 duplicate_name; multipart `file`; ExerciseForm.tsx named

### F4 — Suffix backfill is SQL; optional TS helper tests are a dodge

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 success criteria 1.2
- **Detail**: Suffixing is migration SQL. Optional TS helper means 1.2 can be skipped while same-trainer seed dupes are untested.
- **Fix**: Require an integration test that inserts two case-duplicate names, applies backfill, asserts suffixes + unique index. Drop optional TS helper, or extract suffix SQL to a function and test that.
- **Decision**: FIXED — integration test required for SQL backfill; optional TS helper dropped

### F5 — ExcelJS is a first heavy Node dep with no Vite SSR config

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 4
- **Detail**: `astro.config.mjs` has no `ssr.external`. exceljs may need an explicit SSR external if the Vercel build bundles it wrong.
- **Fix**: Note in Phase 4: if `npm run build` fails on exceljs, set `vite.ssr.external: ["exceljs"]`.
- **Decision**: FIXED — Phase 4 contract notes SSR external fallback

### F6 — Templates with more than 50 exercises cannot export

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Current State vs Phase 2 max 50
- **Detail**: Template create is unbounded; transfer DTO caps 50. A 51-exercise template would fail export schema; should be 400 not 500.
- **Fix**: Phase 3 export: if `exercises.length > 50`, 400 with a fix-list.
- **Decision**: FIXED — export >50 exercises returns 400 validation_error, not 500
