---
change_id: cursor-sdk-agent-code-review
title: Cursor SDK CI agent code review
status: planned
created: 2026-08-18
updated: 2026-08-18
archived_at: null
linear_issue: ZAW-59
---

## Notes

Plan integrating Cursor SDK for a CI agent code review per 10xDevs m5l2 (local scorer) and m5l3 (GHA composite action, PR comment, `ai-cr:*` labels).

Decided in planning: nested `packages/code-reviewer` (no workspaces); `@cursor/sdk` local runtime; advisory gate; six M5L3 criteria; title+diff only; retry on `ai-cr:review`; park promptfoo and extra tools.

Course seed: `.cursor/prompts/m5l3-requirements.md`
Lessons: m5l2, m5l3 under `/home/zawilecxd/Documents/10xdevs/lessons/`
