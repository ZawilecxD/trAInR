# Mom Test Validation Plan

## Input Idea

Plan-aware review on agent PRs: run the existing `/10x-impl-review` (plan vs diff) on Cursor-agent pull requests — as a PR comment and `impl-review.md`, possibly later as CI — so merge is not only lint/tests/build plus the author’s click-through and SQL.

**Why this idea, not the others on `context/team/opportunity-map.md`:** the change-identity digest was already Mom-tested and dropped (file leftovers, no costly incidents). Multi-change orchestration stays wait / no build. Click-through after agent PRs is real pain, but the map already points at roadmap Q-04 (Playwright in CI), a known slice, not a new internal tool. This is the remaining candidate.

**Prior check (change-identity digest):** mismatch exists in the repo; costly pain was not shown. Do not shape or build that digest.

## Hypotheses

- **User/role**: Mateusz, merging Cursor-agent PRs on trAInR (solo builder).
- **Friction**: After an agent branch, lint/tests/build can pass while the work still drifts from the plan or hides a safety issue; the author is the only remaining gate, and the usual ritual is clicking the app and running SQL.
- **Current workaround**: Local `/10x-impl-review` on some slices; then manual UI + SQL. CI today: unit tests, integration tests, lint, `check`, build, Vercel preview. No impl-review job. No E2E job.
- **Proposed solution**: Run the existing plan-vs-diff review on the PR (comment + `impl-review.md`), maybe as a gate. First useful version on the map: run `/10x-impl-review` on one recent agent PR, not a new product.
- **Risky assumptions**: The author would read and act on a CI comment; issues that matter are in the diff/plan, not only in the running app; CI is the gap, not that the local skill is skipped when busy; a report would change merge, not add a tab that gets ignored.
- **Evidence already present**: Nine archived reviews under `context/archive/*/reviews/impl-review.md`. Some changed code (`session-comments` approved after fixes; `plan-assignment` warnings addressed; `exercise-statistics` F1 fixed in `112f8c3`). Recent active work (`ui-redesign`, `ai-trainer-assistant`) has no `reviews/impl-review.md`. Several reports mark UI/SQL as “reviewer manual gate” and still APPROVE — the bot already defers the check the author actually runs. Guess, not fact: that putting the same review in CI would have changed a merge already made.

## Critique

Two jobs are easy to mix:

1. **Did the agent follow the plan / ship something unsafe?** — what impl-review is for. Local runs have already caught real warnings.
2. **Does the product work when clicked and queried?** — what the author said they actually do. CI review will not replace that. Q-04 might shrink it.

If (2) is the pain, this candidate is the wrong tool. If (1) is the pain, the cheaper test is not a new workflow: run `/10x-impl-review` on the next agent PR (or the last one that skipped it) and see whether the report is treated as a merge input.

CI automation only earns its keep if local review is easy to skip **and** that skip has already cost something. Missing reviews on recent redesign work are a hint the skill gets skipped; they are not yet a story of damage.

Existing process may already be enough: run the local skill when the slice has a plan; keep click-through for UX; pull Q-04 when the clicking itself is the load.

**What would kill it:** last few agent PRs merged after click-through, no review file opened, and nothing a review would have flagged showed up later. Or local review already happens when it matters and a CI job would duplicate it.

**What would support it (still not a full CI product):** at least one recent skip that later needed a fix a review would have named, or a habit of waiting on CI where a review comment would have blocked or delayed merge.

Behavior questions (not whether CI review would help):

1. Last agent PR merged: was an `impl-review.md` opened (or `/10x-impl-review` run) before merging, or only click-through + SQL? Which slice?
2. Last time a review finding changed the code before merge — what was it, and how was it found (the report, the UI, SQL, CI)?
3. Last merge **without** a review: what, if anything, had to be patched afterwards, and how was that noticed?

