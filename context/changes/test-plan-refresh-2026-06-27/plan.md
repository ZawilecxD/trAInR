# Refresh Foundation Test Plan Implementation Plan

## Overview

Refresh `context/foundation/test-plan.md` so it reflects the current test stack, shipped integration harness, Playwright seed flow, and new guided-workout/template concerns. This plan is document-only: it updates the guide and its rollout status, but does not add or modify test code.

## Current State Analysis

The foundation guide was last reviewed on 2026-06-07 and still describes the project as having unit tests only, no integration layer, no E2E layer, and Phase 1 of the rollout merely opened. Current research shows the repo now has Vitest unit tests, a Supabase-backed Vitest integration suite in CI, Playwright configuration, and `tests/e2e/seed.spec.ts`.

The strategic principles in the guide remain valid. The stale parts are the evidence, stack inventory, rollout status, quality gates, cookbook placeholders, and risk prioritization now that S-06 guided workout logging and the integration harness have shipped.

## Desired End State

`context/foundation/test-plan.md` should read as an up-to-date testing guide reviewed on 2026-06-28. It should accurately state what is already tested, what gates run in CI, which rollout phases are complete or partial, and which risks now deserve attention.

### Key Discoveries:

- Unit, integration, and E2E scripts now exist in `package.json:14-16`.
- Unit Vitest uses `vitest.config.ts:4-14`; integration Vitest uses `vitest.integration.config.ts:4-17`.
- CI runs unit tests and Supabase-backed integration tests via `.github/workflows/ci.yml:10-20` and `.github/workflows/ci.yml:52-74`.
- Playwright is wired in `playwright.config.ts:7-31`, with the current exemplar at `tests/e2e/seed.spec.ts:25-77`.
- Phase 1 shipped and is archived under `context/archive/2026-06-07-testing-rls-isolation-harness/`.
- Guided-workout autosave/mobile flow and session-template round-form confidence are now live user concerns, while shadcn/ui primitives remain out of scope.

## What We're NOT Doing

- No test implementation in this change.
- No changes to `src/`, `supabase/`, `tests/`, CI, or package scripts.
- No test budget for shadcn/ui primitives, generic render-only component tests, or pixel-perfect layout snapshots.
- No broad rewrite of the test-plan strategy unless needed to make the stale facts coherent.
- No file:line anchors in the §2 Risk Map Source column; sources there remain evidence categories, not code anchors.

## Implementation Approach

Make a focused refresh to the foundation guide using `research.md` as the evidence record. Preserve the existing guide structure and strategy, correct factual drift, then add only the minimum new risk and cookbook guidance needed for the current repo.

## Critical Implementation Details

### Risk Map Source Discipline

The refreshed §2 can cite the refresh research, archived rollout, hot-spot scan, and user-stated concerns as evidence. It must not cite code file:line anchors in the Risk Map Source column, because the guide's strategy explicitly says research owns code anchors.

---

## Phase 1: Refresh Stack, Gates, and Rollout Status

### Overview

Correct the factual baseline: review date, test-base profile, stack table, CI gates, and phased rollout statuses.

### Changes Required:

#### 1. Foundation Test Plan Header and Scope

**File**: `context/foundation/test-plan.md`

**Intent**: Update the review timestamp and hot-spot scope so future readers know this is the 2026-06-28 refresh and that `tests/` now matters as a source of churn and risk evidence.

**Contract**: Update the header `Last updated` line and the §1 hot-spot scope sentence. Preserve the existing three strategy principles.

#### 2. Phased Rollout Table

**File**: `context/foundation/test-plan.md`

**Intent**: Reconcile §3 with what has shipped. Phase 1 is complete, Phases 2-4 are still open or partial, and guided-workout/E2E concerns need a named future rollout path.

**Contract**: Update the §3 status table using the fixed status vocabulary. Phase 1 should point to `context/archive/2026-06-07-testing-rls-isolation-harness/`. Keep Phase 2 as route authorization. Mark Phase 3 and Phase 4 as still needing work even if partial signals exist. Add a new rollout row for guided-workout autosave/mobile E2E if the risk-map refresh makes it top-tier.

