# In-flight Snapshot Helper Implementation Plan

## Overview

Build a local, read-only day-start snapshot for Mateusz: a Cursor skill fetches live Linear and GitHub, a Node classifier joins them with `roadmap.md` and `context/changes`, and a gitignored HTML page shows in-progress work, hanging PRs, conservative close/archive leftovers, recently done (14 days), and the roadmap’s next queue. The trAInR coaching app is unchanged. Sources stay the system of record.

## Current State Analysis

Work is tracked in four places that do not share one foreign key:

- **Roadmap** (`context/foundation/roadmap.md`): At a glance tables with `S-NN` / `Q-NN` / `F-NN` plus a kebab-case **Change ID**. Status vocabulary includes `proposed`, `ready`, `planning`, `in-progress`, `done`, `blocked`, and the extra value `parked`. Roadmap `planning` / `in-progress` are unused today — “what is in flight” will not come from this table.
- **Change folders** (`context/changes/<change-id>/change.md`): Canonical fields in `docs/reference/change-md.md`. Wild variants exist: `id:` instead of `change_id:`, statuses `done` / `parked` / `researched` / `research-complete`, empty `linear_issue:`. Archive means `git mv` to `context/archive/<created>-<change-id>/` with `status: archived`.
- **Linear**: Cursor plugin MCP (`user-Linear`), identifiers `ZAW-N`, linked only when `linear_issue` is set. No Linear API key in-repo. Write tools (`save_issue`, `save_comment`) must never be used by this helper.
- **GitHub / git**: PRs are not stored in `change.md`. Branches are usually `zaw-N-<slug>` from `/start-linear-issue`, not the change folder name. `gh pr list` is the documented CLI; GitHub MCP is the fallback. Local `gh auth` may be stale — that is a first-class failure mode, not an afterthought.

There is no aggregator. Closest analog is `scripts/local-workspace`, which only **opens browser URLs**. `scripts/**` is eslint-ignored (`eslint.config.js`). Vitest unit tests currently include only `src/**/*.test.ts`. CI runs `lint` + `build`, not `npm test`.

Real leftovers the classifier must handle: `ui-redesign` still under `context/changes/` with `status: done` while roadmap S-18 is `proposed`; `test-plan-refresh-2026-06-27` is `implemented` with no Linear link.

## Desired End State

After days away, running `/in-flight-snapshot` in Cursor produces one local HTML page (opened in the browser) that is only as fresh as that run. On that page you can see:

1. Ongoing topics, with relatedness when Change ID / `ZAW-N` join, and an obvious **gap** when an id is missing.
2. Hanging PRs: every open PR, drafts labeled not hidden.
3. Conservative flags: **archive folder** and **close Linear** as independent signals; omit when Linear is In Progress or In Review.
4. Next: non-`done` / non-`parked` At a glance rows in **document order** (feature table, then quality table) — not a derived queue.
5. Recently done: Linear Done and merged PRs in the last 14 days.
6. A loud banner per failed source (Linear / GitHub) with short fix instructions — never a silent empty “nothing in flight.”

Verification: fixture tests lock join/flag rules; a degraded `npm run snapshot` still renders local git/roadmap/folders; a full skill run with MCP/`gh` opens the page.

### Key Discoveries:

- Join key is kebab-case Change ID (roadmap column ↔ folder name ↔ `change_id` or `id` in frontmatter). Linear is optional `linear_issue: ZAW-N`. Branches are `zaw-N-…`, not the folder name — `.cursor/skills/start-linear-issue/SKILL.md`, `.cursor/hooks/pr-linear-sync.cjs`.
- Node cannot call Linear MCP. The skill must fetch Linear (and GitHub) and pass JSON into the CLI. A standalone Linear API key is out of scope.
- `scripts/**` is the established local-tooling home (`scripts/local-workspace`, `package.json` `"local-workspace"`). Do not put this in `src/pages` or `public/`.
- Shape notes (`context/team/in-flight-snapshot-shape.md`) already settled FRs, non-goals, and blast radius — this plan implements that helper, not a second product.

