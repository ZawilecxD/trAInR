# In-flight Snapshot Helper — Plan Brief

> Full plan: `context/changes/in-flight-snapshot-helper/plan.md`
> Shape notes: `context/team/in-flight-snapshot-shape.md`
> Opportunity map: `context/team/opportunity-map.md`

## What & Why

You come back to the project every few days and have forgotten the status of changes, what to implement next, what depends on what, and what was recently merged. Forgotten close/archive and roadmap rows without Linear issues add to the chaos. Reconstituting that picture takes time before work can continue.

None of Linear, GitHub, or the roadmap answers that re-entry question alone. The change is a generated local snapshot that puts those sources in one place, joined by the same change identifier when it exists and showing gaps when it doesn’t — including work that git and Linear status say should already be closed or archived. The helper does not write to Linear, GitHub, the roadmap, or change folders.

## Starting Point

Four sources, no aggregator. Change ID joins roadmap ↔ folders; Linear is optional `ZAW-N`; branches are `zaw-N-…`. Linear auth is Cursor plugin OAuth only. Leftovers already exist (`ui-redesign` done-but-unarchived, `test-plan-refresh-2026-06-27` implemented, no Linear). `scripts/local-workspace` only opens URLs.

## Desired End State

`/in-flight-snapshot` opens one gitignored HTML page: in progress (with gaps), hanging PRs, conservative archive-folder / close-Linear flags, roadmap next in At a glance order, recently done (14 days). Failed sources show a banner and fix steps. Then you close, merge, and start work in the source tools.

## Key Decisions Made

| Decision           | Choice                                      | Why                                              | Source      |
| ------------------ | ------------------------------------------- | ------------------------------------------------ | ----------- |
| Blast radius       | Helper only; coaching app untouched         | Side tool, not a second product                  | Shape       |
| Write-back         | Read-only v1                                | Sources stay the record                          | Shape       |
| Next-up            | Roadmap At a glance order                   | Do not invent a second queue                     | Shape       |
| Runner             | Cursor skill + Node classify/HTML           | Linear OAuth is MCP-only; classifier stays testable | Plan     |
| Source failure     | Degrade + loud banner + fix instructions    | `gh auth` is already stale on this machine       | Plan        |
| Close/archive      | Two independent conservative flags          | Catches both leftover types; omit if In Progress | Plan        |
| Hanging / recent   | All open PRs; Done/merged last 14 days      | Covers a few days away without months of Done    | Plan        |
| Tests              | Classifier fixtures only, no network        | Locks flags; HTML stays ugly-and-throwaway       | Plan        |

## Scope

**In scope:** Node join/classify + fixture tests; CLI → `tmp/in-flight-snapshot.html`; `npm run snapshot` degraded run; `/in-flight-snapshot` skill; AGENTS.md one-liner; gitignore `tmp/`.

**Out of scope:** Writes to Linear/GitHub/roadmap/changes; coaching app; prompt-fill; stored dashboard; Linear API key; `local-workspace` wiring; CI `npm test` expansion.

## Architecture / Approach

Skill fetches Linear (MCP) and GitHub (`gh`, then GitHub MCP), writes JSON under `tmp/`. Node always reads roadmap + `context/changes` + optional JSON, classifies, renders HTML, optionally opens it. Node never calls MCP. Missing JSON = failed source, not a crash.

## Phases at a Glance

| Phase                         | What it delivers                         | Key risk                                      |
| ----------------------------- | ---------------------------------------- | --------------------------------------------- |
| 1. Join and classify          | Model + flags + Vitest fixtures          | Flags too aggressive (false archive/close)    |
| 2. CLI and HTML page          | `npm run snapshot` + gitignored HTML     | Degraded run looks like a complete picture    |
| 3. Skill and discoverability  | `/in-flight-snapshot` + AGENTS.md        | Skill accidentally writes to Linear/GitHub    |

**Prerequisites:** Linear Cursor plugin for the full run; `gh` or GitHub MCP optional (degrades). Shape notes accepted.
**Estimated effort:** ~2–3 sessions across 3 phases (after-hours).

## Open Risks & Assumptions

- `change.md` uses both `change_id` and `id`; parser must accept both.
- Roadmap `planning` / `in-progress` are unused — ongoing comes from Linear + folders + PRs.
- CI does not run `npm test`; classifier tests are a local/`npm test` gate only.
- If Linear list hits the 250 cap, treat as source failure rather than a silent partial list.

## Success Criteria (Summary)

- Sit down, run `/in-flight-snapshot`, glance in-progress / next / leftovers / hanging PRs without opening three tabs.
- Flags omit when Linear is In Progress or In Review.
- A failed GitHub/Linear fetch still yields a useful local page with a banner telling you how to fix it.
