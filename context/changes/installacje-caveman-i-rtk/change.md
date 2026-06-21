---
change_id: installacje-caveman-i-rtk
title: Install opt-in caveman and RTK token-saving workflow
status: implementing
created: 2026-06-20
updated: 2026-06-21
archived_at: null
linear_issue: ZAW-39
---

## Notes

Linear: https://linear.app/zawilecxd/issue/ZAW-39/instalacje-caveman-i-rtk

Goal: optimize AI-agent token usage by documenting an opt-in caveman communication mode and a verifiable RTK CLI workflow.

User decisions:

- RTK means `https://github.com/rtk-ai/rtk`.
- Planning artifacts should live in the repo and be synced back to Linear.
- Caveman should remain opt-in, not a project default.
- Done means a repeatable workflow with docs, commands, and acceptance checks.

## RTK smoke check (phase 3)

- `rtk --version` → `rtk 0.39.0`
- `rtk gain` → token savings dashboard (correct Token Killer; ~60% saved globally)
- `which rtk` → `~/.local/bin/rtk`
- RTK already installed; no global install performed.
