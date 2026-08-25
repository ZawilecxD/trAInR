# AI code review requirements (decided)

Frozen from `.cursor/prompts/m5l3-requirements.md` plus planning decisions for `cursor-sdk-agent-code-review`. Implement/review against this file, not chat.

## Overall concept

- GitHub Actions workflow on every new pull request to **`main`** (repo default; not `master`)
- Composite action for the review itself so the workflow stays easy to reason about
- Advisory gate: last word stays human. The workflow fails only if the agent never starts, the run errors, or the JSON cannot be parsed. A `verdict: fail` does **not** fail the check and does not block merge.

## Input parameters

- Pull request **title**
- **git diff** (three-dot vs the PR base, written to a file — never via `GITHUB_OUTPUT` / action `inputs` as the full patch)
- **Not** the pull request body (cost)

## Code Review Criteria

Each criterion is scored on a 1–10 scale, where 1 is the worst outcome and 10 is the best. Schema fields are numbers (1–10 described in the prompt, not integer min/max constraints).

1. **implementation correctness** (`implementationCorrectness`) — does the code actually do what it claims, handling edge cases and error paths without introducing regressions?
   - _1_: logic is broken, misses obvious edge/error cases, or silently regresses existing behavior.
   - _10_: behaves correctly across happy path, edge cases, and failure modes with no regressions.

2. **idiomaticity** (`idiomaticity`) — does the code follow the language, framework, and project conventions a fluent reader would expect?
   - _1_: fights the stack's idioms and the repo's established patterns, reads as foreign.
   - _10_: indistinguishable from well-written surrounding code, uses the right idioms naturally.

3. **complexity** (`complexity`) — is the solution as simple as the problem allows, without needless abstraction or convolution?
   - _1_: over-engineered or tangled — hard to follow, with accidental complexity that obscures intent.
   - _10_: minimal and clear, the simplest design that solves the problem completely.

4. **test / risk coverage** (`testRiskCoverage`) — are the meaningful behaviors and risky paths exercised by tests proportional to their risk?
   - _1_: risky logic ships untested; tests are absent, trivial, or assert nothing useful.
   - _10_: risk-weighted coverage — the parts most likely to break are tested deliberately and well.

5. **documentation** (`documentation`) — are non-obvious decisions, public surfaces, and tricky code explained where a reader would need it?
   - _1_: opaque — no comments or docs where they're needed, intent must be reverse-engineered.
   - _10_: just enough docs/comments to explain the "why" without restating the obvious.

6. **security and safety** (`securitySafety`) — does the change avoid introducing vulnerabilities, leaking secrets, or unsafe handling of untrusted input?
   - _1_: introduces an exploitable flaw, leaks secrets, or trusts untrusted input unsafely.
   - _10_: input is validated, secrets are handled correctly, and no new attack surface is opened.

JSON also includes `verdict: "pass" | "fail"` and `summary` (markdown).

## Expected side-effects

- PR comment with summary (upsert via a `<!-- ai-cr:review -->` marker)
- Labels: `ai-cr:failed` (red) **or** `ai-cr:passed` (green) — exactly one after a successful parse

## Expected behavior

- On-demand retry when label `ai-cr:review` is added
- Fork PRs are skipped (no secrets on forks)

## Parked (out of scope for this change)

- Evals / promptfoo / model bake-offs (keep the reviewer importable later)
- Extra agent tools (`readPlan`, `postPrComment`, Linear, Slack)
- Plan-vs-diff `10x-impl-review-ci` / `impl-review` gate
- Blocking merge on `verdict: fail` (no required check, no `ai-cr` override label)
- Passing PR body into the prompt
- Business alignment and architectural fit (require broader context)
