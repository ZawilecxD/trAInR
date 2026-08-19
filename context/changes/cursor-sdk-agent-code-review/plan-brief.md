# Cursor SDK CI Agent Code Review — Plan Brief

> Full plan: `context/changes/cursor-sdk-agent-code-review/plan.md`

## What & Why

Mateusz needs a Cursor SDK code-review agent for the 10xDevs M5L2→M5L3 / 10xChampion path: a local stdin-diff scorer that then runs on every PR to `main`, posts a comment, and sets `ai-cr:*` labels. Last word stays human — the check is advisory. This is not the parked plan-vs-diff `10x-impl-review-ci` gate.

## Starting Point

Single Astro app, no `packages/` tree. Product CI (`.github/workflows/ci.yml`) already lints, tests, builds, and deploys on **`main`**. Course rubric lives in `.cursor/prompts/m5l3-requirements.md`. Cursor SDK is a ready-made harness with **no structured output** and auto-approved local writes.

## Desired End State

`packages/code-reviewer` prints six-criterion JSON from a title + diff. A composite action on PRs to `main` turns that JSON into a PR comment and `ai-cr:passed` or `ai-cr:failed`. Fail verdicts stay green; crashes fail the job. Retry by adding `ai-cr:review`.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Scope | Local agent + CI MVP; park promptfoo and extra tools | Completes the Champion loop without a second eval change |
| Layout | Nested `packages/code-reviewer`, no root workspaces | Independent package without touching the Astro lockfile |
| Runtime | `@cursor/sdk` local on the GHA runner | Lesson CI shape; cloud/CLI are different APIs |
| Gate | Advisory (fail only on crash/parse) | Human-in-the-loop; opportunity map parked blocking AI review |
| Rubric | Six M5L3 criteria (includes documentation) | Course seed already in-repo |
| Agency | Diff-in-prompt only; deny Write/Shell | Default SDK auto-edits the checkout |
| Trigger | Every PR to `main` + label `ai-cr:review` | Matches course requirements on the real default branch |
| Prompt input | Title + diff, no body | Cost; body marked optional in the seed |

## Scope

**In scope:** nested package, zod schema + parser, Cursor `Agent.prompt`, deny-write hook, composite action, workflow, comment/labels/retry, `CURSOR_API_KEY` docs, cheap package tests in product CI.

**Out of scope:** `10x-impl-review-ci`, promptfoo, agent tools, npm workspaces, blocking merge, fork PRs, PR body, cloud/CLI, product app code.

## Architecture / Approach

```text
PR / git diff → file on disk → packages/code-reviewer (Agent.prompt + zod)
                              → ai-review.json
                              → workflow: gh comment + labels
```

Product `ci.yml` stays the deploy gate. Review is a sibling workflow.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Package contract | Schema, prompt, parser, CLI shape, isolate from Astro TS | Root lint/check picking up `packages/**` |
| 2. Cursor SDK local | `Agent.prompt` + deny-write + live smoke | Headless writes; JSON-only via prompt+parse |
| 3. CI action + workflow | Composite action, labels, retry, Champion screenshots | Diff-through-outputs size; fork secrets; labeled-event loops |

**Prerequisites:** Cursor API key (user or service account) for local smoke and the `CURSOR_API_KEY` GitHub Actions secret before phase 3 manual gates.
**Estimated effort:** ~2–3 sessions across 3 phases (phase 3 waits on the secret + a real PR).

## Open Risks & Assumptions

- `@cursor/sdk` local executor on `ubuntu-latest` works with `npm install` + Node 22.14 (docs say local is for CI; still beta).
- JSON-from-text will occasionally fail parse → treat as job failure (crash), not `verdict: fail`.
- Label create via `gh` needs `issues: write`; fork PRs are skipped by design.

## Success Criteria (Summary)

- Local command returns valid six-criterion JSON and does not dirty git.
- A PR to `main` gets a comment and exactly one of `ai-cr:passed` / `ai-cr:failed`.
- Fail verdict does not fail the workflow; `ai-cr:review` retriggers and replaces the previous comment.
