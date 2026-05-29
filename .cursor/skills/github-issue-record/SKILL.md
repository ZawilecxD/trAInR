---
name: github-issue-record
description: >-
  Record and update local issue reports for ZawilecxD/trAInR GitHub issues
  using a standard format. Fetches issue metadata via GitHub MCP, interviews
  for missing fields, and saves to context/foundation/issues/. Use when the
  user invokes /github-issue-record, asks to document/save/triage a GitHub
  issue or bug, or references https://github.com/ZawilecxD/trAInR/issues.
disable-model-invocation: true
---

# /github-issue-record — Save a GitHub Issue Report

Capture a structured local report for an existing GitHub issue so future agent runs have reproducible context without re-triaging from scratch.

Works with [github-mcp](../github-mcp/SKILL.md) for live issue data. Storage: `context/foundation/issues/<issue-number>-<slug>.md` plus an index row in `context/foundation/issues/README.md`.

## Initial response

When invoked:

1. **Parse inline input** (everything after the skill name):
   - Issue reference: `#42`, `42`, or `https://github.com/ZawilecxD/trAInR/issues/42`
   - Optional freeform notes — treat as seed for Summary, Steps, or Local notes
2. **If no issue reference**, respond and **STOP**:

```
I'll record a GitHub issue into context/foundation/issues/.

Provide an issue number or URL:
  /github-issue-record 42
  /github-issue-record #42 steps fail on mobile Safari after login
  /github-issue-record https://github.com/ZawilecxD/trAInR/issues/42

I'll fetch GitHub metadata, ask for any missing required fields, then save the report.
```

3. **If reference is present**, read [github-mcp](../github-mcp/SKILL.md) and fetch the issue:
   - `issue_read` method `get` — `owner=ZawilecxD`, `repo=trAInR`
   - Optionally `get_comments` when comments add reproduction or workaround detail

## Required fields

Collect all five before saving. Pre-fill from GitHub or inline notes; **ask only for what is still missing**.

| Field | Guide |
|-------|-------|
| **Issue reference** | `#N` — must resolve to ZawilecxD/trAInR |
| **Summary** | One or two sentences: what is broken or wrong |
| **Steps to reproduce** | Numbered steps, or explicit `unknown — not yet reproduced` |
| **Affected area** | Feature, route, or file pattern (e.g. `/trainer/exercises`, `ExerciseForm`, `Supabase RLS on exercises`) |
| **Severity** | One of: `critical`, `high`, `medium`, `low` |

### Optional fields (ask once if not provided; accept "none")

| Field | Guide |
|-------|-------|
| **Expected vs actual** | Bullet pair, or "same as GitHub body" if already clear there |
| **Workaround** | Temporary fix, or `none` |
| **Local notes** | Investigation context, hypotheses, or decisions **not** on GitHub |
| **Linear issue** | `ZAW-N` if linked |

Do not invent reproduction steps or severity — ask the user.

## Interview rules

- Batch missing **required** fields in one message (numbered list).
- If GitHub title/body clearly answers Summary or Steps, propose it and ask the user to confirm or correct — do not silently accept without confirmation when the body is vague.
- Skip optional-field prompts when the user said "just save what we have" or all optional fields were supplied inline.

## Report format

After fields are complete, render this shape for confirmation:

```markdown
---
issue_number: <N>
github_url: https://github.com/ZawilecxD/trAInR/issues/<N>
title: <GitHub title>
status: <open|closed>
labels: [<label>, ...]
severity: <critical|high|medium|low>
affected_area: <string>
recorded: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
linear_issue: <ZAW-N>   # omit line if none
---

## Summary

<Summary>

## Steps to reproduce

<numbered list, or "unknown — not yet reproduced">

## Expected vs actual

- **Expected**: <text or "see GitHub issue body">
- **Actual**: <text or "see GitHub issue body">

## Workaround

<description or "none">

## Local notes

<Local notes or "none">

## GitHub snapshot

> Fetched <YYYY-MM-DD>. Re-run `/github-issue-record <N>` to refresh metadata.

- **State**: <open|closed>
- **Author**: <login>
- **Created / updated**: <ISO dates from GitHub>
- **Labels**: <comma-separated or "none">
- **Assignees**: <comma-separated or "none">

### Issue body (excerpt)

<first ~500 chars of GitHub body, or full body if shorter; append `…` if truncated>
```

Ask the user to confirm:

- **Save** — write or update the file
- **Edit** — revise fields
- **Cancel** — discard

## Save workflow

1. **Self-bootstrap** `context/foundation/issues/` if missing.
2. **Filename**: `<issue-number-zero-padded-4>-<slug>.md` where slug is the GitHub title kebab-cased, max 40 chars (e.g. `0042-exercise-form-validation-error.md`).
3. **Update vs create**:
   - File exists → update `updated` date and merge: user-confirmed sections replace old content; refresh GitHub snapshot; preserve `recorded` date.
   - New file → set both `recorded` and `updated` to today (`date +%Y-%m-%d`).
4. **Index** — maintain `context/foundation/issues/README.md`:

```markdown
# Recorded GitHub Issues

Local triage reports for [ZawilecxD/trAInR issues](https://github.com/ZawilecxD/trAInR/issues). One file per issue; filenames are `<number>-<slug>.md`.

| # | Severity | Status | Area | Report |
|---|----------|--------|------|--------|
| 42 | high | open | ExerciseForm | [0042-exercise-form-validation-error.md](./0042-exercise-form-validation-error.md) |
```

- Sort rows by issue number ascending.
- Upsert the row for this issue; do not remove other rows.

5. **Echo result**:

```
Saved context/foundation/issues/<filename>
  GitHub: https://github.com/ZawilecxD/trAInR/issues/<N>
  Severity: <severity> · Area: <affected_area>
```

Stop. Do not open a PR or edit GitHub unless the user asks separately.

## Notes

- **Local reports, not GitHub writes.** This skill documents issues in-repo; use `issue_write` from github-mcp only when the user explicitly asks to create or update GitHub.
- **One issue per invocation.** For multiple issues, invoke the skill separately.
- **Append-only history.** Do not delete recorded issues through this skill; mark stale context in Local notes or re-record with an updated snapshot.
- For the full field glossary, see [reference.md](reference.md).
