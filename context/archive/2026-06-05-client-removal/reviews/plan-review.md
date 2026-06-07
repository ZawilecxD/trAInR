<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Client Removal (S-11)

- **Plan**: `context/changes/client-removal/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-05
- **Verdict**: SOUND (after F1 Fix B applied to plan)
- **Findings**: 0 critical, 0 open warnings, 0 open observations (2 fixed)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 5/5 paths ✓, 3/3 symbols ✓ (RLS policies verified in migrations), brief↔plan ✓

## Findings

### F1 — Trainer retains SELECT on archived plans/sessions after removal

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Desired End State / Phase 1 RPC
- **Detail**: `client_plans_trainer_select_own` filters only `trainer_id = auth.uid()` — no active-assignment gate. `can_access_client_plan` grants trainer access via `cp.trainer_id` even after `trainer_clients` is removed. Roster UI hides the client (active-only query), but a trainer with a plan UUID could still query plan/session data via Supabase client. Roadmap wording "no longer visible" is UI-true; RLS-strict hiding would need extra policies in sessions migration.
- **Fix A ⭐ Recommended**: Accept for S-11 — no trainer UI exposes removed clients' data; document as known RLS breadth in plan Open Risks; defer tightening to a future slice if product requires cryptographic isolation.
  - Strength: Minimal diff; matches current S-04/S-07 absence (no session browser yet).
  - Tradeoff: Theoretical direct-API access until policies tighten.
  - Confidence: HIGH — no existing trainer pages query plans for removed clients.
  - Blind spot: None significant for MVP UI surface.
- **Fix B**: Add Phase 1 migration amending `can_access_client_plan` / `client_plans_trainer_select_own` to require `is_trainer_for_client` for trainer reads.
  - Strength: Aligns RLS with "trainer no longer sees removed client" literally.
  - Tradeoff: Wider blast radius; affects future S-07 archived-client browse if product wants it.
  - Confidence: MED — product intent on archived browse not finalized.
  - Blind spot: S-07 requirements may need trainer read of archived data.
- **Decision**: FIXED via Fix B (user chose option 2 — tighten RLS in Phase 1)

### F2 — Policy name typo in references

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 / Current State Analysis
- **Detail**: Plan references `client_plans_trainer_update`; actual policy is `client_plans_trainer_update_own` (`20260526120300_templates_and_plans.sql:216`).
- **Fix**: Use exact policy name if cited in implementation notes; no functional impact.
- **Decision**: FIXED — corrected in plan.md Current State Analysis
