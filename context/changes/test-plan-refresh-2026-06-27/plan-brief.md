# Refresh Foundation Test Plan — Plan Brief

> Full plan: `context/changes/test-plan-refresh-2026-06-27/plan.md`
> Research: `context/changes/test-plan-refresh-2026-06-27/research.md`

## What & Why

Refresh `context/foundation/test-plan.md` so it stops describing the project as unit-only and reflects the current Vitest integration harness, CI gates, Playwright seed flow, and new guided-workout/template risks. The current guide is still strategically useful, but its facts and rollout status are stale.

## Starting Point

The guide was last reviewed on 2026-06-07 and says integration and E2E are absent. Research found unit and integration tests in CI, Playwright wired locally, Phase 1 RLS harness archived as complete, and new user concerns around autosave, mobile guided workout, and trainer form confidence.

## Desired End State

The guide is reviewed on 2026-06-28 and accurately tells future agents what is already tested, what remains open, and where new test budget should go. It preserves the cost × signal strategy, keeps shadcn/ui primitives out of scope, and names guided-workout/template risks without turning the guide into a research dump.

## Key Decisions Made

| Decision       | Choice                                     | Why                                                                                               | Source          |
| -------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------- |
| Refresh style  | Focused doc refresh, not rewrite           | The core strategy still holds; the stale parts are evidence, status, stack, and cookbook guidance | Research        |
| Phase 1 status | Mark RLS harness complete                  | Integration harness shipped, archived, and runs in CI                                             | Research        |
| E2E posture    | Present but local-only                     | Playwright exists, but CI does not run `npm run test:e2e`                                         | Research        |
| Risk priority  | Add/promote guided-workout autosave/mobile | S-06 shipped and user flagged false-safety plus mobile flow concerns                              | Research / User |
| Negative space | Keep shadcn/ui primitives out of scope     | User explicitly excluded them and they remain vendored primitives                                 | User            |

## Scope

**In scope:**

- Update `context/foundation/test-plan.md` review date, stack table, quality gates, and rollout status.
- Refresh §2 risk map and response guidance around current evidence.
- Fill cookbook guidance for shipped integration and E2E patterns.
- Update freshness dates and triggers.

**Out of scope:**

- Adding or editing tests.
- Changing CI, package scripts, Supabase migrations, or application code.
- Spending test budget on shadcn/ui primitives or generic UI snapshots.

## Architecture / Approach

Use `research.md` as the evidence record, then edit the foundation guide in three passes: factual baseline, risk reprioritization, and cookbook/freshness guidance. Keep §2 Source cells evidence-based and avoid code file:line anchors there.

## Phases at a Glance

| Phase                   | What it delivers                                           | Key risk                                                         |
| ----------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| 1. Stack/status refresh | Corrects review date, rollout rows, stack, and CI gates    | Accidentally implying E2E is CI-required today                   |
| 2. Risk refresh         | Updates risk map and negative space for current concerns   | Turning risk rows into code anchors instead of scenario evidence |
| 3. Cookbook/freshness   | Adds usable integration/E2E guidance and dates the refresh | Making the guide too verbose to remain useful                    |

**Prerequisites:** `context/changes/test-plan-refresh-2026-06-27/research.md` is complete.
**Estimated effort:** One focused documentation implementation session across 3 phases.

## Open Risks & Assumptions

- The implementation must keep the guide compact; detailed code evidence belongs in `research.md`.
- If the user wants §2 to avoid adding new top-level risks, guided-workout autosave/mobile can be represented as a sub-risk under write integrity, but the concern must remain visible.

## Success Criteria (Summary)

- The guide no longer claims integration or E2E are absent.
- Phase 1 is marked complete, while route auth, write integrity, invite hardening, DB parity, and guided-workout confidence remain visible.
- Future agents can read §6 and know the current integration/E2E conventions without rediscovering the harness.