#### 3. Stack and Quality Gates

**File**: `context/foundation/test-plan.md`

**Intent**: Replace stale "none yet" claims with the current unit, integration, E2E, and CI reality.

**Contract**: Update §4 and §5 to state that unit and integration tests are wired and CI-gated, while Playwright E2E exists locally but is not CI-gated. Mention current scripts and configs by path, not by exhaustive test inventory.

### Success Criteria:

#### Automated Verification:

- `rg "none yet|e2e\\s+\\| none|6 unit tests|change opened \\| context/changes/testing-rls-isolation-harness" context/foundation/test-plan.md` returns no stale matches after the implementation phase.
- `npx prettier --check context/foundation/test-plan.md context/changes/test-plan-refresh-2026-06-27/plan.md context/changes/test-plan-refresh-2026-06-27/plan-brief.md` passes.

#### Manual Verification:

- §3 status table accurately marks the RLS harness complete and keeps route auth/write integrity/invite-parity work visible.
- §4 and §5 accurately describe unit, integration, E2E, and CI without implying E2E is required in CI today.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the status and stack wording is accurate before proceeding to the next phase.

---

## Phase 2: Refresh Risk Map and Risk Response Guidance

### Overview

Update §2 so the top risks match the current product surface and the team's current concerns.

### Changes Required:

#### 1. Risk Map

**File**: `context/foundation/test-plan.md`

**Intent**: Retain the original durable risks while reflecting that RLS coverage has improved and S-06 guided workout logging has shipped.

**Contract**: Keep risks #1-#5 unless the final edit makes a clearer table with equivalent coverage. Demote RLS likelihood, narrow partial-write corruption around session-template writes, keep route auth, promote invite RPC abuse evidence, retain validation/DB parity, and add/promote guided-workout autosave/mobile plus session-template round-form confidence.

#### 2. Risk Response Guidance

**File**: `context/foundation/test-plan.md`

**Intent**: Make every active risk actionable for future `/10x-research` and `/10x-plan` phases without pretending the guide knows code anchors.

**Contract**: For each active risk, update "what would prove protection", "must challenge", "context research must ground", "likely cheapest layer", and "anti-pattern to avoid". E2E should be recommended only where lower layers cannot prove the behavior, especially mobile/autosave/reload flows.

#### 3. Negative Space Reconciliation

**File**: `context/foundation/test-plan.md`

**Intent**: Preserve the shadcn/ui exclusion while acknowledging that guided-workout client logging is now a critical UI path.

**Contract**: Update §7 so it still excludes shadcn primitives, generic snapshots, and marketing/layout render tests, but carves out narrow behavior-driven tests for guided workout autosave/mobile and critical trainer form flows.

### Success Criteria:

#### Automated Verification:

- `rg "src/.+:[0-9]+|tests/.+:[0-9]+|supabase/.+:[0-9]+" context/foundation/test-plan.md` is reviewed and any file:line anchors are removed from §2 Source cells.
- `npx prettier --check context/foundation/test-plan.md` passes.

#### Manual Verification:

- Risk rows remain scenario-based and evidence-based, not implementation anchored.
- Guided-workout autosave/mobile and session-template round-form concerns are visible as first-class risks or clearly named sub-risks.
- shadcn/ui primitives remain explicitly out of scope.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the risk reprioritization matches the intended test budget.

---

## Phase 3: Refresh Cookbook, Freshness Ledger, and Handoff Guidance

### Overview

Turn shipped test infrastructure into usable guide material and date the refreshed plan.

### Changes Required:

#### 1. Cookbook Patterns

**File**: `context/foundation/test-plan.md`

**Intent**: Replace obsolete TBDs where conventions now exist, especially for integration tests and E2E seed patterns.

