<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Per-Round Exercise Prescription (S-14)

- **Plan**: context/changes/exercises-separate-rounds/plan.md
- **Scope**: All 3 phases (complete)
- **Date**: 2026-06-07
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Automated Verification (re-run 2026-06-07)

| Command         | Result                   |
| --------------- | ------------------------ |
| `npm run test`  | PASS — 47 tests, 6 files |
| `npm run lint`  | PASS — no issues         |
| `npm run build` | PASS                     |

## Findings

### F1 — verification.sql missing trainer B INSERT denial test

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: context/changes/exercises-separate-rounds/verification.sql:226-280
- **Detail**: Section 4 tests trainer B SELECT/UPDATE/DELETE against trainer A's rounds, but does not attempt an INSERT into trainer A's `template_exercise_id`. lessons.md expects exhaustive negative RLS scenarios; S-02 archive tests cross-tenant insert denial for template_exercises.
- **Fix**: Add a `do $block$ … raise exception 'FAIL'` insert attempt as trainer B targeting trainer A's exercise id, mirroring the archive pattern.
- **Decision**: FIXED

### F2 — "Duplicate last round" button not separate from "Add round"

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/session-templates/TemplateForm.tsx:499-512
- **Detail**: Plan specified two footer buttons ("Add round" and "Duplicate last round"). Implementation has one "Add round" button calling `addRound()`, which duplicates the last round when one exists or seeds a default round otherwise. Behavior is covered; only the explicit duplicate label/control is missing.
- **Fix**: Add a second "Duplicate last round" button wired to `addRound()` (disabled when `rounds.length === 0`), or update the plan to note that "Add round" subsumes duplicate behavior.
- **Decision**: ACCEPTED — single "Add round" button retained; `addRound()` duplicates last round when present, covering both planned controls without a separate duplicate button.

### F3 — Load semantics: ERD allows 0 (bodyweight), schema rejects 0

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/lib/session-templates/schemas.ts:20, docs/ERD.md:305
- **Detail**: ERD documents `prescribed_load_kg: 0 = bodyweight, neg = assisted`. Zod schema uses `gt(0)` and UI input allows `min={0}`. Pre-existing from S-02 flat prescription — not introduced by S-14, but now applies per-round. No user-facing regression vs prior behavior.
- **Fix**: Defer to a dedicated slice aligning schema/UI/ERD on bodyweight and assisted semantics, or accept current MVP constraint (load null or > 0 only).
- **Decision**: FIXED — schema updated to `min(0)` allowing bodyweight (0); negative values still rejected pending assisted-load product decision.