## What We're NOT Doing

- Writing to Linear, GitHub, `roadmap.md`, or `context/changes` (no close, no archive, no comments, no PR actions).
- Changing the trAInR coaching app (`src/`, `public/`, Astro routes, auth, migrations).
- A second next-up list that is not the roadmap’s At a glance order.
- Prompt-fill for Cursor agents (FR-005 dropped).
- History, charts, stored dashboards, or committing generated HTML.
- Agent orchestration (`/10x-goal-implement` stays the way to start a slice).
- A Linear API key / GraphQL client in `.env`.
- Wiring this into `scripts/local-workspace` (keep the coaching-dev launcher unchanged).
- Expanding CI to run `npm test` (existing CI gate stays lint + build).
- Identity-digest as a product (Mom Test already dropped that candidate).

## Implementation Approach

Split gather from classify:

1. **Pure Node library** reads the repo (roadmap, change folders, local git metadata) plus optional Linear/GitHub JSON files, joins rows, classifies buckets, returns a snapshot model. This is what Vitest locks.
2. **Thin CLI** renders that model to `tmp/in-flight-snapshot.html` and prints the path. Missing JSON files are failed sources, not crashes.
3. **Cursor skill** is the day-start runner: MCP Linear + `gh` (GitHub MCP fallback) → write JSON under `tmp/` → invoke CLI → open the HTML. The skill’s system prompt forbids every write tool.

Ugly HTML is fine. Inline CSS, no React, no Astro, no new npm dependencies. Parse `change.md` frontmatter as simple YAML scalars (plus optional `phase_issues` map); parse At a glance as markdown tables. Do not add `yaml` / `gray-matter` unless simple parsing proves insufficient.

## Critical Implementation Details

The skill must fetch Linear **before** invoking Node. The CLI never calls MCP, `gh`, or Linear write APIs — it only reads the filesystem, optional JSON paths, and local git. If that split is inverted, a terminal `npm run snapshot` cannot run degraded and tests cannot stay network-free.

Identity normalization is load-bearing: treat `change_id` and `id` as the same Change ID; treat empty `linear_issue:` as absent (gap, not a join); extract `ZAW-N` from branch names (`zaw-38-…`, `ZAW-37-…`) without ever inferring a Linear id from the change folder name alone (same rule as linear-sync).

Close/archive flags are independent and **omit-when-unsure**. If Linear state is In Progress or In Review, show **no** flags for that topic even if `change.md` looks terminal.

## Phase 1: Join and classify

### Overview

Parse the four local/JSON inputs into one row model, join on Change ID / `ZAW-N`, and classify into buckets plus the two conservative flags. Lock the rules with fixture tests and no network.

### Changes Required:

#### 1. Snapshot domain module

**File**: `scripts/in-flight-snapshot/` (new; ESM `.mjs` modules — matches existing `scripts/*.mjs`; eslint already ignores `scripts/**`)

**Intent**: Give the CLI and tests one place that turns raw sources into a snapshot model so classification cannot drift between “skill wrote HTML by hand” and “npm run snapshot.”

**Contract**: Export a function of the form `buildSnapshot({ repoRoot, linear, github, now })` → model with `buckets`, `flags`, `gaps`, `sourceFailures`. `linear` / `github` are parsed JSON or `null` (failed source). `now` is injected for the 14-day window. No I/O except reading files under `repoRoot` (roadmap + `context/changes/*/change.md`). Do not walk `context/archive/` for ongoing rows; archived folders are not leftovers.

Normalize each change folder: `change_id` or `id` → `changeId`; `linear_issue` trimmed / empty → `null`; `status` as written (including non-canonical `done`, `parked`, `researched`). Parse both At a glance tables in `roadmap.md` (feature + quality). Roadmap next-up = rows whose status is not `done` and not `parked`, in file order.

#### 2. Classification rules

**File**: same module group (`classify` alongside parse/join)

