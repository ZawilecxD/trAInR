<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Session Templates Implementation Plan

- **Plan**: `context/changes/session-templates/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-05
- **Verdict**: SOUND (after triage fixes)
- **Findings**: 0 critical 2 warnings 1 observation

## Verdicts

| Dimension             | Verdict         |
| --------------------- | --------------- |
| End-State Alignment   | PASS            |
| Lean Execution        | WARNING → FIXED |
| Architectural Fitness | PASS            |
| Blind Spots           | WARNING → FIXED |
| Plan Completeness     | WARNING → FIXED |

## Grounding

12/12 paths ✓, 6/6 symbols ✓, brief↔plan ✓

## Findings

### F1 — exercise_count gap between service contract and list page

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness / Lean Execution
- **Location**: Phase 1 service contract + Phase 2.3 list page
- **Detail**: `listTemplates` returned `SessionTemplate[]` but Phase 2.3 list page mentioned "exercise_count derived from a separate count or embedded in the list query" — vague, implementer would guess.
- **Fix B Applied**: Removed exercise_count from list page scope. List shows name + description only. No service change needed.
- **Decision**: FIXED via Fix B

### F2 — ExercisePickerModal excludedIds semantics unspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2.2 ExercisePickerModal contract
- **Detail**: `excludedIds` prop was unspecified in semantics (per-phase vs global). User clarified: same exercise can repeat in any phase and even multiple times within one phase (ABCABC interleaving). No exclusion needed.
- **Fix Applied**: Removed `excludedIds` prop entirely. Picker shows all exercises regardless. Plan contract updated to document the no-exclusion decision and its rationale.
- **Decision**: FIXED

### F3 — form-validation helpers conditional extraction

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy
- **Detail**: "form-validation.test.ts (if extracted)" was conditional. Trickiest logic (metricMode, sort_order assembly) would go untested without extraction.
- **Fix Applied**: Added `src/lib/session-templates/form-validation.ts` and its test file explicitly to Phase 2 Changes Required. Removed the "(if extracted)" hedge from Testing Strategy.
- **Decision**: FIXED
