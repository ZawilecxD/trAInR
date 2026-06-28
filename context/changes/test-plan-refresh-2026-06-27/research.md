---
date: 2026-06-28T20:09:58+02:00
researcher: GPT-5.5
git_commit: e1691cf04af45796c5cdba11afd9814797de32fe
branch: ZAW-37-e2e-tests
repository: trAInR
topic: "Refresh context/foundation/test-plan.md after current test stack and risk drift"
tags: [research, test-plan, vitest, playwright, integration, guided-workout]
status: complete
last_updated: 2026-06-28
last_updated_by: GPT-5.5
---

# Research: Refresh context/foundation/test-plan.md after current test stack and risk drift

**Date**: 2026-06-28T20:09:58+02:00
**Researcher**: GPT-5.5
**Git Commit**: e1691cf04af45796c5cdba11afd9814797de32fe
**Branch**: ZAW-37-e2e-tests
**Repository**: trAInR

## Research Question

Refresh `context/foundation/test-plan.md` without editing it in place yet.

Scope:

- The existing guide is stale: last reviewed 2026-06-07, still says integration and e2e layers are absent, but the repo now has Vitest unit tests, Vitest integration tests, Playwright config, and `tests/e2e/seed.spec.ts`.
- Hot-spot scan: `src/`, `supabase/`, `tests/`; 50 scoped commits; top dirs include `src/lib/session-templates/`, `tests/e2e/`, `src/components/guided-workout/`, `src/lib/set-logs/`.
- User concerns: mobile guided-workout flow, autosave false-safety, session-template/round-form confidence, E2E for session form/template creation.
- Negative space: do not spend budget on shadcn/ui primitives.

## Summary

The foundation test plan is materially stale. It still describes Phase 1 as open and claims integration and E2E layers are absent, while the repo now has a Supabase-backed Vitest integration harness, CI integration tests, and a Playwright E2E seed flow.

The original principles still hold: cheapest useful signal wins, user concerns count as evidence, and risks should remain scenario-based. The refresh should update evidence, stack, gates, cookbook patterns, and rollout status rather than replacing the strategy.

The risk map should retain risks #1-#5 but adjust status and likelihood. RLS isolation is now much better covered and should be demoted from live highest likelihood; route auth, template write integrity, invite hardening, and DB parity remain open or partial. New or promoted risk scenarios should cover guided-workout autosave false-safety, mobile guided-workout flow, and session-template round-form confidence.

## Detailed Findings

### Current Test Stack

- `package.json` now exposes `test`, `test:integration`, and `test:e2e` scripts. Unit tests run with `vitest run`, integration tests run with `vitest.integration.config.ts`, and E2E runs with `playwright test` (`package.json:14-16`).
- Unit Vitest uses `vitest.config.ts`, `node` environment, `src/**/*.test.ts`, and the `@` alias (`vitest.config.ts:4-14`).
- Integration Vitest uses `vitest.integration.config.ts`, `node` environment, `tests/integration/**/*.test.ts`, `tests/integration/setup.ts`, and longer test/hook timeouts (`vitest.integration.config.ts:4-17`).
- Integration setup requires `INTEGRATION_SUPABASE_URL`, `INTEGRATION_SUPABASE_ANON_KEY`, and `INTEGRATION_SUPABASE_SERVICE_ROLE_KEY`, then validates Supabase availability (`tests/integration/setup.ts:1-15`, `tests/integration/helpers/env.ts:7-11`).
- Playwright is configured with `tests/e2e`, an auth setup project, a desktop Chromium project that depends on that setup, and a local `npm run dev` web server (`playwright.config.ts:7-31`).
- CI now runs unit tests and Supabase-backed integration tests. Unit tests run in the `test` job, and integration tests run after `supabase start` in the `test-integration` job (`.github/workflows/ci.yml:10-20`, `.github/workflows/ci.yml:52-74`).
- E2E is present but not CI-gated. No GitHub Actions job runs `npm run test:e2e`.

### Existing Coverage Inventory

- Unit coverage has grown far beyond the stale guide's "6 unit tests" claim. Current coverage includes API guards, exercises, session templates, workout sessions, set logs, guided-workout pure logic, trainer-dashboard readouts, and week-view utilities.
- Integration coverage now includes RLS isolation across many core tables, a smoke test, starter exercise seeding, and `SECURITY DEFINER` RPC tests.
- Current integration coverage strongly protects RLS basics: examples include cross-tenant session-template access being denied and set-log insert/update/delete isolation (`tests/integration/rls/session-templates.test.ts:56-60`, `tests/integration/rls/set-logs.test.ts:95-106`).
- Current E2E coverage includes `tests/e2e/seed.spec.ts`, which creates an exercise through the UI, waits for relevant API responses, reloads, and verifies persistence. It is an exemplar for reload-backed E2E confidence, but it does not cover session-template creation, session creation, guided workout, mobile viewport, or client auth (`tests/e2e/seed.spec.ts:5-10`, `tests/e2e/seed.spec.ts:25-77`).