**Intent**: Encode the day-start buckets so a leftover cannot look like in-progress and a parked slice cannot look like next.

**Contract**:

- **Ongoing**: Linear state In Progress or In Review; and/or change folder still under `context/changes/` with a non-terminal status (`new`, `preparing`, `planned`, `plan_reviewed`, `implementing`, `blocked`, `researched`, `research-complete` — not `implemented` / `impl_reviewed` / `done` / `archived` / `parked`). Relatedness = shared `changeId` or shared `ZAW-N`. Orphan Linear issues and orphan folders are rows with a gap marker.
- **Hanging PRs**: every object in `github.openPrs`; mark `isDraft`. Join to a topic when `headRefName` contains `ZAW-N` or matches `changeId`.
- **Recently done**: Linear issues with done-like state whose `updatedAt` (or completed-at if present) is within 14 days of `now`; merged PRs whose `mergedAt` is within 14 days. Older Done/merged do not appear.
- **Next**: roadmap At a glance non-`done` / non-`parked` rows in document order. Do not sort by Linear or git. Do not filter by “has a change folder.”
- **Archive-folder flag**: folder still under `context/changes/`, `archived_at` null, status ∈ `{implemented, impl_reviewed, done}`, **and** Linear is done-like / canceled **or** `linear_issue` is absent. Omit if Linear is In Progress or In Review.
- **Close-Linear flag**: `linear_issue` set, Linear is **not** done-like / canceled, folder is terminal (`implemented` / `impl_reviewed` / `done`) **or** already under `context/archive/`, **and** there is no open PR whose branch joins that `ZAW-N`. Omit if Linear is In Progress or In Review.
- **Parked** (`status: parked` on folder or roadmap): not next, not a close/archive flag, not ongoing unless Linear is In Progress/In Review or an open PR joins it.

Linear done-like / in-progress-like must use the JSON’s `stateType` (or equivalent) from `list_issue_statuses`, not a hardcoded English name alone — names can differ; types (`started`, `completed`, `canceled`, `unstarted`, `backlog`) are stable.

#### 3. Fixture tests

**File**: `scripts/in-flight-snapshot/*.test.ts` plus fixture JSON/markdown under `scripts/in-flight-snapshot/fixtures/`

**Intent**: Lock the leftover cases that already exist in this repo and the omit-when-unsure rule so flags cannot silently widen.

**Contract**: Extend `vitest.config.ts` `test.include` with `scripts/in-flight-snapshot/**/*.test.ts` only — do not change the `src/**/*.test.ts` glob. Do not add these paths to `scripts/vitest-staged.cjs` unless it is trivial; CI does not run `npm test`. Fixtures are synthetic (small fake roadmap table + fake change.md files in the test temp dir, or in-memory if the parser is given file contents). Cover at least:

- Terminal folder + Linear Done → archive-folder only (ui-redesign-like).
- Terminal folder + Linear In Progress → **no** flags.
- `implemented` folder + no `linear_issue` → archive-folder only (test-plan-refresh-like).
- Terminal folder + Linear Todo/Backlog + no open PR → close-Linear (and archive-folder **omitted** because Linear is not done/absent-in-the-done-sense — Linear exists and is not done; archive-folder requires Linear done **or** absent; here Linear is present and unstarted → archive-folder omit, close-Linear set).
- Missing `linear_issue` on an ongoing folder → gap visible, still listed ongoing.
- At a glance `proposed` then `parked` then `proposed` → next is the two proposed rows in that order; parked omitted.
- Merged PR 13 days ago in recently done; 15 days ago omitted.
- Draft open PR still hanging, labeled draft.
- `linear: null` → `sourceFailures` includes Linear; local buckets still populate.

### Success Criteria:

#### Automated Verification:

- `npm test` includes and passes `scripts/in-flight-snapshot/**/*.test.ts`
- `npx vitest run scripts/in-flight-snapshot` passes in isolation
- `npm run lint` still passes (scripts remain eslint-ignored; `vitest.config.ts` is linted)

