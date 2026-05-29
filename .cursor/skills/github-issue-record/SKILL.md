---
name: github-issue-record
description: >-
  File bug reports to GitHub and save a local triage copy for ZawilecxD/trAInR.
  Interviews for missing fields, creates the issue via GitHub MCP, then writes
  context/foundation/issues/. Use when the user invokes /github-issue-record,
  asks to file/report/log a bug or GitHub issue, or describes broken behavior
  to track on https://github.com/ZawilecxD/trAInR/issues.
disable-model-invocation: true
---

# /github-issue-record — File a Bug on GitHub

Turn a bug description into a GitHub issue on `ZawilecxD/trAInR`, then save a matching local report under `context/foundation/issues/`.

Uses [github-mcp](../github-mcp/SKILL.md) for `issue_write`, `search_issues`, and `issue_read`.

## Modes

| Input | Mode |
|-------|------|
| Freeform bug description | **Create** — interview → create GitHub issue → save local report |
| `#42`, `42`, or issue URL | **Sync** — fetch existing issue → refresh local report only |

Default is **Create**. Sync never opens a new GitHub issue.

## Initial response

1. **Parse inline input** (everything after the skill name).
2. **If input is an issue reference** → go to [Sync mode](#sync-mode).
3. **If input is a bug description** (even partial) → go to [Create mode](#create-mode); use inline text as seed for Summary / Steps / Local notes.
4. **If input is empty**, respond and **STOP**:

```
I'll file a bug on GitHub and save a local triage report.

Describe the bug inline:
  /github-issue-record select dropdown text is white on white background
  /github-issue-record login redirect loops after signout on /dashboard

Or sync an existing issue locally:
  /github-issue-record 42
  /github-issue-record https://github.com/ZawilecxD/trAInR/issues/42
```

## Required fields (Create mode)

Collect all five before creating the GitHub issue. Pre-fill from inline notes and codebase context; **ask only for what is still missing**.

| Field | Guide |
|-------|-------|
| **Summary** | One or two sentences: what is broken |
| **Steps to reproduce** | Numbered steps, or `unknown — not yet reproduced` |
| **Affected area** | Route, component, or file pattern (e.g. `/trainer/exercises`, `ExerciseFilters.tsx`) |
| **Severity** | `critical`, `high`, `medium`, or `low` |
| **Expected vs actual** | Bullet pair describing correct vs broken behavior |

### Optional fields (ask once if not provided; accept "none")

| Field | Guide |
|-------|-------|
| **Workaround** | Temporary fix, or `none` |
| **Local notes** | Investigation context not suitable for GitHub (hypotheses, file hints) |
| **Linear issue** | `ZAW-N` if linked |

Do not invent reproduction steps or severity — ask the user.

## Interview rules

- Batch missing **required** fields in one message.
- When inline notes or a screenshot imply steps or area, **propose** values and ask the user to confirm or correct.
- Optionally grep the codebase to suggest **Affected area** — present as a suggestion, not a default.
- Skip optional-field prompts when the user said "just file it" or supplied all optional fields inline.

## Duplicate check (Create mode)

Before creating, call `search_issues` with `query` scoped to `repo:ZawilecxD/trAInR` using keywords from Summary and Affected area.

- **Likely duplicate found** → show the match(es) and ask: link to existing `#N` (switch to Sync) or create anyway.
- **No match** → proceed.

## GitHub issue format (Create mode)

Derive **title** from Summary: lowercase imperative, ≤ 72 chars, matching commit conventions (e.g. `fix select dropdown unreadable text on dark theme`). Prefer `fix …` for bugs.

**Body** — use this template exactly (omit optional sections when empty):

```markdown
## Summary

<Summary>

## Steps to reproduce

<numbered list, or "unknown — not yet reproduced">

## Expected vs actual

- **Expected**: <expected>
- **Actual**: <actual>

## Affected area

<affected area>

## Severity

<severity>

## Workaround

<workaround or "none">
```

**Labels**: always include `bug`. Add others only when clearly applicable (`enhancement`, etc.).

Show the user a preview (title + body + labels) and ask:

- **Create** — call GitHub MCP, then save local report
- **Edit** — revise fields
- **Cancel** — discard

## Create on GitHub

Read [github-mcp](../github-mcp/SKILL.md), then:

```
issue_write {
  method: "create",
  owner: "ZawilecxD",
  repo: "trAInR",
  title: "<title>",
  body: "<body>",
  labels: ["bug"]
}
```

On success, read the returned issue number. If the call fails (permissions, label missing), report the error and **STOP** without writing local files.

## Local report format

After the GitHub issue exists (created or synced), save `context/foundation/issues/<issue-number-zero-padded-4>-<slug>.md`:

```markdown
---
issue_number: <N>
github_url: https://github.com/ZawilecxD/trAInR/issues/<N>
title: <GitHub title>
status: open
labels: [bug, ...]
severity: <critical|high|medium|low>
affected_area: <string>
recorded: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
linear_issue: <ZAW-N>   # omit line if none
---

## Summary

<Summary>

## Steps to reproduce

<numbered list>

## Expected vs actual

- **Expected**: <expected>
- **Actual**: <actual>

## Workaround

<workaround or "none">

## Local notes

<Local notes or "none">

## GitHub snapshot

> Fetched <YYYY-MM-DD>. Re-run `/github-issue-record <N>` to refresh.

- **State**: <open|closed>
- **Author**: <login>
- **Created / updated**: <ISO dates>
- **Labels**: <comma-separated>
- **Assignees**: <comma-separated or "none">

### Issue body

<full GitHub body>
```

## Save workflow

1. **Self-bootstrap** `context/foundation/issues/` if missing.
2. **Filename**: `<issue-number-zero-padded-4>-<slug>.md` (slug from title, kebab-case, max 40 chars).
3. **Create mode**: new file; `recorded` and `updated` = today (`date +%Y-%m-%d`).
4. **Sync mode**: refresh GitHub snapshot; preserve `recorded`; set `updated` = today; merge user-edited sections if provided.
5. **Index** — upsert row in `context/foundation/issues/README.md` (sort by issue # ascending):

```markdown
# Recorded GitHub Issues

Local triage reports for [ZawilecxD/trAInR issues](https://github.com/ZawilecxD/trAInR/issues). One file per issue; filenames are `<number>-<slug>.md`.

| # | Severity | Status | Area | Report |
|---|----------|--------|------|--------|
| 1 | medium | open | ExerciseFilters | [0001-fix-select-dropdown-unreadable-text.md](./0001-fix-select-dropdown-unreadable-text.md) |
```

6. **Echo result**:

```
Created https://github.com/ZawilecxD/trAInR/issues/<N>
Saved context/foundation/issues/<filename>
  Severity: <severity> · Area: <affected_area>
```

Stop. Do not open a PR unless the user asks.

## Sync mode

When input resolves to `#N`:

1. `issue_read` method `get` — `owner=ZawilecxD`, `repo=trAInR`
2. Map GitHub title/body into the local report; ask only for **Severity** and **Local notes** if missing from the file on disk.
3. Save or update the local file — **do not** call `issue_write` unless the user explicitly asks to edit GitHub.

## Notes

- **Create is the default.** Users describe bugs; the skill files them on GitHub.
- **One issue per invocation.**
- **Append-only history** for local files — do not delete through this skill.
- Field glossary and MCP examples: [reference.md](reference.md).
