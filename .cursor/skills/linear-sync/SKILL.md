---
name: linear-sync
description: >-
  Sync trAInR change-folder work to a linked Linear issue: comments at plan and
  implement milestones, In Progress when implementation starts. Invoked from
  planning/implement skills when change.md has linear_issue or the user passes
  ZAW-N. Not a standalone slash command — follow events below.
---

# Linear sync (trAInR ↔ Linear)

Keep a parent Linear issue plus optional per-phase child issues aligned with `context/changes/<change-id>/` during planning and implementation. Uses Linear MCP (`user-Linear`) — see [linear-mcp](../linear-mcp/SKILL.md) for tool schemas, auth, and markdown rules.

**Do not** guess issue IDs from change-id or branch name alone. **Do not** run unless an issue is explicitly linked (see [Resolve issue](#resolve-issue)).

## Resolve issue

Read `context/changes/<change-id>/change.md` frontmatter for:

```yaml
linear_issue: ZAW-42 # optional
```

**Accepted sources** (first match wins):

1. `linear_issue` in `change.md`
2. Issue identifier in the **current user message** (e.g. `ZAW-42`, `/10x-implement foo ZAW-42`)
3. User explicitly names an issue in the **current turn** (“sync to ZAW-5”)

If none apply: **skip** Linear sync; one line to the user: “No `linear_issue` in change.md — add `linear_issue: ZAW-N` or pass the issue id to link Linear.”

After resolving, `get_issue` once and cache identifier, title, and current `state` for the session.

## Phase issue mapping (`change.md`)

`change.md` may contain:

```yaml
linear_issue: ZAW-123
phase_issues:
  "1": ZAW-124
  "2": ZAW-125
```

- Keys are stringified phase numbers (`"1"`, `"2"`, ...).
- Values are Linear identifiers for child issues.
- Parent skills own writing this mapping; this skill only reads and uses it.

## User confirmation (first write per session)

Before the **first** `save_issue` or `save_comment` in a chat session for this change:

1. Show: issue id, title, current state, intended action.
2. Ask once: “Update Linear issue **ZAW-N** as described?”
3. If the user rejects or picks another issue, stop or re-resolve.

Later milestones in the **same session** may proceed without re-asking unless the issue id changes.

## Idempotent comments

Every sync comment **must** start with a level-2 heading used as a dedup key:

```markdown
## trAInR — <event-key>
```

| `event-key`               | When                                                                     |
| ------------------------- | ------------------------------------------------------------------------ |
| `plan-drafted`            | `plan.md` first written / materially finalized (`change.md` → `planned`) |
| `implement-started`       | `/10x-implement` entry (`change.md` → `implementing`)                    |
| `phase-<N>-complete`      | After phase N commit SHA written to `plan.md` Progress                   |
| `decision-log`            | Any mid-implementation adaptation, scope change, or non-trivial decision |
| `implemented`             | After final epilogue (`change.md` → `implemented`)                       |
| `implementation-reviewed` | Optional whole-change `/10x-impl-review` before PR returned results      |

Before `save_comment`, call `list_comments` on the issue. If a comment body already contains `## trAInR — <event-key>`, **skip** posting (success).

Use **literal newlines** in comment bodies — never `\n` escapes.

## Status transitions

| Event                     | `save_issue` state change                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `plan-drafted`            | **None** (comment only)                                                                                                                                            |
| `implement-started`       | → **In Progress** only if current state is backlog/todo-like (not In Progress, In Review, Done, Canceled). Use `list_issue_statuses` for the exact name.           |
| `phase-*-complete`        | Parent: **None** (comment only). Child phase issue: if `phase_issues["N"]` exists, move child to **Done** (or closest done-like state from `list_issue_statuses`). |
| `decision-log`            | **None** (comment only)                                                                                                                                            |
| `implemented`             | **None** (comment only). PR create flow moves parent to In Review; PR merge follow-up moves parent (and any remaining phase children) to Done.                     |
| `implementation-reviewed` | **None** (comment only on parent issue). Posted after whole-change review, before PR creation.                                                                     |

Never move **backward** (e.g. In Review → In Progress).

## Event workflows

### `plan-drafted`

**Trigger:** Parent skill finished writing `context/changes/<change-id>/plan.md` and set `change.md` `status: planned`.

**Comment body template:**

```markdown
## trAInR — plan-drafted

**Change:** `<change-id>`
**Plan:** `context/changes/<change-id>/plan.md`

Implementation plan drafted. Review in repo; run `/10x-plan-review` or approve before `/10x-implement`.
```

### `implement-started`

**Trigger:** Parent skill set `change.md` `status: implementing` on `/10x-implement` entry.

**Actions:** Comment (template below) + conditional `save_issue` → In Progress.

```markdown
## trAInR — implement-started

**Change:** `<change-id>`
**Plan:** `context/changes/<change-id>/plan.md`

Implementation started in repo.
```

### `phase-<N>-complete`

**Trigger:** After phase-end commit ritual step 9 (SHA written to Progress for phase N).

**Required sequence (no opt-out when linked):**

1. Parent skill completes phase commit and passes `SHA`.
2. This skill posts parent milestone comment (`phase-<N>-complete`).
3. This skill closes mapped child issue `phase_issues["N"]` (if present).

**Comment body template** — include phase title from plan, short SHA, and optional summary of what landed:

```markdown
## trAInR — phase-<N>-complete

**Change:** `<change-id>`
**Phase:** N — <phase title from plan>
**Commit:** `<short-sha>`

Phase automated (+ manual) verification complete in repo.
```

**Child phase issue close:**

- Read `phase_issues` from `change.md`.
- If mapping contains key `"<N>"`, call `save_issue` on that child issue and set state to a done-like status for that issue's team.
- If mapping is missing for this phase, keep parent comment sync and warn in one sentence.

### `decision-log`

**Trigger:** Parent skill detected a plan/reality mismatch and the user selected adaptation that changes scope/behavior/approach.

```markdown
## trAInR — decision-log

**Change:** `<change-id>`
**Phase:** `<N or n/a>`

**Expected:** <what plan expected>
**Found:** <what was discovered>
**Decision:** <what was chosen>
**Impact:** <scope/timeline/risk impact>
```

### `implementation-reviewed`

**Trigger:** Parent skill offered whole-change `/10x-impl-review` before PR creation and user chose **Yes**.

**Target issue:** parent `linear_issue`.

```markdown
## trAInR — implementation-reviewed

**Change:** `<change-id>`
**Review command:** `/10x-impl-review <change-id>`

**Findings summary:**

- <top cross-phase finding or "no blocking issues found">
- <second key finding if present>

**Action:** <fixes applied or follow-up decision>
```

### `implemented`

**Trigger:** After epilogue commit and `change.md` `status: implemented`.

```markdown
## trAInR — implemented

**Change:** `<change-id>`
**Plan:** `context/changes/<change-id>/plan.md` (all Progress items complete)

All plan phases implemented in repo. Run `/10x-impl-review` if not done yet, then open a PR; PR hook may move this issue to In Review.
```

## Commit `Refs:` line

When `linear_issue` is set in `change.md`, parent skills should add to commit bodies:

```text
Refs: ZAW-42
```

Use the exact identifier from frontmatter. Do not invent IDs from change-id.

## Related

| Skill / hook                                         | Role                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [linear-mcp](../linear-mcp/SKILL.md)                 | MCP tool reference                                                                              |
| [start-linear-issue](../start-linear-issue/SKILL.md) | Explicit branch + In Progress (user-invoked only)                                               |
| `.cursor/hooks/pr-linear-sync.cjs`                   | PR create → In Review + PR comment; PR merge follow-up can finalize Done transitions            |
| Planning / implement                                 | Parent skills call this at milestones (`linear_issue`; `phase_issues` optional but recommended) |

## Troubleshooting

| Symptom             | Action                                                   |
| ------------------- | -------------------------------------------------------- |
| MCP auth error      | Reconnect Linear plugin; see linear-mcp                  |
| Invalid state name  | `list_issue_statuses` for team                           |
| Duplicate comments  | Check `## trAInR —` heading; idempotency should skip     |
| Wrong issue updated | User must set `linear_issue` in `change.md`; never infer |
