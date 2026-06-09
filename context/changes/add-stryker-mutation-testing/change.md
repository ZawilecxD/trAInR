---
change_id: add-stryker-mutation-testing
title: Add Stryker mutation testing as a quality gate
status: new
created: 2026-06-08
updated: 2026-06-08
archived_at: null
---

## Notes

Add Stryker to improve testing — mutation testing as a selective quality gate beyond coverage, catching weak assertions and "mirror implementation" tests (oracle problem from m3-l2).

Grounding:
- Lesson: m3l2 — Od planu do testów (mutation testing, Stryker + Vitest, incremental runs, survived-mutant review, 10x-workflow loop after `/10x-implement`)
- Docs: https://stryker-mutator.io/docs/stryker-js/introduction/

Repo context: Vitest unit + integration tests; phased rollout in `context/foundation/test-plan.md`. Target risk-critical modules first (`--mutate` range), not 100% mutation score. Update AGENTS.md with mutation-testing guidance for agents.
