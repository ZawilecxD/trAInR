# Install opt-in caveman and RTK token-saving workflow Implementation Plan

## Overview

This plan turns `ZAW-39` into a repeatable token-saving workflow for this repo. It documents when to use the existing caveman compression skill, how to install and verify RTK from `rtk-ai/rtk`, and how agents should prove the workflow is ready without making compressed responses the project default.

## Current State Analysis

The repo already has strong agent-onboarding conventions in `AGENTS.md`, change planning under `context/changes/`, and token-cost guidance in the E2E skill that prefers lower-context transports where possible. Caveman exists as a user-level skill at `/home/zawilecxd/.agents/skills/caveman/SKILL.md`, but the repo does not yet document it as an opt-in workflow. RTK is not installed or configured by this plan yet; public RTK docs describe it as a CLI proxy that reduces LLM command-output token usage by filtering common dev-command output before it reaches the model.

## Desired End State

A future agent or human can read a short repo doc, decide whether token-compression mode is appropriate, install or verify RTK safely, and run checks that prove the correct RTK binary is in use. Linear `ZAW-39` points at the repo plan and has acceptance criteria matching the workflow.

### Key Discoveries

- `AGENTS.md` already centralizes project rules and points agents at skill-based workflows.
- `/home/zawilecxd/.agents/skills/caveman/SKILL.md` defines caveman as opt-in compressed communication, with an explicit stop condition.
- `context/changes/` is the canonical home for change identity and plans.
- RTK has a name-collision risk: `rtk gain` must work, otherwise the installed binary may be the unrelated Rust Type Kit package.
- RTK Linux/macOS install options include `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh` and `cargo install --git https://github.com/rtk-ai/rtk`.

## What We're NOT Doing

- Making caveman mode the default for all repo conversations.
- Adding Redux Toolkit or any app state-management dependency.
- Rewriting product code for token optimization.
- Committing shell-specific global RTK hook state to the repo.
- Storing secrets, personal tokens, or generated local machine paths in tracked files.

## Implementation Approach

Add a repo-local token-efficiency guide and update the agent onboarding docs to point at it. Keep user-global setup steps explicit and verifiable: check whether `rtk` already exists, prove it is RTK Token Killer with `rtk gain`, then install only if needed using an upstream source that avoids the crate-name collision. Sync the final plan summary back to Linear so `ZAW-39` is actionable without opening the repo first.

## Phase 1: Add Token-Efficiency Workflow Doc

### Overview

Create a concise repo document that explains the opt-in workflow: when to use caveman, when to use RTK, how to verify both, and how to recover from wrong RTK installs.

### Changes Required

#### 1. Token-Efficiency Guide

**File**: `docs/token-efficiency.md`

**Intent**: Add one canonical guide for reducing AI-agent token usage during repo work. It should cover communication compression, command-output compression, and verification steps without changing project behavior by default.

**Contract**: The guide includes these sections:

- `## When to Use`
- `## Caveman Mode`
- `## RTK`
- `## Verification`
- `## Troubleshooting`
- `## Boundaries`

The RTK section must include pre-install checks before install commands:

- `rtk --version`
- `rtk gain`
- `which rtk`

The install section must prefer the upstream script or explicit git install:

- `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh`
- `cargo install --git https://github.com/rtk-ai/rtk`

#### 2. Source Links

**File**: `docs/token-efficiency.md`

**Intent**: Make the guide auditable and easy to refresh later.

**Contract**: Reference these public sources:

- `https://github.com/rtk-ai/rtk`
- `https://www.rtk-ai.app/docs/resources/troubleshooting/`

### Success Criteria

#### Automated Verification

- `docs/token-efficiency.md` exists.
- `rg "rtk gain|cargo install --git https://github.com/rtk-ai/rtk|caveman" docs/token-efficiency.md` returns matches.
- `npm run lint` passes.

#### Manual Verification

- Human can follow the guide from a clean shell and decide whether to install RTK.
- Human can tell the difference between correct RTK Token Killer and wrong `rtk` package by using `rtk gain`.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation that the doc is clear before continuing.

---

## Phase 2: Wire the Workflow into Agent Onboarding

### Overview

Expose the guide from the repo's existing agent entry points without bloating the hard rules.

### Changes Required

#### 1. AGENTS Reference

**File**: `AGENTS.md`

**Intent**: Add a short pointer to the token-efficiency guide near existing developer-tool guidance. Agents should know the workflow exists without being forced into compressed mode.

**Contract**: Add one small bullet under `## Developer Tools` or a similar existing section:

- Mention `docs/token-efficiency.md`.
- State caveman is opt-in.
- State RTK setup is local-machine setup and must be verified with `rtk gain`.

#### 2. README Reference

**File**: `README.md`

**Intent**: Make the workflow discoverable for humans who start from the project README.

