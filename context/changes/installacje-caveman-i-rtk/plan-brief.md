# Install opt-in caveman and RTK token-saving workflow - Plan Brief

> Full plan: `context/changes/installacje-caveman-i-rtk/plan.md`

## What & Why

`ZAW-39` optimizes AI-agent token usage without changing product behavior. The work documents an opt-in caveman communication workflow and a verifiable RTK CLI setup so agents can reduce context usage during repo work.

## Starting Point

Caveman already exists as a user-level skill, and the repo already uses `AGENTS.md` plus `context/changes/` for agent workflows. RTK is external tooling from `https://github.com/rtk-ai/rtk`; it is not yet documented in this repo.

## Desired End State

Future agents and humans can find a short token-efficiency guide, decide when compression is appropriate, verify RTK with `rtk gain`, and recover from wrong installs. Linear `ZAW-39` links the repo plan and uses the same acceptance criteria.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| RTK meaning | `https://github.com/rtk-ai/rtk` | User clarified RTK is the token-saving CLI, not Redux Toolkit. |
| Caveman scope | Opt-in workflow | Compression saves tokens but should not become the default repo voice. |
| Artifact scope | Repo plan plus Linear sync | Repo keeps implementation detail; Linear keeps tracker visibility. |
| Done criteria | Workflow, docs, commands, checks | The value is repeatability, not blind installation. |
| RTK verification | Require `rtk gain` | Public RTK docs warn about a package-name collision with another `rtk`. |

## Scope

**In scope:**

- Add `docs/token-efficiency.md`.
- Link the guide from `AGENTS.md` and `README.md`.
- Document caveman as opt-in.
- Document RTK install, verification, and troubleshooting.
- Sync plan pointers and acceptance checklist to Linear `ZAW-39`.

**Out of scope:**

- Product-code changes.
- Redux Toolkit installation.
- Making caveman the project default.
- Committing user-global shell or RTK hook state.

## Architecture / Approach

This is a documentation and local-tooling workflow change. The repo should describe the workflow and verification commands; each developer decides whether to install RTK locally. RTK checks must distinguish correct RTK Token Killer from the unrelated Rust Type Kit package.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Add Token-Efficiency Workflow Doc | Canonical guide for caveman + RTK | Wrong RTK install path or unclear verification. |
| 2. Wire into Agent Onboarding | Discoverable links in `AGENTS.md` and `README.md` | Overloading hard rules with optional workflow detail. |
| 3. Sync Linear and Verify | Tracker links, acceptance checklist, local smoke check | Global RTK install may require explicit human approval. |

**Prerequisites:** No app prerequisites. Network access is needed only if installing RTK.

**Estimated effort:** One short implementation session across three phases.

## Open Risks & Assumptions

- RTK hook support may vary by AI tool and OS; the guide should prefer manual verification over assuming auto-rewrite works.
- If RTK is missing locally, installation should stop for user approval because it changes machine-level tooling.
- Public RTK docs may change; source links should stay in the guide for refresh.

## Success Criteria Summary

- `docs/token-efficiency.md` exists and explains caveman, RTK install, `rtk gain`, and troubleshooting.
- `AGENTS.md` and `README.md` link to the guide without making token compression mandatory.
- Linear `ZAW-39` links `change.md`, `plan.md`, and `plan-brief.md` with matching acceptance criteria.