#### Manual Verification:

- Reading a failing fixture name is enough to know which rule broke (names match the cases above)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: CLI and HTML page

### Overview

Render the snapshot model to a single self-contained HTML file, wire `npm run snapshot` so a degraded local run works without Linear/GitHub, and gitignore generated output.

### Changes Required:

#### 1. HTML renderer

**File**: `scripts/in-flight-snapshot/render.mjs` (or equivalent)

**Intent**: One scannable local page — not a product UI, not a stored dashboard.

**Contract**: Pure function `model → html string`. Inline CSS, no external assets, no coaching-app tokens. Page sections in this order:

1. **Source banners** — one banner per failed source with the fix text from the model (CLI supplies default copy if the skill did not).
2. **In progress** — joined rows; gap marker when Change ID or Linear id is missing; links as `<a>` when URLs exist (Linear issue URL, GitHub PR URL, relative path to the change folder).
3. **Hanging PRs**
4. **Close / archive** — two visual groups (archive folder vs close Linear), omitted entirely if both empty
5. **Next** — roadmap order, showing roadmap ID + Change ID + outcome
6. **Recently done** — 14-day window stated on the heading
7. **Generated at** timestamp (`now`) so staleness is obvious if the tab is left open

Do not add charts, filters, or persistence.

#### 2. CLI

**File**: `scripts/in-flight-snapshot.mjs` (entry; keep it thin)

**Intent**: Let the skill and a terminal degraded run share one renderer.

**Contract**:

```text
node scripts/in-flight-snapshot.mjs [--linear <path>] [--github <path>] [--out <path>] [--open]
```

Defaults: `--out tmp/in-flight-snapshot.html`. Missing `--linear` / `--github` → that source failed (banner + fix instructions). Create `tmp/` if needed. `--open` uses `xdg-open` / `open` the same way `scripts/local-workspace` does. Exit `0` on a successful write even with source failures; exit non-zero only on unexpected exceptions (unreadable repo files, render throw). Default Linear fix copy: reconnect the Linear Cursor plugin. Default GitHub fix copy: `gh auth login` (and that GitHub MCP PAT must be valid if using the skill fallback).

`package.json`: `"snapshot": "node scripts/in-flight-snapshot.mjs"`.

#### 3. Gitignore generated output

**File**: `.gitignore`

**Intent**: Generated status is throwaway; do not invent a second tracker in git.

**Contract**: Ignore the repo-relative `tmp/` directory (snapshot HTML + the JSON dumps the skill will write in phase 3). Do not add a blanket `*.html` rule.

### Success Criteria:

#### Automated Verification:

- `npm test` still passes
- `npm run snapshot` exits 0 in this repo, writes `tmp/in-flight-snapshot.html`, and the HTML contains a Linear and GitHub source-failure banner (no JSON flags passed)
- `git check-ignore -q tmp/in-flight-snapshot.html` succeeds
- `npm run lint` passes

#### Manual Verification:

- Open `tmp/in-flight-snapshot.html` in a browser: next-up matches At a glance order (S-18, Q-01, Q-03, Q-04 as of 2026-08-14, plus any other non-done/non-parked rows), `ui-redesign` / `test-plan-refresh-2026-06-27` appear according to local folder status with Linear treated as failed (so archive-folder may show for terminal folders with absent Linear JSON — acceptable for the degraded run; full flag correctness is a phase 3 + Linear JSON concern)
- Page is readable in ~10 seconds (ugly is fine)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Skill runner and discoverability

### Overview

Add `/in-flight-snapshot` as the day-start command: fetch Linear and GitHub, write JSON, run the CLI, open the page. Document it in `AGENTS.md`. Forbid writes.

### Changes Required:

#### 1. Cursor skill

**File**: `.cursor/skills/in-flight-snapshot/SKILL.md`

**Intent**: This is how Mateusz runs the helper after days away — the skill has Linear OAuth; the CLI does not.