If (2) is “the report, more than once” and (1)/(3) show skips under time pressure, a CI hook has something to stand on. If (2) is “I saw it in the UI” and (3) is “nothing broke,” do not wire CI.

## Interview Guide

Self-interview first (the author is the only reviewer today). Same script if a collaborator appears. Do not mention “review bot in CI” until the end.

**Context warm-up**

- How many agent PRs did you merge in the last month, and what is your usual order: CI green → preview click → SQL → read diff → something else?
- When a slice has a `plan.md`, when do you run `/10x-impl-review` today — before the PR, after you already clicked, or not at all?

**Recent story**

- Walk through the last agent PR from “agent finished” to merge. What did you actually open?
  - Follow-up: Did that PR have an `impl-review.md`? If not, did you notice?
- Last time you read a review report: which finding did you act on, skip, or leave as “manual gate”?

**Current workaround**

- When lint/tests are green but you still don’t trust the agent, what do you do next?
- In the last month, which of these did you actually use: `/10x-impl-review`, reading `reviews/impl-review.md`, GitHub PR diff, Vercel preview, SQL in Studio, Playwright locally?

**Cost of pain**

- Last issue that landed in a merged agent PR: how did you find it, and how long to fix?
- Have you ever delayed a merge because a review said NEEDS ATTENTION? What happened next?

**Existing alternatives**

- If you added “no merge without `/10x-impl-review` on plan-driven PRs” as a personal rule, would last month’s skips still have happened?
- Cursor Bugbot / Copilot on the PR: have you tried either, and did a comment change the code?

**Decision signal**

- What would have to go wrong again before you changed the merge ritual?
- If the next review only repeats “run the UI yourself,” what will you do with that report?

**Closing ask**

- Can we look at the last 2–3 merged agent PRs and whether a review file exists, without designing a workflow?

## Survey

Self-audit of the last 30 days. Fill from the calendar, not from how the workflow should work. For one operator this is a written log, not a popularity poll.

1. **Screener:** Did you merge at least one PR that an agent largely implemented? Yes / No. (If No, stop.)
2. How often did you run `/10x-impl-review` (or open its report) before merge? Every plan-driven PR / more than half / once / never.
3. How often did you click through the preview and/or run SQL before merge? Every PR / more than half / once / never.
4. Last review report you read: did any finding change code before merge? Yes, a warning/critical / only observations / I didn’t act / I didn’t read one.
5. Last merged agent PR with **no** review file: did you later patch something that was a plan miss or a safety issue (not a visual nit)? Yes / No / no such PR.
6. After CI is green, what usually determines merge? Preview looks right / SQL looks right / review report / time pressure / combination (say which).
7. Open: describe the last review finding you treated as blocking, including how you noticed it.
8. Open: describe the last post-merge fix on an agent PR, including how you noticed it. (Skip if none.)

Do not ask about wanting a bot, paying for CI minutes, or ranking Bugbot vs a custom action.

## Decision Criteria

- **Proceed** (to a throwaway: one local `/10x-impl-review` on a recent skipped PR, then consider CI only if that report would have changed merge): at least one recent skip that later needed a plan/safety fix, **or** two cases where the report (not the UI) changed code, **and** CI is already something waited on before merging.
- **Narrow scope**: the only gap is forgetting to run the local skill. Then the first version is a PR template / personal merge rule / agent epilogue reminder — not a GitHub Action.
- **Do not build yet**: no miss the report would have caught; existing reports are not read; or post-merge fixes are all “the button didn’t work,” which is Q-04 / click-through, not impl-review.
- **Try existing tool/process first**: run `/10x-impl-review` on the next plan-driven agent PR (and on `ui-redesign` if it never got one). Keep merging with preview + SQL. If the skill is skipped again and a plan/safety bug follows, CI has a job. If the report only says to click through, stop — that pain is Q-04.

If this candidate dies too, the honest leftover on the opportunity map is **Q-04**, not a new tool: encode the click-through already done.
