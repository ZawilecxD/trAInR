---
name: start-linear-issue
description: >-
  Start work on a Linear issue: create a git branch from the issue identifier
  (e.g. ZAW-123) and move the issue to In Progress via Linear MCP. Use only when
  the user explicitly invokes this skill or says they want to start working on a
  specific Linear issue (e.g. "let's start working on ZAW-5", "pick up issue
  ZAW-123", "/start-linear-issue").
disable-model-invocation: true
---

# Start Linear Issue

Begin implementation on a Linear issue: branch locally, then set status to **In Progress** in Linear.

**Do not** run this workflow unless the user explicitly asked (named skill, slash command, or phrasing like "start working on issue ZAW-…").

## Prerequisites

- Linear MCP connected (`user-Linear`). See [.cursor/skills/linear-mcp/SKILL.md](../linear-mcp/SKILL.md) for tool schemas and auth.
- Git repo with a clean enough state to branch (warn on uncommitted changes; do not stash unless the user asks).

## Step 1 — Resolve issue identifier

Extract `TEAM-NUMBER` from the user message (e.g. `ZAW-5`, `zaw-123` → normalize to uppercase `ZAW-123`).

If missing or ambiguous, ask once for the identifier. Do not guess.

## Step 2 — Inspect git state

Run in parallel:

```bash
git rev-parse --abbrev-ref HEAD
git status --porcelain
```

Record `current_branch` and whether the working tree is dirty.

**Default branch** for trAInR: `master` (also accept `main` as equivalent).

### Non-default branch warning

If `current_branch` is not `master` or `main`:

1. Tell the user the current branch and that the new branch will be created **from it** (not from `master`).
2. Ask whether to continue on this base or switch to `master` first.
3. **Do not** create the branch or update Linear until they choose:
   - **Continue** — proceed from `current_branch`.
   - **Switch to master** — `git checkout master` (or `main`), then continue from there.
   - **Abort** — stop.

## Step 3 — Load issue from Linear

1. Read `mcps/user-Linear/tools/get_issue.json`, then `CallMcpTool` → `get_issue` with `id: "<IDENTIFIER>"` (e.g. `ZAW-5`).
2. If not found, report and stop.
3. Note `title`, `team`, and any **git branch name** field Linear returns (use it when present).

If you need the exact **In Progress** state name, read `list_issue_statuses.json` and call `list_issue_statuses` with the issue's team. Pick the status whose name matches "In Progress" (case-insensitive). If none match, list candidates and ask the user.

## Step 4 — Choose branch name

Priority:

1. Linear-provided git branch name from `get_issue`, if present.
2. Otherwise: `<identifier-lowercase>` (e.g. `zaw-5`).
3. If that name already exists locally, tell the user and ask: checkout existing branch, or use a suffix (e.g. `zaw-5-2`).

Do not add `feat/` unless the user requests a prefix.

## Step 5 — Create and checkout branch

From the agreed base branch (after any switch):

```bash
git checkout -b <branch-name>
```

If checkout fails (name exists, dirty state blocking), report the error and stop.

## Step 6 — Set Linear status to In Progress

1. Read `mcps/user-Linear/tools/save_issue.json`.
2. `CallMcpTool` → `save_issue` with:
   - `id`: issue identifier (e.g. `ZAW-5`)
   - `state`: resolved In Progress status name from Step 3
   - `assignee`: `"me"` only if the user asked to assign themselves

Use literal newlines in markdown fields — never `\n` escapes.

If `save_issue` fails, report the error; leave the user on the new branch (do not delete it automatically).

## Step 7 — Confirm

Reply with a short summary:

| Item | Value |
|------|--------|
| Issue | `ZAW-N` — title (link if URL known) |
| Branch | `branch-name` (base was `…`) |
| Linear state | In Progress |
| Next | Optional: link `context/changes/…` plan, run `/10x-plan`, or open issue description |

## Examples

**User:** "Let's start working on ZAW-5"

1. On `master`, clean tree → `get_issue` ZAW-5 → `git checkout -b zaw-5` → `save_issue` state In Progress.

**User:** on `feat/old-work`, "start issue ZAW-9"

1. Warn: new branch will branch from `feat/old-work`, not `master`.
2. User says continue → `git checkout -b zaw-9` from current HEAD → update Linear.

## Related

- Planning and issue CRUD: [linear-mcp](../linear-mcp/SKILL.md)
- PRs and CI after implementation: [github-mcp](../github-mcp/SKILL.md)
- PR merge hook may sync Linear on PR create: `.cursor/hooks/pr-linear-sync.cjs`
