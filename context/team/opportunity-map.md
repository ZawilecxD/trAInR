# Opportunity Map

## Context

- **Project / context**: trAInR — solo builder workflow (Linear issues, `context/changes`, `roadmap.md`, git branches, Cursor agents, GitHub PRs/CI, Supabase, Vercel)
- **Data constraint**: Mock / local / read-only / non-sensitive. First version stays off production and customer data; no access-control or audit work until a candidate needs real user data.
- **Date**: 2026-08-13
- **Updates**: Identity digest Mom-tested and dropped. Confirmed repeating rituals: three-tab status merge; skip `/10x-impl-review` when hurried. New candidate: in-flight snapshot.

## Map

One row per signal, terse cells (a phrase each) — longer reasoning belongs in the sections below:

| Signal | Existing / default response | Thin complement | First useful version | Data risk | Direction if valuable |
|---|---|---|---|---|---|
| Slice IDs drift across Linear, change folders, roadmap, and git branches | `linear_issue` in change.md, `/start-linear-issue`, linear-sync, Linear branch field | Read-only ID join | — | local / read-only | **Do not build** (Mom Test: leftovers, no costly incidents) |
| Sit down, don't know in-flight / next; mentally merge Linear + GitHub + roadmap | Linear In Progress / cycles, `gh pr list`, roadmap “At a glance” | Generated snapshot with links out; not a fourth tracker | Local HTML/md from those three | local / read-only / non-sensitive | Internal tool (regenerate; never system of record) |
| Skip `/10x-impl-review` when hurried, or never open the report | Local skill, implement epilogue, unused CI template, nine archived reviews | Merge rule / PR template | Run the skill on the next plan-driven PR | local / read-only | Reminder now; CI gate only after a miss |
| Agent PRs trusted only after click-through and SQL | Plan Manual Verification, local Playwright, integration tests in CI, Vercel previews, roadmap Q-04 | Put plan checks on the PR; run existing Playwright against the preview | Don't build — reuse the plan checklist and Q-04 | local | Feature (Q-04) / wait |
| Agent PRs get lint/tests/build only; plan drift waits for a human | Local `/10x-impl-review`, unused CI template, Bugbot, Copilot | Enable existing review on labeled PRs | One local impl-review on a skipped PR | local / read-only | Parked pending a costly skip; see skip-review row |
| Several large changes must be sequenced and watched by hand | Roadmap dependencies, Linear projects/cycles, one issue → one branch, `/10x-goal-implement` | None worth building | — | — | Wait / no build |

Observed leftovers (not a product): `S-18` still `proposed` in `roadmap.md` while `ui-redesign/change.md` is `done`; `static-invite-link-approval` has an empty `linear_issue`; CI triggers on `main` while the repo default is `master`.

Unclassified unless they start repeating: same SQL after every agent PR; restating change-folder context at chat start; Playwright exists but unused; test-plan vs product-slice priority; empty Vercel preview data.

## Recommended First Candidate

```text
Candidate:
in-flight snapshot

Reads:
roadmap.md (S-id, change_id, status),
Linear issues (state, title, identifier — MCP or export),
GitHub open PRs + CI (gh pr list / checks)

Returns:
one local page: what's in progress, what's next on the roadmap,
what's open on GitHub, with links to Linear / PR / change folder.
Ugly is fine.

Does not do:
edit Linear, GitHub, or the roadmap;
store a second status;
pretty dashboards, charts, or history;
agent orchestration or code review

Data risk:
local / read-only / non-sensitive

Direction if it proves valuable:
Internal tool you regenerate when you sit down.
If you open it most work sessions, keep the generator.
If you don't, delete it.
```

## Why This Candidate

The three-tab ritual was confirmed: sit down, don't know what's in flight or next, merge Linear + GitHub + `roadmap.md` in your head. That joins three sources and answers a decision. It is not the identity digest (IDs matching) — that failed Mom Test. Skip-review is real but the first version is “run the skill you have,” not a page. Click-through stays Q-04. Orchestration stays wait.

A hand-updated pretty dashboard will stale the way `S-18` already did. Generate from live sources, link out, throw away if unused.

## Next Direction If Valuable

Internal tool first (local generated snapshot). Do not become Linear, GitHub, or the roadmap editor. Do not fold this into the trAInR product PRD (`context/foundation/shape-notes.md` is the coaching app).

Skip-review: personal merge rule + next local `/10x-impl-review`. CI only after a skip that needed a plan/safety fix.

## Next move

Shape the in-flight snapshot (Mom Test skipped by choice). Do **not** overwrite `context/foundation/shape-notes.md` (that file is the trAInR product). Shape this helper as a side artifact, then `/10x-new` → research → plan if the shape stays small — not a second product PRD/roadmap unless it earns one.