### Rollout Status Drift

- Phase 1, "RLS isolation harness", has shipped and was archived under `context/archive/2026-06-07-testing-rls-isolation-harness/`; the current guide still points to `context/changes/testing-rls-isolation-harness/` and says `change opened` (`context/foundation/test-plan.md:64-66`).
- The archived Phase 1 plan records all progress items as complete and preserves decisions to use Vitest integration, real Supabase users, anon/RLS-bound clients for assertions, service-role only in helpers, and a separate `test-integration` CI job (`context/archive/2026-06-07-testing-rls-isolation-harness/plan.md:472-535`).
- Phase 2, route authorization coverage, remains open. Guard helpers have unit tests, but no route/handler integration tests enumerate protected API routes for 401/403 behavior (`src/lib/api/guards.test.ts:15-84`).
- Phase 3, service write-path integrity, is partial. Workout session creation now goes through transactional RPC coverage, and the E2E seed tests exercise creation persistence, but session-template create/update still uses app-level multi-step writes and lacks mid-failure tests (`src/lib/session-templates/service.ts:96-135`, `src/lib/session-templates/service.ts:257-269`).
- Phase 4, invite and validation parity, is partial. RLS around invite links has tests, but `complete_client_invite` still has a known gap for client identity mismatch, and DB/Zod parity remains uncovered (`tests/integration/security-definer/complete-client-invite.test.ts:35-43`).

### Risk Map Updates

- Risk #1, cross-tenant isolation, should remain but likelihood should drop from high to medium because the RLS integration harness and CI gate now exist. Remaining concern is RPC/API bypass, not broad absence of RLS tests.
- Risk #2, partial-write corruption, should remain but be narrowed. Workout sessions are partially mitigated by the `create_workout_session` RPC and happy-path integration coverage; session-template create/edit remains the hotter path because it inserts related rows in loops and update deletes then reinserts exercises without a proven rollback on mid-sequence failure.
- Risk #3, missing or drifted route authorization, should remain unchanged. Unit guard tests exist, but route-level 401/403 inventory is still absent.
- Risk #4, invite-link abuse, should remain and may deserve higher likelihood because the `complete_client_invite` RPC has a live known gap where a signed-in client can complete an invite for a different `client_id`.
- Risk #5, validation/DB-constraint parity, should remain. Template Zod rejects negative prescribed load, workout/session and set-log schemas allow negative assisted load, and the template DB migration does not encode the same minimum-load constraint (`src/lib/session-templates/schemas.ts:20`, `src/lib/session-templates/schemas.test.ts:186-197`, `src/lib/workout-sessions/form-validation.test.ts:55-76`, `src/lib/set-logs/schemas.test.ts:21-32`, `supabase/migrations/20260605130000_per_round_template_prescription.sql:12-13`).
- A new or promoted risk should cover guided-workout autosave false-safety: debounced set-log saves clear the pending timer on unmount/navigation, the Next/Prev actions do not flush pending saves, and the UI renders saving/error affordances but no durable saved-state confirmation (`src/components/hooks/useDebouncedSetLogSave.ts:110-125`, `src/components/guided-workout/GuidedExerciseView.tsx:93-108`, `src/components/guided-workout/SetLogRow.tsx:253-265`).
- A new or promoted risk should cover mobile guided-workout flow: mobile-only sheet navigation, fixed bottom nav, and horizontally dense set-log table are central to the client logging experience but have no viewport E2E coverage (`src/components/guided-workout/GuidedExerciseView.tsx:66-110`, `src/components/guided-workout/ExerciseNavMenu.tsx:21-22`, `src/components/guided-workout/ExerciseSetLogTable.tsx:37-67`, `playwright.config.ts:17-25`).
- Session-template round-form confidence should be called out as a sub-risk of write integrity and parity. Unit coverage is strong for round helpers and payload assembly, but there is no integration or E2E proof that multi-round template create/edit persists and reloads correctly (`src/lib/session-templates/form-validation.test.ts:261-391`, `src/lib/session-templates/schemas.test.ts:25-43`).

### Negative Space