**Contract**: Fill §6.2 with the current integration harness conventions: `tests/integration/`, environment variables, helper roles, anon/RLS-bound clients for assertions, and service-role admin only in helpers. Add or update E2E guidance around `tests/e2e/seed.spec.ts` as an exemplar while naming what it does not cover yet.

#### 2. Freshness Ledger

**File**: `context/foundation/test-plan.md`

**Intent**: Make the refresh auditable and set a clear next refresh trigger.

**Contract**: Update §8 dates to 2026-06-28. Keep the existing refresh triggers and add a trigger for material changes to E2E CI status or guided-workout test confidence.

#### 3. Change Folder Status

**File**: `context/changes/test-plan-refresh-2026-06-27/change.md`

**Intent**: Record that the refresh plan is ready for implementation.

**Contract**: Keep `status: planned` after `plan.md` and `plan-brief.md` land.

### Success Criteria:

#### Automated Verification:

- `test -f context/changes/test-plan-refresh-2026-06-27/research.md && test -f context/changes/test-plan-refresh-2026-06-27/plan.md && test -f context/changes/test-plan-refresh-2026-06-27/plan-brief.md` succeeds.
- `npx prettier --check context/foundation/test-plan.md context/changes/test-plan-refresh-2026-06-27/*.md` passes after the implementation phase.

#### Manual Verification:

- §6 gives future agents enough guidance to add integration and E2E tests without rediscovering the harness from scratch.
- §8 dates and refresh triggers match the new 2026-06-28 review.
- The guide still feels like a compact strategy and cookbook, not a verbose research dump.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the refreshed guide is concise and ready to serve as the source of truth.

---

## Testing Strategy

### Unit Tests:

- None. This is a documentation refresh.

### Integration Tests:

- None. This change plans documentation only; future rollout phases will add tests.

### Manual Testing Steps:

1. Read `context/foundation/test-plan.md` top-to-bottom after implementation and verify there are no stale "integration none" or "E2E none" claims.
2. Verify §2 Source cells cite evidence categories, hot-spot directories, user concerns, or archived changes, not code file:line anchors.
3. Verify §7 still excludes shadcn/ui primitives while allowing narrow behavior tests for critical guided-workout flows.

## Performance Considerations

No runtime performance impact. Keep the guide concise so future agents can read it cheaply before writing tests.

## Migration Notes

No schema or data migration.

## References

- Related research: `context/changes/test-plan-refresh-2026-06-27/research.md`
- Existing guide: `context/foundation/test-plan.md`
- RLS harness archive: `context/archive/2026-06-07-testing-rls-isolation-harness/`
- Current E2E seed: `tests/e2e/seed.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Refresh Stack, Gates, and Rollout Status

#### Automated

- [x] 1.1 Stale stack/status grep returns no stale matches — fb572f2
- [x] 1.2 Prettier check passes for refreshed guide and plan artifacts — fb572f2

#### Manual

- [x] 1.3 §3 status table accurately reflects complete, open, and partial rollout work — fb572f2
- [x] 1.4 §4 and §5 accurately describe current test layers and CI gates — fb572f2

### Phase 2: Refresh Risk Map and Risk Response Guidance

#### Automated

- [x] 2.1 §2 file-line anchor scan is reviewed and cleaned
- [x] 2.2 Prettier check passes for the refreshed guide

#### Manual

- [x] 2.3 Risk rows remain scenario-based and evidence-based
- [x] 2.4 Guided-workout and session-template concerns are visible in the risk map
- [x] 2.5 shadcn/ui primitives remain explicitly out of scope

### Phase 3: Refresh Cookbook, Freshness Ledger, and Handoff Guidance

#### Automated

- [ ] 3.1 Research, plan, and plan brief artifacts exist
- [ ] 3.2 Prettier check passes for guide and change-folder markdown

#### Manual

- [ ] 3.3 §6 gives usable integration and E2E cookbook guidance
- [ ] 3.4 §8 dates and refresh triggers match the 2026-06-28 review
- [ ] 3.5 Refreshed guide stays concise enough to remain a source of truth
