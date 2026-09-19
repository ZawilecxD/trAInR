# Cursor SDK CI Agent Code Review Implementation Plan

## Overview

Add a nested `packages/code-reviewer` that runs a Cursor SDK local agent as a diff scorer (10xDevs M5L2), then wire it into GitHub Actions as a composite action that posts an advisory PR comment and `ai-cr:*` labels (M5L3). Product lint/test/build/deploy stays in `.github/workflows/ci.yml`. This is the 10xChampion review-pipeline path, not the parked plan-vs-diff `10x-impl-review-ci` template.

## Current State Analysis

trAInR is a single Astro npm package (`tr-ai-nr`, `"type": "module"`, Node `.nvmrc` `22.14.0`, zod `^4.4.3`). There is no `packages/` tree and no npm workspaces.

Live CI is `.github/workflows/ci.yml` on **`main`** (docs still say `master`). Jobs: unit tests, lint/check/build + Vercel, integration tests. Secrets today: `SUPABASE_*`, `VERCEL_*`. No `CURSOR_API_KEY`. No `.github/actions/`, no PR templates, no `ai-cr:*` labels in-repo.

Course seed already exists at `.cursor/prompts/m5l3-requirements.md` (six 1–10 criteria, PR comment, labels, retry on `ai-cr:review`). M5L2’s shared schema had five criteria; this plan uses the six-criterion M5L3 seed.

`@cursor/sdk` is a ready-made coding harness (public beta). It has **no first-class structured output**. Local runtime runs the agent loop in-process against disk; the model is still hosted. Default local agents **auto-approve tool calls including writes**. Node **22.13+** is required. Docs explicitly list local runtime as appropriate for CI checks against a working tree.

`10x-impl-review-ci` (plan-vs-implementation, Claude Action, `impl-review` label) remains parked per `context/team/opportunity-map.md`. Do not enable that template in this change.

## Desired End State

Locally: `git diff | npx tsx src/cli.ts --title "…"` inside `packages/code-reviewer` prints one JSON object matching the six-criterion schema, and the working tree is unchanged.

On every PR to `main` (plus retry when label `ai-cr:review` is added): a separate workflow checks out the PR, writes the three-dot diff to a file, runs the reviewer, posts a PR comment with the summary and scores, and sets `ai-cr:passed` or `ai-cr:failed`. A fail **verdict** does not fail the check. The check fails only if the agent never starts, the run errors, or the JSON cannot be parsed.

Verification: package unit tests (no API key) in product CI; one real local smoke with `CURSOR_API_KEY`; one real PR showing comment + label.

### Key Discoveries:

- Default branch and CI trigger are `main` (`.github/workflows/ci.yml:3–7`), not `master` as in the course YAML and `AGENTS.md`.
- Root `tsconfig.json` `include`s `**/*` and root ESLint uses `projectService` on `**/*.{ts,tsx}` — a nested package will be typechecked as Astro unless excluded (`eslint.config.js` already ignores `scripts/**`).
- Cursor SDK local agents auto-run Write/Shell (`cursor.com/docs/sdk/typescript`). Diff-only scoring requires a deny-write `preToolUse` hook plus `local.settingSources: []` (do not inherit `.cursor/skills`).
- GitHub Actions `GITHUB_OUTPUT` / `inputs` are the wrong channel for a full `git diff`. Pass a **file path**; the action reads the file.
- `Agent.prompt(...)` is the one-shot pattern (create, run, dispose). Parse `result.result` text through zod. Exit 1 = `CursorAgentError` (never started); exit 2 = `result.status === "error"`; exit 0 = finished, even when `verdict` is `fail`.
- Nested `node_modules/` is already covered by root `.gitignore` (`node_modules/`).

## What We're NOT Doing

- Enabling `.cursor/skills/10x-impl-review-ci/references/workflow-template.yml` or plan-vs-diff review.
- promptfoo / model bake-offs (M5L3 task 3) — keep the reviewer importable for a later eval change.
- Extra agent tools (`readPlan`, `postPrComment`, Linear, Slack). GitHub comment/labels live in the workflow around the scorer, not as SDK tools.
- npm workspaces at the repo root; `@cursor/sdk` must not enter the Astro app `package.json`.
- Blocking merge on `verdict: fail` (no required check, no `ai-cr` override label).
- Reviewing fork PRs (no secrets on forks).
- Passing PR body into the prompt (cost).
- Cloud Cursor runtime, Cursor CLI (`agent -p`), Claude Agent SDK, Vercel AI SDK.
- Changing product pages, auth, Supabase, or Vercel deploy jobs.
- Architectural-fit / business-alignment criteria (parked in the course seed).

