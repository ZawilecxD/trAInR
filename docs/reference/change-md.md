# change.md schema

Identity file for a unit of work under `context/changes/<change-id>/` or `context/archive/<change-id>/`.

## Frontmatter

```yaml
---
change_id: <kebab-case>      # required; matches folder name
title: <human title>         # required
status: <status>             # required; see below
created: YYYY-MM-DD          # required
updated: YYYY-MM-DD          # required
archived_at: null | YYYY-MM-DD
linear_issue: ZAW-42         # optional; links Linear sync (see .cursor/skills/linear-sync/SKILL.md)
phase_issues:                # optional; phase -> Linear child issue mapping
  "1": ZAW-101
  "2": ZAW-102
---
```

### `linear_issue` (optional)

- Linear identifier (e.g. `ZAW-42`) for the issue tracking this change.
- When set, planning and implement skills may post milestone comments and move status per [linear-sync](../../.cursor/skills/linear-sync/SKILL.md).
- Omit when the change is not tracked in Linear.
- Set at `/10x-new` time, edit manually, or pass `ZAW-N` in the same message as `/10x-plan` / `/10x-implement` (agent should persist to `change.md` if missing).

### `phase_issues` (optional)

- Mapping of plan phase numbers to Linear child issue identifiers.
- Keys are stringified phase numbers from `plan.md` headings (`"1"`, `"2"`, ...).
- Values are Linear issue identifiers (e.g. `ZAW-101`), typically child issues of `linear_issue`.
- Usually authored by `/10x-plan` when `linear_issue` is present; consumed by `/10x-implement` + `linear-sync` to close phase child issues on `phase-<N>-complete`.

### `status` values (record-only)

Typical flow: `new` → `planned` → `plan_reviewed` → `implementing` → `implemented` → archived.

Skills update `status` and `updated`; they do not enforce a state machine in code.

## Body

Free-form `## Notes` — links, decisions, context not belonging in research/frame/plan.

## What is not in change.md

- Execution checkboxes (live in `plan.md` → `## Progress` only)
- Plan content (see `plan.md`)