**Contract**: User-invoked (`/in-flight-snapshot`). Steps:

1. Discover Linear via existing linear-mcp pattern: `list_teams` → `list_issue_statuses` (team) → `list_issues` for the trAInR project. Collect at least: started (In Progress / In Review), unstarted/backlog issues that match any `linear_issue` found in `context/changes/*/change.md`, and completed/canceled issues updated in the last 14 days. `get_issue` for any `ZAW-N` referenced by a change folder that the list missed. Cap with `limit` ≤ 250. Map each issue to the CLI JSON shape: `identifier`, `title`, `url`, `state` (name), `stateType`, `updatedAt`, `gitBranchName`.
2. GitHub: try `gh pr list --repo ZawilecxD/trAInR --state open` and `--state merged` with JSON fields `number,title,url,isDraft,headRefName,updatedAt,mergedAt`. If `gh` fails, fall back to GitHub MCP pull-request list tools (`owner=ZawilecxD`, `repo=trAInR`). Filter merged-to-last-14-days in the skill **or** pass a slightly larger merged list and let Node filter (Node must still filter; skill-side filter is optional).
3. Write `tmp/in-flight-snapshot-linear.json` and `tmp/in-flight-snapshot-github.json` (create `tmp/`). If a source fails, **omit that file** and still run the CLI so banners appear. Do not write an empty issues array pretending success.
4. Run `node scripts/in-flight-snapshot.mjs --linear … --github … --open` with only the files that exist.
5. Tell the user the page path and that sources were live as of this run.

**Hard forbid** in the skill: `save_issue`, `save_comment`, any Linear write, `gh pr create` / `gh pr merge`, editing `roadmap.md`, editing or moving `context/changes/**`, committing `tmp/`.

Banner fix text the skill may pass through (or rely on CLI defaults): Linear → reconnect Linear plugin / check `user-Linear` MCP; GitHub → `gh auth login` and/or GitHub MCP PAT (`docs/github-mcp-setup.md`).

#### 2. AGENTS.md discoverability

**File**: `AGENTS.md` (Developer Tools section)

**Intent**: Future agents (and Mateusz) can find the day-start command without rediscovering the change folder.

**Contract**: One bullet: in-flight snapshot is a **local helper**, not the coaching app; invoke `/in-flight-snapshot`; output is gitignored under `tmp/`; never a system of record. Do not add a coaching-product route. Do not overwrite `context/foundation/prd.md` / `shape-notes.md` mentions.

### Success Criteria:

#### Automated Verification:

- `.cursor/skills/in-flight-snapshot/SKILL.md` exists and names the CLI invocation, JSON filenames, MCP vs `gh` order, and the write forbid list
- `AGENTS.md` Developer Tools mentions `/in-flight-snapshot`
- `npm test` and `npm run lint` still pass

#### Manual Verification:

- Run `/in-flight-snapshot` with Linear MCP available: page opens; In Progress / In Review issues appear; open PRs appear if `gh` or GitHub MCP works
- Disconnect or skip GitHub: GitHub banner shows `gh auth login` (or MCP PAT) and the rest of the page still renders
- Confirm the skill did not comment on Linear, change issue states, or modify `roadmap.md` / change folders
- Spot-check flags against live leftovers (`ui-redesign`, `test-plan-refresh-2026-06-27`) using actual Linear state — omit if In Progress/In Review

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Join + gap: `change_id` vs `id`; empty `linear_issue`; branch `zaw-N` vs folder name (must not invent Linear ids).
- Archive-folder vs close-Linear vs omit-when-In-Progress (the cases in phase 1).
- Next-up document order and parked exclusion.
- 14-day recently-done boundary (13 vs 15 days) with injected `now`.
- `linear: null` / `github: null` populate `sourceFailures` without dropping local rows.

### Integration Tests:

- None required. No MCP, no `gh`, no coaching-app HTTP. A degraded `npm run snapshot` against the real repo is the smoke test (phase 2 automated + manual).

