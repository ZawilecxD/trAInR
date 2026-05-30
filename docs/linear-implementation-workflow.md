# Linear Implementation Workflow

This workflow keeps roadmap implementation synchronized with Linear across planning, phases, review, and PR delivery.

## What You Do

1. Start issue work:

```bash
start-linear-issue ZAW-123
```

2. Plan the change (with a linked parent issue):

```bash
/10x-plan <change-id> ZAW-123
```

3. Implement phase-by-phase:

```bash
/10x-implement <change-id> phase 1
```

4. When a phase completes, choose how to proceed:
   - **Continue to next phase** — stay in context and keep implementing.
   - **Clear context first** — copy the resume command and start fresh for the next phase.

5. After all phases, run implementation review (recommended), then create and merge the PR:
   - When asked, answer **Yes** or **No** to `/10x-impl-review` for the **whole change** (all phases).
   - **Yes** → review runs against the full plan; summary syncs to the parent Linear issue.
   - **No** → skip review and proceed to PR creation.
   - Open the PR only after this review step (run or skip).

## What Happens Automatically

- `start-linear-issue` creates/checks out branch and moves parent issue to **In Progress**.
- During planning (when `linear_issue` is present):
  - one child issue per plan phase is created,
  - mapping is stored in `change.md` as:

```yaml
linear_issue: ZAW-123
phase_issues:
  "1": ZAW-124
  "2": ZAW-125
```

- During implementation:
  - `implement-started` sync runs automatically.
  - Each phase completion enforces:
    1. commit phase changes,
    2. comment progress on parent issue,
    3. close mapped phase child issue.
  - If implementation adapts from plan, a `decision-log` comment is posted.

- After all phases (before PR):
  - optional whole-change review summary is posted to the parent issue when `/10x-impl-review` runs.

- PR lifecycle:
  - PR create flow syncs parent issue to **In Review**.
  - PR merge follow-up flow prompts/handles parent + remaining phase issue completion to **Done**.

## Notes

- If `linear_issue` is missing in `change.md`, Linear sync steps are skipped.
- `phase_issues` is optional but recommended for per-phase ownership and tracking.
- Per-phase `/10x-impl-review` is not part of this workflow — review once for the full change, immediately before opening a PR.
