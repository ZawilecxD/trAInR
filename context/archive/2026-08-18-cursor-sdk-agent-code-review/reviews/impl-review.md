<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Cursor SDK CI agent code review

- **Plan**: `context/changes/cursor-sdk-agent-code-review/plan.md`
- **Scope**: Phases 1–3 of 3
- **Date**: 2026-08-19
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 4 warnings 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Live scorer uses cloud runtime, not Agent.prompt/local

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: packages/code-reviewer/src/agent.ts:85
- **Detail**: Plan required Agent.prompt, explicit local runtime, and a preToolUse deny-write hook. Linux agent.send() SIGSEGVs (exit 139). Implementation uses Agent.create/send, disallowedTools + JSONL store locally, and --runtime cloud (cloud: {}) for live smoke and GHA.
- **Fix A ⭐ Recommended**: Add a short addendum to the plan noting the cloud live path and GHA CURSOR_SDK_RUNTIME=cloud.
  - Strength: Plan stays the source of truth; matches Linear decision-log.
  - Tradeoff: Plan becomes a slightly moving target.
  - Confidence: HIGH — already the shipped behavior.
  - Blind spot: Cloud VM still has tools; no-repo + no autoCreatePR.
- **Fix B**: Drop cloud and require a working local executor.
  - Strength: Matches original “not doing cloud” guardrail.
  - Tradeoff: GHA ubuntu-latest stays broken until SDK is fixed.
  - Confidence: LOW — live send already failed here.
  - Blind spot: No Node 22.14 nvm path on this host.
- **Decision**: FIXED via Fix A

### F2 — Unrelated context and root lockfile landed in p2

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: context/changes/in-flight-snapshot-helper/, context/map/, context/team/, package.json (dependency-cruiser)
- **Detail**: Phase 2 commit included in-flight-snapshot-helper, map/team notes, and root dependency-cruiser after “stage all”. None of that is in this plan. @cursor/sdk is still only in the nested package; 10x-impl-review-ci was not enabled.
- **Fix A ⭐ Recommended**: Leave them; they are other work shipped on this branch.
  - Strength: Avoids rewriting history; already confirmed.
  - Tradeoff: This PR is wider than the reviewer change.
  - Confidence: HIGH — stage-all was explicit.
  - Blind spot: Reviewers may ask to split the PR.
- **Fix B**: Move extras to their own commit/branch before the PR.
  - Strength: Keeps this change reviewable.
  - Tradeoff: History rewrite or a follow-up split.
  - Confidence: MEDIUM — branch may already be on a test PR.
  - Blind spot: Whether that PR already includes these files.
- **Decision**: FIXED via Fix A (left on branch)

### F3 — Cloud runtime cannot deny tools

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/src/agent.ts:85-92
- **Detail**: SDK throws if disallowedTools is combined with cloud. CI uses cloud: {} (no repos, autoCreatePR unset/false). Local worktree is safe; the hosted VM still has a default toolset.
- **Fix**: Keep cloud: {} and rely on prompt + no-repo (current).
- **Decision**: FIXED (kept current)

### F4 — Label steps use || true

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: .github/workflows/ai-review.yml:116-127
- **Detail**: gh label create / gh pr edit failures are swallowed, so a green advisory job can still miss labels. Manual verification confirmed labels work.
- **Fix**: Leave as-is; || true is how the plan creates labels when they already exist.
- **Decision**: FIXED (kept current)

### F5 — Comment upsert matches any marker, not only the bot

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: .github/actions/ai-reviewer/upsert-comment.sh:11-32
- **Detail**: Upsert selects any issue comment whose body contains `<!-- ai-cr:review -->`, then PATCHes the first id and DELETEs the rest. A quoted marker can delete a human comment; a human comment with the marker can become the canonical review.
- **Fix**: Filter to `github-actions[bot]` (or `github.actor`) and only delete extra bot comments with the marker.
- **Decision**: FIXED

### F6 — Diff size cap materializes the full patch first

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ai-review.yml:40-53
- **Detail**: The 204800-byte cap runs after `git diff` writes the whole file. A huge generated file can fill disk/time before truncate. Truncation itself is real (header + `head -c`).
- **Fix**: Stream the cap (`git diff … | head -c`) and keep the truncate header.
- **Decision**: FIXED

### F7 — Reviewer crash posts no PR comment

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: .github/workflows/ai-review.yml:91-92
- **Detail**: Comment/label runs only when the review step succeeded. Exit 1/2 fails the job with a red check and no explanation on the PR.
- **Fix**: Add a failure step that upserts a short “reviewer failed, see logs” comment.
- **Decision**: SKIPPED

### F8 — workflow_dispatch never runs a review

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: .github/workflows/ai-review.yml:7
- **Detail**: `workflow_dispatch` is registered, but the job `if` requires `pull_request`.
- **Fix**: Drop `workflow_dispatch`, or add a `pr_number` dispatch path.
- **Decision**: SKIPPED

### F9 — Unbounded summary can exceed GitHub comment size

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: packages/code-reviewer/src/schema.ts:22
- **Detail**: `summary` is an unbounded `z.string()`. GitHub comments cap at 65536 characters.
- **Fix**: Truncate the markdown file well under 65536 before posting.
- **Decision**: SKIPPED

### F10 — Local denylist still allows read tools

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/src/agent.ts:14-21
- **Detail**: Local denylist blocks shell/edit/delete/mcp but not read/grep/glob, so a local run can ingest `.env`. CI uses no-repo cloud.
- **Fix**: Document that local scoring can read the workspace (or deny read tools if the SDK allows it without the `tools: []` segfault).
- **Decision**: SKIPPED