## Implementation Approach

Three layers, each independently testable:

1. **Pure contract** (schema, prompt, JSON extractor) — Vitest, no network.
2. **Cursor SDK adapter** — `Agent.prompt` + deny-write hook + CLI. Live key only for manual smoke.
3. **CI wrapper** — composite action + workflow that owns checkout, diff file, `gh` comment/labels. Product `ci.yml` gains only a cheap `npm test` in the nested package (no `CURSOR_API_KEY`).

The package is a second `package.json` under `packages/code-reviewer` invoked with `npm --prefix packages/code-reviewer`. Do not add root workspaces.

## Critical Implementation Details

Cursor’s local harness will edit the checkout unless gated. The reviewer must deny Write/Shell (and any non-read tool) via SDK `preToolUse` / equivalent hook, keep `local.settingSources` empty so project skills do not pull the agent into implementation mode, and treat a dirty worktree after the run as a failed manual gate — not as “the job finished so it is fine.”

Never put the diff string in `with: diff:` or `GITHUB_OUTPUT`. Write `git diff origin/<base>...HEAD` to a workspace file (omit lockfiles if they dominate the patch) and pass the path. Truncate or fail loudly if the file exceeds a documented size cap rather than silently emptying the prompt.

Root TypeScript/ESLint must exclude `packages/**` in the same change that adds the first `.ts` file there; otherwise `npm run lint` / `astro check` will load the SDK package through the Astro tsconfig and fail for unrelated reasons.

## Phase 1: Package contract

### Overview

Stand up `packages/code-reviewer` with the six-criterion zod schema, the review prompt (1/10 anchors from the course seed), fence-tolerant JSON parsing, a CLI that reads title + stdin/file diff, and Vitest coverage that does not call Cursor. Isolate it from the Astro tsconfig/eslint graph. Record the decided requirements in this change folder.

### Changes Required:

#### 1. Decided requirements artifact

**File**: `context/changes/cursor-sdk-agent-code-review/requirements.md`

**Intent**: Freeze the M5L3 seed against the decisions from this planning session so implement/review do not re-read chat.

**Contract**: Copy the structure of `.cursor/prompts/m5l3-requirements.md` but set: trigger branch `main`; inputs = PR title + git diff (no body); six criteria as in the seed; side-effects = PR comment + `ai-cr:passed` / `ai-cr:failed`; retry on `ai-cr:review`; gate = advisory (workflow fails only on agent/parse crash). Park evals, extra tools, plan-review, and blocking merge.

#### 2. Nested package scaffold

**File**: `packages/code-reviewer/package.json` (plus `tsconfig.json`, `src/` entrypoints)

**Intent**: Independent ESM package so `@cursor/sdk` never lands in the Astro lockfile.

**Contract**: Own `name`, `"type": "module"`, Node 22, scripts `test` (vitest) and later `review`. Direct deps: `zod` (pin compatible with root `^4.4.3`). Dev deps: `typescript`, `vitest`, `tsx`, `@types/node`. No root `workspaces` field. README in the package: local `CURSOR_API_KEY`, `git diff | npx tsx src/cli.ts --title …`.

#### 3. Schema, prompt, parser

**File**: `packages/code-reviewer/src/schema.ts`, `src/prompt.ts`, `src/parse-review.ts`

**Intent**: One zod object is the DoD the CLI and CI both trust. Cursor cannot emit native structured output, so parsing must be explicit.