**Contract**: Add a brief link in the setup, development, or tooling area. Keep it to one or two sentences; do not duplicate the full guide.

### Success Criteria

#### Automated Verification

- `rg "token-efficiency|rtk gain|caveman" AGENTS.md README.md` returns matches.
- `npm run lint` passes.

#### Manual Verification

- A new agent reading `AGENTS.md` can find the workflow.
- A human reading `README.md` can find RTK setup instructions without scanning `context/changes/`.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation that the links are visible but not noisy.

---

## Phase 3: Sync Linear and Verify the Workflow

### Overview

Update `ZAW-39` with the repo pointers and acceptance criteria, then verify the planned workflow on the local machine where possible.

### Changes Required

#### 1. Linear Description or Comment

**External**: Linear issue `ZAW-39`

**Intent**: Make the tracker issue actionable and self-contained.

**Contract**: Add a Linear comment with:

- Change folder: `context/changes/installacje-caveman-i-rtk/`
- Plan: `context/changes/installacje-caveman-i-rtk/plan.md`
- Brief: `context/changes/installacje-caveman-i-rtk/plan-brief.md`
- Acceptance checklist mirroring this plan.

#### 2. Local RTK Smoke Check

**External**: developer shell

**Intent**: Record whether RTK is already present and whether it is the correct binary.

**Contract**: Run these commands only as checks unless the human confirms installation:

- `rtk --version`
- `rtk gain`
- `which rtk`

If RTK is missing, document the expected install command but do not force global installation unless explicitly requested.

### Success Criteria

#### Automated Verification

- Linear `ZAW-39` contains a comment linking the plan and brief.
- `npm run lint` passes after doc edits.

#### Manual Verification

- User confirms whether to install RTK globally if it is missing.
- User confirms Linear acceptance criteria match the desired outcome.

**Implementation Note**: This phase may stop before global install if RTK is not present and the user has not approved machine-level setup.

---

## Testing Strategy

### Unit Tests

- No unit tests are required because this change is docs and local tooling guidance only.

### Integration Tests

- No application integration tests are required because no app behavior changes.

### Manual Testing Steps

1. Read `docs/token-efficiency.md` from top to bottom.
2. Run `rtk --version`, `rtk gain`, and `which rtk`.
3. Confirm the guide explains what to do for the observed result.
4. Open `AGENTS.md` and `README.md`; confirm both point to the guide.
5. Open Linear `ZAW-39`; confirm it links the plan and acceptance checklist.

## Performance Considerations

This change targets agent-context performance, not runtime app performance. RTK should only affect command-output shape before it enters agent context; it must not change repo scripts, command success/failure semantics, or CI behavior.

## Migration Notes

No data or application migration is needed. RTK setup is local-machine configuration; tracked docs should describe it, not encode one user's shell state.

## References

- Linear issue: `https://linear.app/zawilecxd/issue/ZAW-39/instalacje-caveman-i-rtk`
- RTK repository: `https://github.com/rtk-ai/rtk`
- RTK troubleshooting: `https://www.rtk-ai.app/docs/resources/troubleshooting/`
- Caveman skill: `/home/zawilecxd/.agents/skills/caveman/SKILL.md`
- Existing token-cost guidance: `.cursor/skills/10x-e2e/references/browser-driven-generation.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Add Token-Efficiency Workflow Doc

#### Automated

- [x] 1.1 `docs/token-efficiency.md` exists. — 1d50288
- [x] 1.2 `rg "rtk gain|cargo install --git https://github.com/rtk-ai/rtk|caveman" docs/token-efficiency.md` returns matches. — 1d50288
- [x] 1.3 `npm run lint` passes. — 1d50288

#### Manual

- [x] 1.4 Human can follow the guide from a clean shell and decide whether to install RTK. — 1d50288
- [x] 1.5 Human can tell the difference between correct RTK Token Killer and wrong `rtk` package by using `rtk gain`. — 1d50288

### Phase 2: Wire the Workflow into Agent Onboarding

#### Automated

- [x] 2.1 `rg "token-efficiency|rtk gain|caveman" AGENTS.md README.md` returns matches. — 1d50288
- [x] 2.2 `npm run lint` passes. — 1d50288

#### Manual

- [x] 2.3 A new agent reading `AGENTS.md` can find the workflow. — 1d50288
- [x] 2.4 A human reading `README.md` can find RTK setup instructions without scanning `context/changes/`. — 1d50288

### Phase 3: Sync Linear and Verify the Workflow

#### Automated

- [x] 3.1 Linear `ZAW-39` contains a comment linking the plan and brief. — 1d50288
- [x] 3.2 `npm run lint` passes after doc edits. — 1d50288

#### Manual

- [x] 3.3 User confirms whether to install RTK globally if it is missing. — 1d50288
- [x] 3.4 User confirms Linear acceptance criteria match the desired outcome. — 1d50288
