# GitHub MCP Setup

Connects Cursor agents to GitHub (issues, PRs, code search, CI checks) for the `ZawilecxD/trAInR` repo via GitHub's hosted remote MCP server.

## Prerequisites

- Cursor v0.48 or later (required for Streamable HTTP transport)
- GitHub account with access to `ZawilecxD/trAInR`

## 1. Create a GitHub Personal Access Token

Use a **fine-grained PAT** (recommended):

1. Go to [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
2. Name: `Cursor MCP – trAInR`
3. Resource owner: `ZawilecxD`
4. Repository access: **Only selected repositories** → `trAInR`
5. Permissions:
   - Contents: **Read**
   - Issues: **Read and write**
   - Pull requests: **Read and write**
6. Generate token and copy it immediately

**Classic PAT fallback**: `repo` scope (required for private repos).

**Optional later**: add `workflow` permission/scope to enable the `actions` toolset (inspect CI runs, fetch job logs).

## 2. Export the token in your shell

Remote MCP servers in Cursor use `${env:...}` interpolation — they **do not** support `envFile`. The variable must be present in the environment Cursor inherits at launch.

Add to `~/.bashrc` (or `~/.profile`):

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_..."
```

Then **fully restart Cursor** (quit and reopen — a window reload is not enough).

Alternative: export the variable in a terminal session, then launch Cursor from that terminal with `cursor .`.

## 3. Copy the config

```bash
cp .cursor/mcp.json.example .cursor/mcp.json
```

The `.cursor/mcp.json` file is gitignored and stays local. Never commit it.

## 4. Verify

1. Restart Cursor completely
2. Open **Settings → Tools & Integrations → MCP**
3. Confirm `github` shows a green status dot
4. In Agent chat, test: *"List open issues in ZawilecxD/trAInR"*

## Available toolsets

The remote server exposes these toolset groups. Default toolsets are active with no extra config.

| Toolset | Default | Capabilities |
|---------|---------|-------------|
| `context` | yes | Current user and GitHub context |
| `repos` | yes | Repository browsing, file contents, commits |
| `issues` | yes | List, create, update issues |
| `pull_requests` | yes | List, create, review PRs |
| `users` | yes | User info lookups |
| `actions` | no | Workflow runs, job logs, CI status |
| `code_security` | no | Code scanning alerts |
| `discussions` | no | GitHub Discussions |
| `labels` | no | Label management |
| `notifications` | no | GitHub Notifications |
| `projects` | no | GitHub Projects |
| `dependabot` | no | Dependabot alerts |
| `git` | no | Low-level Git API operations |
| `secret_protection` | no | Secret scanning |
| `orgs` | no | Organization tools |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| MCP not loading | Restart Cursor; validate JSON in `.cursor/mcp.json` |
| 401 / authentication failure | Regenerate PAT; confirm scopes; confirm env var is visible to Cursor (launch from terminal with the var exported) |
| Streamable HTTP error | Update Cursor to v0.48+ |
| Tools not visible | Toggle MCP on in Settings; inspect **Output → MCP Logs** |
| Wrong repo access | Fine-grained PAT must include `ZawilecxD/trAInR` in repository access |
| Tool returns "not available" | The required toolset is opt-in; PAT may also need additional scopes |

## Security notes

- Never commit `.cursor/mcp.json` — it contains your PAT and is gitignored.
- Use the minimum PAT permissions needed; expand only when a specific tool requires it.
- Rotate the PAT periodically.
- Use separate PATs for different projects or environments.
