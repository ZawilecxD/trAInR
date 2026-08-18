import { reviewCriteria } from "./schema.ts";

export type ReviewPromptInput = {
  title: string;
  diff: string;
};

const CRITERION_ANCHORS = `
1) implementation correctness (implementationCorrectness) — does the code actually do what it claims, handling edge cases and error paths without introducing regressions?
   - 1: logic is broken, misses obvious edge/error cases, or silently regresses existing behavior.
   - 10: behaves correctly across happy path, edge cases, and failure modes with no regressions.

2) idiomaticity (idiomaticity) — does the code follow the language, framework, and project conventions a fluent reader would expect?
   - 1: fights the stack's idioms and the repo's established patterns, reads as foreign.
   - 10: indistinguishable from well-written surrounding code, uses the right idioms naturally.

3) complexity (complexity) — is the solution as simple as the problem allows, without needless abstraction or convolution?
   - 1: over-engineered or tangled — hard to follow, with accidental complexity that obscures intent.
   - 10: minimal and clear, the simplest design that solves the problem completely.

4) test / risk coverage (testRiskCoverage) — are the meaningful behaviors and risky paths exercised by tests proportional to their risk?
   - 1: risky logic ships untested; tests are absent, trivial, or assert nothing useful.
   - 10: risk-weighted coverage — the parts most likely to break are tested deliberately and well.

5) documentation (documentation) — are non-obvious decisions, public surfaces, and tricky code explained where a reader would need it?
   - 1: opaque — no comments or docs where they're needed, intent must be reverse-engineered.
   - 10: just enough docs/comments to explain the "why" without restating the obvious.

6) security and safety (securitySafety) — does the change avoid introducing vulnerabilities, leaking secrets, or unsafe handling of untrusted input?
   - 1: introduces an exploitable flaw, leaks secrets, or trusts untrusted input unsafely.
   - 10: input is validated, secrets are handled correctly, and no new attack surface is opened.
`.trim();

const JSON_SHAPE = `{
  "implementationCorrectness": <number>,
  "idiomaticity": <number>,
  "complexity": <number>,
  "testRiskCoverage": <number>,
  "documentation": <number>,
  "securitySafety": <number>,
  "verdict": "pass" | "fail",
  "summary": "<markdown string>"
}`;

export function buildReviewPrompt({ title, diff }: ReviewPromptInput): string {
  return `You are a diff-only code review scorer. Score the pull request from the title and git diff below. Do not edit files, run commands, or invent changes that are not in the diff.

Return ONLY a single JSON object matching this shape (no markdown, no prose, no code fences):

${JSON_SHAPE}

Scoring: each of ${reviewCriteria.join(", ")} is a number from 1 (worst) to 10 (best). Set verdict to "fail" if the change should not merge as-is, or if any criterion is 4 or below; otherwise "pass". summary is markdown explaining the scores.

Criteria (1 = worst, 10 = best):

${CRITERION_ANCHORS}

Pull request title:
${title}

Git diff:
${diff}
`;
}