- The shadcn/ui primitive exclusion still matches the user's explicit direction and should remain.
- The old "detailed UI / component rendering" exclusion needs nuance. It said no critical UI path warranted tests, but S-06 guided workout has now shipped and the user specifically called out guided-workout mobile and autosave concerns (`context/foundation/test-plan.md:149-157`, `context/changes/test-plan-refresh-2026-06-27/change.md:17-18`).
- The refresh should avoid testing shadcn internals, pixel-perfect Astro layout snapshots, and generic render-only component checks. It should make narrow exceptions for critical client logging behavior that cannot be proven by schema or service tests alone.

## Code References

- `context/foundation/test-plan.md:9` - Current guide still says last updated 2026-06-07.
- `context/foundation/test-plan.md:78-84` - Current stack table says integration and E2E are absent.
- `context/foundation/test-plan.md:104-111` - Quality gates still describe integration as future and CI as not running tests.
- `package.json:14-16` - Unit, integration, and E2E scripts exist.
- `vitest.config.ts:4-14` - Unit Vitest configuration.
- `vitest.integration.config.ts:4-17` - Integration Vitest configuration.
- `playwright.config.ts:7-31` - Playwright test directory, auth setup, Chromium project, and dev web server.
- `.github/workflows/ci.yml:10-20` - Unit test job.
- `.github/workflows/ci.yml:52-74` - Supabase-backed integration test job.
- `tests/e2e/seed.spec.ts:25-77` - Current E2E exemplar for UI create plus reload persistence.
- `src/components/hooks/useDebouncedSetLogSave.ts:110-125` - Debounce clears pending timer on cleanup.
- `src/components/guided-workout/GuidedExerciseView.tsx:93-108` - Prev/Next navigation does not flush or await pending saves.
- `src/components/guided-workout/SetLogRow.tsx:253-265` - Saving/error indicators exist, but saved confirmation is not surfaced.
- `src/lib/session-templates/service.ts:96-135` - Template create inserts nested exercises and sets in loops.
- `src/lib/session-templates/service.ts:257-269` - Template update deletes exercises then reinserts, making mid-write failure important.
- `tests/integration/security-definer/complete-client-invite.test.ts:35-43` - Known invite RPC gap.

## Architecture Insights

The refreshed guide should remain a testing strategy document, not a per-file failure anchor. Use the new code references as evidence of stack and coverage state, but keep risks as user/business failure scenarios.

The testing stack now has a meaningful three-layer shape:

- Unit tests are the default for pure validation, form assembly, helpers, guards, and guided-workout calculations.
- Integration tests are the default for RLS, Supabase constraints, RPC authorization, and DB-persisted side effects.
- E2E tests are justified only for cross-browser/UI/session concerns that cannot be proven below the browser layer: mobile guided-workout flow, autosave/reload confidence, and critical trainer form creation flows.

The refresh should distinguish "implemented", "partial", and "still open" rather than treating each old rollout phase as binary. The old phase table is still useful, but it needs status corrections and likely a new guided-workout/E2E phase driven by S-06 and user concerns.

## Historical Context

- `context/archive/2026-06-07-testing-rls-isolation-harness/` - Phase 1 shipped and archived. Preserve its integration harness conventions and CI split.
- `context/archive/2026-06-08-harden-replace-exercise-muscle-groups/` - Q-02 security-definer hardening completed after Phase 1 surfaced a gap.
- `context/changes/harden-complete-client-invite/` - Q-03 remains open for the invite RPC known gap.
- `context/archive/2026-06-05-session-templates/` - Session-template MVP accepted multi-step app-level writes and delete-then-insert update behavior, making write-integrity testing still relevant.
- `context/archive/2026-06-14-guided-workout-logging/` - S-06 shipped guided workout logging and set-log autosave; this invalidates the old statement that no critical UI path needs tests.
- `context/archive/2026-06-20-warmup-working-flag/` - Added warmup semantics across template/session flows and integration coverage for workout session RPC behavior.
- `context/archive/2026-06-20-starter-exercise-seed/` - Added more integration coverage around signup seeding and isolation.

## Related Research

- `context/archive/2026-06-07-testing-rls-isolation-harness/research.md` - Grounding for the Supabase integration harness.
- `context/archive/2026-06-07-testing-rls-isolation-harness/plan.md` - Completed rollout plan and progress record for Phase 1.
- `context/archive/2026-06-14-guided-workout-logging/plan.md` - Testing implications of S-06 guided workout logging.
- `context/changes/harden-complete-client-invite/change.md` - Open invite RPC hardening context.

## Open Questions

None blocking the refresh plan. The implementation plan can choose a conservative document-only update that does not modify tests yet, while naming future rollout phases for guided-workout E2E, autosave false-safety, route authorization, template write integrity, invite hardening, and DB parity.
