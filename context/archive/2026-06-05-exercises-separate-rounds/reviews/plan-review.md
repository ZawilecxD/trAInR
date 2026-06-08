<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Per-Round Exercise Prescription (S-14)

- **Plan**: `context/changes/exercises-separate-rounds/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-05
- **Verdict**: REVISE → SOUND (all findings fixed)
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension             | Verdict              |
| --------------------- | -------------------- |
| End-State Alignment   | PASS                 |
| Lean Execution        | PASS                 |
| Architectural Fitness | WARNING (F1 — fixed) |
| Blind Spots           | WARNING (F2 — fixed) |
| Plan Completeness     | WARNING (F3 — fixed) |

## Grounding

11/11 paths ✓, symbols ✓ (blast radius contained to 7 session-templates files; no `.astro` touches `template_exercises`), brief↔plan ✓, Progress↔Phase ✓.

## Data model decision (separate table vs JSONB)

Reviewed during triage. Kept the **separate `template_exercise_sets` table**. Decisive factor: symmetry with the existing relational `set_logs` (per-set rows), which makes the prescribed-round ↔ logged-set pairing a clean row-to-row join across S-04/S-06/S-07. JSONB's real wins (eliminates the F1 correlation risk, no new table/RLS, single-shot writes, simpler S-04 snapshot) were acknowledged but outweighed by downstream symmetry and convention fit, given a young schema with no production data.

## Findings

### F1 — Two-step insert correlates rounds by array index (unguaranteed order)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Critical Implementation Details + Phase 2 (service)
- **Detail**: Plan preferred bulk-inserting `template_exercises` with `.select()` then zipping returned rows to input `exercises[]` to attach `sets[]`, relying on PostgREST returning rows in input order (not contractually guaranteed). A mismatch silently attaches rounds to the wrong exercise.
- **Fix A ⭐ Recommended**: Per-exercise loop — insert each `template_exercises` row with `.select().single()`, then its `sets[]` immediately (explicit id↔sets binding; O(2N) round-trips, negligible at MVP scale).
- **Fix B**: Keep bulk insert but correlate by a stable key (phase+sort_order).
- **Decision**: FIXED (Fix A) — updated Critical Implementation Details bullet and Phase 2 service contract.

### F2 — Backfill is effectively untestable via the documented commands

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 Success Criteria + Migration Notes
- **Detail**: Phase 1's check `npx supabase db reset` runs migrations on an empty DB, so the `generate_series` backfill sees zero rows. No template seed exists, and legacy rows can't be inserted before this migration under db reset (it drops the flat columns in the same run). The riskiest, irreversible step had no working verification recipe.
- **Fix**: Add a migrate-onto-populated-DB recipe to Phase 1 (move migration out → `db reset` → insert legacy `template_exercises` row → restore migration → `supabase migration up` → assert expanded `template_exercise_sets` rows).
- **Decision**: FIXED — rewrote Phase 1 manual verification + added a Migration Notes caveat.

### F3 — docs/ERD.md not updated; diverges from new schema

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1
- **Detail**: `docs/ERD.md` (lines 84-96) defines `template_exercises` with flat `prescribed_*` fields. After Phase 1 those are gone and `template_exercise_sets` exists, but no phase updated the ERD — and S-04 reads it for the `session_exercises` mirror.
- **Fix**: Add a Phase 1 change to update `docs/ERD.md`.
- **Decision**: FIXED — added Phase 1 change #3 + manual verification 1.6.