**Contract**: Schema fields: `implementationCorrectness`, `idiomaticity`, `complexity`, `testRiskCoverage`, `documentation`, `securitySafety` (numbers; 1–10 described, not integer min/max — same Anthropic/structured-output caution as M5L2), `verdict: "pass" | "fail"`, `summary` (markdown). Prompt includes the six 1/10 anchors from the seed and orders the model to return **only** that JSON. `parseReview(text)` strips optional ` ```json ` fences, `JSON.parse`s, `safeParse`s; throws a typed error on failure. Export `Review` type from the schema.

#### 4. CLI without a live model (stdin/file)

**File**: `packages/code-reviewer/src/cli.ts`

**Intent**: Same entrypoint local and CI will call; phase 1 can parse a canned assistant payload or skip the agent behind an interface so tests stay offline.

**Contract**: Read `--title`, diff from stdin or `--diff-file`. Build the user prompt via `buildReviewPrompt({ title, diff })`. Do not call `@cursor/sdk` in this phase if the adapter is still missing — either no-op with a clear “agent not wired” error, or accept `--fixture-assistant` for tests. Print pretty JSON on stdout. Empty diff → exit 0 with a documented skip object (`verdict: "pass"`, summary explaining no changes) so CI can skip the model.

#### 5. Keep the Astro app build graph clean

**File**: `tsconfig.json`, `eslint.config.js`, optionally `.github/workflows/ci.yml`

**Intent**: Adding `packages/**/*.ts` must not break `npm run lint` / `npm run check`.

**Contract**: Exclude `packages` from root `tsconfig.json` `include`/`exclude`. Add `packages/**` to the ESLint `ignores` array (alongside `scripts/**`). Add a product-CI step or job: `npm ci && npm test` inside `packages/code-reviewer` with **no** `CURSOR_API_KEY`. Do not add `@cursor/sdk` to the root `package.json`.

### Success Criteria:

#### Automated Verification:

- `npm ci` and `npm test` succeed in `packages/code-reviewer` without `CURSOR_API_KEY`
- Parser tests cover: raw JSON, fenced JSON, truncated/invalid JSON (throws)
- Root `npm run lint` and `npm run check` still pass after the exclude
- Product CI runs the nested package tests (or the change includes that job)

#### Manual Verification:

- `requirements.md` in this change folder matches the six criteria and the advisory/title+diff decisions
- `packages/code-reviewer/README.md` states the local command and that writes are forbidden once the SDK is wired

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Cursor SDK local run

### Overview

Wire `@cursor/sdk` into the package: one-shot `Agent.prompt`, explicit local runtime, deny-write hook, JSON parse of `result.result`, CLI `npm run review`. Confirm a live key produces valid JSON and does not dirty git.

### Changes Required:

#### 1. SDK adapter

**File**: `packages/code-reviewer/src/agent.ts` (name as needed), `package.json` dependency `@cursor/sdk`

**Intent**: Call the same Cursor harness as the IDE, as a scorer, not as an implementer.

**Contract**: `Agent.prompt(buildReviewPrompt(...), { apiKey, model: { id: "composer-2.5" }, local: { cwd, settingSources: [] } })` — always set `local` explicitly. Pass `apiKey` from `CURSOR_API_KEY` (fail fast if missing). After `wait`/`prompt` returns: if thrown `CursorAgentError` → exit 1; if `status === "error"` → exit 2; if `finished` → `parseReview(result.result)` and print JSON, exit 0 regardless of `verdict`. Log `agentId` / run id to stderr before waiting. Dispose is handled by `Agent.prompt`.

#### 2. Deny-write tool gate

**File**: same adapter module (hooks on `Agent.create`/`prompt` options)

**Intent**: Headless local agents auto-approve Write/Shell. This change chose diff-only scoring.

**Contract**: Register a `preToolUse` (or SDK-equivalent) hook that **denies** Write, Shell, and any tool that mutates the workspace. Read-only tools may also be denied to keep the run to the provided diff — prefer deny-all-tools except none; the prompt already contains the diff. Do not load project/user/team setting sources. After a successful run, `git status --porcelain` in the package cwd (or repo root used as `cwd`) must be empty of agent edits.

#### 3. CLI `review` script

**File**: `packages/code-reviewer/package.json` `scripts.review`, `src/cli.ts`

**Intent**: M5L2 practical: one command, simulated or real diff, JSON out.

**Contract**: `npm run review -- --title "…" [--diff-file path]` reads stdin when `--diff-file` is omitted. Document in the package README. Fixture diff: a small intentional-flaw patch under `packages/code-reviewer/fixtures/` (not a live app file). Unit tests mock `Agent.prompt`; they must not require a key.

### Success Criteria:

#### Automated Verification:

- `npm test` in `packages/code-reviewer` still passes with the SDK mocked
- CLI without `CURSOR_API_KEY` exits 1 with a clear message
- Package TypeScript compiles (`npx tsc --noEmit` in the package, or equivalent script)

#### Manual Verification:

- With a real `CURSOR_API_KEY`, running the CLI on the fixture diff prints JSON that `parseReview` would accept (six scores, verdict, summary)
- `git status` is clean of agent file edits after that run
- Usage/cost is visible in the Cursor dashboard under the SDK tag (spot-check, not a gate)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: CI composite action and workflow

### Overview

Add `.github/actions/ai-reviewer` and `.github/workflows/ai-review.yml`. On PRs to `main`, compute the merge-base diff into a file, run the package, post a comment, set labels. Advisory: fail the job only on startup/run/parse failure. Retry when `ai-cr:review` is added.

### Changes Required:

#### 1. Composite action

**File**: `.github/actions/ai-reviewer/action.yml`

**Intent**: Keep the workflow readable (M5L3): the action runs the reviewer; the workflow owns GitHub side-effects.

**Contract**: `using: composite`. Inputs: `api-key` (required), `pr-title`, `diff-path` (required, file on disk), optional `working-directory` defaulting to `packages/code-reviewer`. Steps: Node from `.nvmrc`, `npm ci` in the package, `npm run review -- --title … --diff-file …`. Write stdout JSON to a workspace file (e.g. `ai-review.json`). Outputs: `verdict` (from that file, not a huge blob). Each `run` step has `shell: bash`. Do not pass the diff contents as an input.

#### 2. Workflow

**File**: `.github/workflows/ai-review.yml`

**Intent**: Same complete loop as the course MVP, on this repo’s real default branch.

**Contract**:

- `on.pull_request`: `types: [opened, synchronize, reopened, labeled]`, `branches: [main]`
- Job `if`: not a fork (`head.repo.full_name == github.repository`); if `github.event.action == 'labeled'` then only `github.event.label.name == 'ai-cr:review'` (do not re-run when the workflow adds `ai-cr:passed` / `failed`)
- `concurrency` group per PR number, `cancel-in-progress: true`
- Permissions: `contents: read`, `pull-requests: write`, `issues: write` (labels)
- Checkout `fetch-depth: 0` (shallow checkout cannot diff against base)
- Compute `git diff origin/${{ github.base_ref }}...HEAD` to a file; exclude or truncate `package-lock.json` / large generated files if they swamp the prompt
- Empty diff → skip the action, post a short “no diff” comment or omit, do not fail
- `env.CURSOR_API_KEY` from `secrets.CURSOR_API_KEY` only inside the action/review step
- After JSON exists: upsert a PR comment whose body starts/ends with `<!-- ai-cr:review -->` (delete or replace the previous marked comment so retries do not stack); ensure labels `ai-cr:passed` (green) and `ai-cr:failed` (red) exist (`gh label create … || true`); add the matching label and remove the opposite; remove `ai-cr:review` after a retry
- Job `exit 0` when JSON parsed and `verdict` is pass or fail; non-zero only when the action/CLI used exit 1/2 or JSON missing
- `workflow_dispatch` optional for manual debug

#### 3. Secrets and docs

**File**: `.env.example`, `packages/code-reviewer/README.md`, a short pointer in `README.md` and/or `AGENTS.md` CI secrets list

**Intent**: Local and CI share the same key name; never commit the key.

**Contract**: Document `CURSOR_API_KEY` in `.env.example` as a comment/placeholder only. List the GitHub Actions repo secret `CURSOR_API_KEY` next to existing CI secrets. Do not put the key in workflow YAML. Note fork PRs are skipped.

### Success Criteria:

#### Automated Verification:

- `.github/actions/ai-reviewer/action.yml` and `.github/workflows/ai-review.yml` exist and target `main`
- Product `ci.yml` still passes on a PR that only adds these files plus package tests (no Cursor key required for product CI)
- Nested package `npm test` still runs in product CI

#### Manual Verification:

- `CURSOR_API_KEY` is set as a GitHub Actions secret
- Open a PR to `main`: Actions shows **AI Code Review** (or equivalent name) with job logs; the PR has a comment from the bot and exactly one of `ai-cr:passed` / `ai-cr:failed`
- Adding `ai-cr:review` retriggers review and replaces the previous marked comment
- A fail verdict leaves the workflow green
- 10xChampion evidence: screenshot of the workflow run, job logs, and the LLM PR comment

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `parseReview`: valid JSON, markdown-fenced JSON, extra prose around JSON (define one behavior: extract first JSON object or fail — pick extract-first-object and lock it)
- Schema reject: missing `verdict`, non-enum verdict, missing criterion
- `buildReviewPrompt` includes title, diff, and all six criterion names
- CLI empty diff → skip payload without calling the agent
- Agent adapter: mock `Agent.prompt` — maps `CursorAgentError` to exit 1 and `status: "error"` to exit 2

### Integration Tests:

- None against Cursor’s API in CI (cost + secrets + non-determinism)
- No new Playwright

### Manual Testing Steps:

1. `cd packages/code-reviewer && echo "$CURSOR_API_KEY" | wc -c` then `git diff main | npm run review -- --title "local smoke"`
2. Confirm JSON shape and clean `git status`
3. Push a branch, open PR to `main`, wait for the review workflow
4. Confirm comment + label; add `ai-cr:review` and confirm a second run
5. Capture Champion screenshots

## Performance Considerations

Each PR `synchronize` is a billed SDK run. Concurrency cancel-in-progress avoids overlapping runs on the same PR. Truncate huge diffs rather than sending lockfiles. Do not add PR body. Keep `settingSources` empty so skills/hooks from the IDE do not inflate the turn count.

## Migration Notes

No data migration. Operators must create GitHub labels (workflow may create them) and add `CURSOR_API_KEY` before the first PR review can succeed. Existing PRs get a review on the next `synchronize` or by adding `ai-cr:review`.

## References

- Lessons: `/home/zawilecxd/Documents/10xdevs/lessons/m5l2-twoj-pierwszy-agent-zespolowy-sdk-koszty-metryki.md`, `m5l3-code-review-w-erze-ai-standardy-dod-i-agent-w-pipeline.md`
- Course seed: `.cursor/prompts/m5l3-requirements.md`
- Cursor TypeScript SDK: https://cursor.com/docs/sdk/typescript (`Agent.prompt`, local runtime, hooks, Node 22.13+)
- Composite actions: https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-composite-action
- Parked alternative: `.cursor/skills/10x-impl-review-ci/references/workflow-template.yml`
- Opportunity map (do not enable plan-aware CI gate): `context/team/opportunity-map.md`

## Implementation addenda

### Cloud live path (phases 2–3)

Local `agent.send()` SIGSEGVs on this Linux host (Node 22.13, `@cursor/sdk` 1.0.28, exit 139). Live scoring and `.github/workflows/ai-review.yml` use `--runtime cloud` / `CURSOR_SDK_RUNTIME=cloud` with `Agent.create({ cloud: {} })` (no-repo VM, `autoCreatePR` unset). Local remains the unit-tested default: `disallowedTools`, `local.settingSources: []`, `JsonlLocalAgentStore`, and `Agent.create`/`send` instead of `Agent.prompt` / `preToolUse`. The “not doing cloud” guardrail in this plan is superseded for the live/CI path only.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Package contract

#### Automated

- [x] 1.1 `npm ci` and `npm test` succeed in `packages/code-reviewer` without `CURSOR_API_KEY` — 7ade98d
- [x] 1.2 Parser tests cover: raw JSON, fenced JSON, truncated/invalid JSON (throws) — 7ade98d
- [x] 1.3 Root `npm run lint` and `npm run check` still pass after the exclude — 7ade98d
- [x] 1.4 Product CI runs the nested package tests (or the change includes that job) — 7ade98d

#### Manual

- [x] 1.5 `requirements.md` in this change folder matches the six criteria and the advisory/title+diff decisions — 7ade98d
- [x] 1.6 `packages/code-reviewer/README.md` states the local command and that writes are forbidden once the SDK is wired — 7ade98d

### Phase 2: Cursor SDK local run

#### Automated

- [x] 2.1 `npm test` in `packages/code-reviewer` still passes with the SDK mocked — 78bc316
- [x] 2.2 CLI without `CURSOR_API_KEY` exits 1 with a clear message — 78bc316
- [x] 2.3 Package TypeScript compiles (`npx tsc --noEmit` in the package, or equivalent script) — 78bc316

#### Manual

- [x] 2.4 With a real `CURSOR_API_KEY`, running the CLI on the fixture diff prints JSON that `parseReview` would accept (six scores, verdict, summary) — 78bc316
- [x] 2.5 `git status` is clean of agent file edits after that run — 78bc316
- [x] 2.6 Usage/cost is visible in the Cursor dashboard under the SDK tag (spot-check, not a gate) — 028bc1b

### Phase 3: CI composite action and workflow

#### Automated

- [x] 3.1 `.github/actions/ai-reviewer/action.yml` and `.github/workflows/ai-review.yml` exist and target `main` — 028bc1b
- [x] 3.2 Product `ci.yml` still passes on a PR that only adds these files plus package tests (no Cursor key required for product CI) — 028bc1b
- [x] 3.3 Nested package `npm test` still runs in product CI — 028bc1b

#### Manual

- [x] 3.4 `CURSOR_API_KEY` is set as a GitHub Actions secret — 028bc1b
- [x] 3.5 Open a PR to `main`: Actions shows the review workflow with job logs; the PR has a comment from the bot and exactly one of `ai-cr:passed` / `ai-cr:failed` — 028bc1b
- [x] 3.6 Adding `ai-cr:review` retriggers review and replaces the previous marked comment — 028bc1b
- [x] 3.7 A fail verdict leaves the workflow green — 028bc1b
- [x] 3.8 10xChampion evidence: screenshot of the workflow run, job logs, and the LLM PR comment — 028bc1b
