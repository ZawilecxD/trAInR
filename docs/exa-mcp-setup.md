# Exa MCP Setup

Connects Cursor agents to Exa's hosted MCP server for real-time web search and page fetches when answering questions that need current or external information.

**Canonical reference:** [docs.exa.ai/reference/exa-mcp](https://docs.exa.ai/reference/exa-mcp)

## Prerequisites

- Cursor v0.48 or later (Streamable HTTP transport)
- Exa account (OAuth on first connect) — optional API key for higher rate limits

## 1. Copy the config

```bash
cp .cursor/mcp.json.example .cursor/mcp.json
```

If you already have `.cursor/mcp.json` (e.g. for GitHub MCP), merge the `exa` block from the example. The file is gitignored and stays local.

Default URL enables all non-deprecated tools:

```
https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa,web_search_advanced_exa
```

Minimal config (default tools only — search + fetch):

```json
{
  "mcpServers": {
    "exa": {
      "url": "https://mcp.exa.ai/mcp"
    }
  }
}
```

## 2. Authenticate

**OAuth (default):** On first connection, Cursor opens a browser to sign in to your Exa account. No API key required for the free tier. Manage your account at [dashboard.exa.ai](https://dashboard.exa.ai).

**Optional API key** (production use, higher rate limits): get a key at [dashboard.exa.ai/api-keys](https://dashboard.exa.ai/api-keys), then add a header:

```json
{
  "mcpServers": {
    "exa": {
      "url": "https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa,web_search_advanced_exa",
      "headers": {
        "x-api-key": "${env:EXA_API_KEY}"
      }
    }
  }
}
```

Export in `~/.bashrc` (or launch Cursor from a terminal where the var is set):

```bash
export EXA_API_KEY="..."
```

## 3. Verify

1. **Fully restart Cursor** (quit and reopen — reload is not enough)
2. Open **Settings → Tools & Integrations → MCP**
3. Confirm `exa` shows a green status dot
4. In Agent chat, test: _"Search the web for Astro 6 SSR release notes"_

## Available tools

| Tool                      | Default | Use for                                                         |
| ------------------------- | ------- | --------------------------------------------------------------- |
| `web_search_exa`          | yes     | General web search; clean, ready-to-use content                 |
| `web_fetch_exa`           | yes     | Full content from a known URL                                   |
| `web_search_advanced_exa` | no\*    | Filters, domains, dates, categories — opt-in via `tools=` param |

\* Enabled in this project's example config via the `tools=` query parameter.

Deprecated tools (`get_code_context_exa`, `company_research_exa`, etc.) remain on the server for backwards compatibility — prefer the replacements above.

## Tool selection via URL

Append a `tools=` query param to the MCP URL:

```
https://mcp.exa.ai/mcp?tools=web_search_advanced_exa
```

Enable all non-deprecated tools (project default):

```
https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa,web_search_advanced_exa
```

## Troubleshooting

| Symptom                  | Fix                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------- |
| MCP not loading          | Restart Cursor; validate JSON in `.cursor/mcp.json`                                     |
| OAuth / auth failure     | Complete browser sign-in; or add `x-api-key` header with a valid key                    |
| Tools not visible        | Toggle MCP on in Settings; inspect **Output → MCP Logs**                                |
| Rate limits on free tier | Add your own API key via header or `exaApiKey` query param                              |
| Wrong config picked up   | Both `~/.cursor/mcp.json` (global) and `.cursor/mcp.json` (workspace) load — check both |

## Security notes

- Never commit `.cursor/mcp.json` — it may contain API keys and is gitignored.
- Use OAuth for personal dev; use a dedicated API key only when you need higher limits.
- Rotate API keys periodically at [dashboard.exa.ai/api-keys](https://dashboard.exa.ai/api-keys).

## Agent skill

For when to use Exa vs codebase research, see `.cursor/skills/exa-mcp/SKILL.md`.
