---
name: github-mcp
description: >-
  Use GitHub MCP tools for trAInR project workflows: issues, PRs, CI checks,
  code search, and releases on ZawilecxD/trAInR. Use when the user asks to
  interact with GitHub, create issues, open PRs, check CI status, triage bugs,
  review code changes, search code, or manage releases.
---

# GitHub MCP Workflows

## Project context

- Owner: `ZawilecxD`
- Repo: `trAInR`
- Default branch: `master`
- CI workflow: `.github/workflows/ci.yml` (lint → build → Vercel deploy)

Always pass `owner=ZawilecxD` and `repo=trAInR` to every MCP tool call.

## Issues

- Title: lowercase imperative, matching commit conventions (e.g. `add RLS policy for plans table`)
- Apply labels when available (`bug`, `enhancement`, etc.)
- Link to relevant files or routes in the body when helpful

## Pull requests

- Target branch: `master`
- PR body format:
  ```
  ## Summary
  <1-3 bullet points>

  ## Test plan
  <checklist of what to verify>
  ```
- After creating a PR, remind the user that the CI gate (lint + build) must pass before merge.

## CI / Actions

- On a CI failure, call `get_job_logs` with `failed_only=true` and the `run_id`
- Report: which step failed, the relevant log lines, and a suggested fix
- The `actions` toolset is opt-in — if the tool is unavailable, refer the user to `docs/github-mcp-setup.md` to check PAT scopes

## Code search

- Use `search_code` for cross-file symbol or pattern lookups
- Always scope: `owner:ZawilecxD repo:trAInR`

## Releases

- Follow semver (`v0.x.y` for pre-1.0)
- Tag on `master` after CI passes

## Toolset notes

Default toolsets active with the project config: `context`, `repos`, `issues`, `pull_requests`, `users`.

If a tool call returns "not available":
1. The required toolset may be opt-in (see `docs/github-mcp-setup.md` for the full list)
2. The PAT may lack the needed scope — check the tool's required OAuth scope in the MCP server docs