### Manual Testing Steps:

1. `npm run snapshot` — banners for both live sources, next-up readable, `tmp/` untracked.
2. `/in-flight-snapshot` with Linear connected — ongoing + flags match what you see in Linear for a couple of `ZAW-N`s.
3. Force GitHub failure (invalid `gh` is enough on this machine) — banner + fix text, page still useful.
4. Confirm no Linear comments or status changes after the run.

## Performance Considerations

A few dozen Linear issues, open PRs, and change folders. No pagination UI, no caching. `list_issues` `limit` ≤ 250 is enough for this solo project; if a call truncates, treat that as a source failure (banner: “Linear list truncated — rerun”) rather than a silent partial project list.

## Migration Notes

No data migration. No backfill. Existing leftovers are **shown**, not closed. Generated files are gitignored; nothing to roll back except deleting `scripts/in-flight-snapshot*`, the skill, the npm script, the `tmp/` gitignore line, and the AGENTS.md bullet.

## References

- Shape notes: `context/team/in-flight-snapshot-shape.md`
- Opportunity map: `context/team/opportunity-map.md`
- Change identity: `docs/reference/change-md.md`, `.cursor/skills/10x-new/references/change-md.md`
- Linear MCP: `.cursor/skills/linear-mcp/SKILL.md` (server `user-Linear`)
- GitHub MCP: `.cursor/skills/github-mcp/SKILL.md`, `docs/github-mcp-setup.md`
- Branch naming: `.cursor/skills/start-linear-issue/SKILL.md`
- Do not infer Linear from change-id: `.cursor/skills/linear-sync/SKILL.md`
- Local launcher pattern: `scripts/local-workspace`
- Roadmap At a glance: `context/foundation/roadmap.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Join and classify

#### Automated

- [ ] 1.1 `npm test` includes and passes `scripts/in-flight-snapshot/**/*.test.ts`
- [ ] 1.2 `npx vitest run scripts/in-flight-snapshot` passes in isolation
- [ ] 1.3 `npm run lint` still passes (scripts remain eslint-ignored; `vitest.config.ts` is linted)

#### Manual

- [ ] 1.4 Reading a failing fixture name is enough to know which rule broke (names match the cases above)

### Phase 2: CLI and HTML page

#### Automated

- [ ] 2.1 `npm test` still passes
- [ ] 2.2 `npm run snapshot` exits 0 in this repo, writes `tmp/in-flight-snapshot.html`, and the HTML contains a Linear and GitHub source-failure banner (no JSON flags passed)
- [ ] 2.3 `git check-ignore -q tmp/in-flight-snapshot.html` succeeds
- [ ] 2.4 `npm run lint` passes

#### Manual

- [ ] 2.5 Open `tmp/in-flight-snapshot.html` in a browser: next-up matches At a glance order and terminal local folders are visible under degraded Linear
- [ ] 2.6 Page is readable in ~10 seconds (ugly is fine)

### Phase 3: Skill runner and discoverability

#### Automated

- [ ] 3.1 `.cursor/skills/in-flight-snapshot/SKILL.md` exists and names the CLI invocation, JSON filenames, MCP vs `gh` order, and the write forbid list
- [ ] 3.2 `AGENTS.md` Developer Tools mentions `/in-flight-snapshot`
- [ ] 3.3 `npm test` and `npm run lint` still pass

#### Manual

- [ ] 3.4 Run `/in-flight-snapshot` with Linear MCP available: page opens; In Progress / In Review issues appear; open PRs appear if `gh` or GitHub MCP works
- [ ] 3.5 Disconnect or skip GitHub: GitHub banner shows `gh auth login` (or MCP PAT) and the rest of the page still renders
- [ ] 3.6 Confirm the skill did not comment on Linear, change issue states, or modify `roadmap.md` / change folders
- [ ] 3.7 Spot-check flags against live leftovers (`ui-redesign`, `test-plan-refresh-2026-06-27`) using actual Linear state — omit if In Progress/In Review
