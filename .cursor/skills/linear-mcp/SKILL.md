---
name: linear-mcp
description: >-
  Use Linear MCP tools for trAInR planning and delivery: issues, projects,
  comments, cycles, milestones, and docs. Use when the user asks to interact
  with Linear, create or update issues, triage backlog, sync roadmap slices,
  check sprint status, delegate to the Linear agent, or manage projects and
  documents in their workspace.
---

# Linear MCP Workflows

## Setup (already configured)

- **Plugin**: Linear is enabled in `.cursor/settings.json` (`plugins.linear.enabled`).
- **MCP server id**: `user-Linear` (display name: Linear). A duplicate `plugin-linear-linear` may appear; prefer `user-Linear` unless only the plugin server is connected.
- **Auth**: OAuth via the Linear Cursor plugin — no repo-local token file. If tools fail with auth errors, reconnect in **Settings → Tools & Integrations → MCP** (or the Linear plugin settings).

## Before every tool call

1. Read the tool descriptor under `mcps/user-Linear/tools/<tool>.json` (required parameters, enums, defaults).
2. Invoke via `CallMcpTool` with `server: "user-Linear"` and the exact `toolName`.
3. **Markdown strings**: pass real newlines and characters — never `\n` escape sequences in `description`, `body`, or comment fields.
4. **Mentions**: use `@displayName` in markdown bodies when tagging users.

## Discover workspace context first

Do not guess team, project, or state names. On first use in a session (or when unsure):

1. `list_teams` — pick the team for trAInR work.
2. `list_projects` with `query: "trAInR"` (or list all) — bind issues to the right project when applicable.
3. `list_issue_statuses` with `team` — use valid `state` values when creating/updating issues.

Cache team/project identifiers for the rest of the session.

## trAInR conventions

Align Linear work with repo artifacts:

| Repo source                                                | Linear usage                                                                                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `context/foundation/roadmap.md` slices (`F-01`, `S-01`, …) | One issue per slice; title includes Change ID                                                                                     |
| `context/changes/<change-id>/` plans                       | Link in issue `links` or description; optional `linear_issue: ZAW-N` on `change.md` drives [linear-sync](../linear-sync/SKILL.md) |
| GitHub PRs (`ZawilecxD/trAInR`)                            | Add PR URL via `links: [{ url, title }]` on the issue                                                                             |
| Commit style (AGENTS.md)                                   | Lowercase imperative titles when creating issues from code work                                                                   |

**Issue title pattern for roadmap slices:**

```
<change-id>: <short outcome>
```

Example: `database-schema-and-rls: supabase schema with RLS and role middleware`

**Issue description template:**

```markdown
## Outcome

<what "done" means for the user or system>

## PRD / roadmap

- Slice: S-04
- PRD refs: FR-012, US-01

## Repo pointers

- Plan: context/changes/<change-id>/plan.md
- ERD / docs: docs/ERD.md (if schema-related)

## Test plan

- [ ] …
```

## Common workflows

### Create an issue

`save_issue` — **omit `id`**. Required: `title`, `team`. Optional: `project`, `state`, `priority`, `labels`, `assignee` (`"me"` or user), `parentId` (sub-issue), `links`, `blockedBy` / `blocks` / `relatedTo`.

Priority: `0=None`, `1=Urgent`, `2=High`, `3=Medium`, `4=Low`.

### Update an issue

`save_issue` with `id` (UUID or identifier like `TRA-123`). Pass only fields to change. Relation fields (`blocks`, `links`, etc.) are **append-only** unless using explicit `remove*` params.

### List / search issues

`list_issues` — filter by `team`, `project`, `state`, `label`, `assignee: "me"`, `query`, `cycle`, `priority`. Use `cursor` for pagination (max `limit` 250).

`get_issue` — full detail for one id; set `includeRelations: true` when debugging blockers.

### Comments

- Thread on issue: `save_comment` with `issueId` + `body` (no `parentId`).
- Reply: `save_comment` with `parentId` + `body`.
- List: `list_comments` on the parent entity.

### Projects & milestones

- `list_projects` / `get_project` / `save_project` for initiative tracking.
- `list_milestones` / `get_milestone` / `save_milestone` for release-style grouping.

### Cycles (sprints)

`list_cycles` with `team` — assign issues via `save_issue` `cycle` field.

### Documents

`list_documents`, `get_document`, `save_document` for Linear docs; comments use `documentId` on `save_comment`.

### Attachments

1. `prepare_attachment_upload`
2. Upload per returned instructions
3. `create_attachment_from_upload` or `create_attachment`
4. `get_attachment` / `delete_attachment` as needed

### Linear product help

`search_documentation` when unsure how a Linear feature works (cycles, initiatives, triage, etc.).

### Code review diffs (Linear Review)

`list_diffs`, `get_diff`, `get_diff_threads` — use when the user refers to Linear-hosted code review, not GitHub PRs.

## Delegation to Linear agent

When the user says delegate to **Linear** or **the Linear agent**, set `delegate` on `save_issue` (or filter `list_issues` with `delegate`) — that maps to Linear's app user, not a human assignee. Use `assignee` for human owners.

## GitHub + Linear together

| Task                                     | Tooling                                               |
| ---------------------------------------- | ----------------------------------------------------- |
| Code, PRs, CI                            | GitHub MCP — see `.cursor/skills/github-mcp/SKILL.md` |
| Planning, prioritization, slice tracking | Linear MCP (this skill)                               |

After opening a GitHub PR, update the linked Linear issue: `state` → in review, add PR `links`, comment with test-plan checklist via `save_comment`.

## Tool index

| Area          | Tools                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Issues        | `list_issues`, `get_issue`, `save_issue`, `list_issue_statuses`, `get_issue_status`, `list_issue_labels`, `create_issue_label` |
| Comments      | `list_comments`, `save_comment`, `delete_comment`                                                                              |
| Projects      | `list_projects`, `get_project`, `save_project`, `list_project_labels`                                                          |
| Teams / users | `list_teams`, `get_team`, `list_users`, `get_user`                                                                             |
| Planning      | `list_cycles`, `list_milestones`, `get_milestone`, `save_milestone`                                                            |
| Docs          | `list_documents`, `get_document`, `save_document`                                                                              |
| Diffs         | `list_diffs`, `get_diff`, `get_diff_threads`                                                                                   |
| Attachments   | `prepare_attachment_upload`, `create_attachment_from_upload`, `create_attachment`, `get_attachment`, `delete_attachment`       |
| Help          | `search_documentation`                                                                                                         |

## Troubleshooting

| Symptom                  | Action                                                               |
| ------------------------ | -------------------------------------------------------------------- |
| Tool not found           | Confirm Linear MCP is green in Settings; server id is `user-Linear`. |
| Auth / 401               | Re-authenticate Linear plugin; restart Cursor.                       |
| Invalid `team` / `state` | Re-run `list_teams` and `list_issue_statuses`.                       |
| Wrong assignee field     | Use `assignee`, not `assigneeId`, on `save_issue`.                   |
| Escaped markdown         | Remove `\\n`; use literal newlines in JSON arguments.                |
