---
name: exa-mcp
description: >-
  Use Exa MCP tools for real-time web research: search the web, fetch page
  content, and run advanced filtered searches. Use when the user asks about
  external docs, current events, library versions, API behavior outside the
  repo, competitive research, or anything not answerable from the codebase
  alone.
---

# Exa MCP Workflows

## When to use Exa vs other tools

| Need | Tool |
|------|------|
| Code in this repo | Grep, Read, codebase search — not Exa |
| GitHub issues/PRs/CI | GitHub MCP — not Exa |
| Linear issues/roadmap | Linear MCP — not Exa |
| Current web docs, releases, news, external APIs | **Exa MCP** |
| Known URL content | `web_fetch_exa` |
| Broad topic research | `web_search_exa` |
| Filtered search (domain, date, category) | `web_search_advanced_exa` |

Prefer Exa over built-in `WebSearch` when Exa MCP is connected — Exa returns cleaner, citation-ready content.

## Tool selection

**Default pair** (enabled without `tools=` param):

- `web_search_exa` — general queries; start here
- `web_fetch_exa` — when the user provides a URL or you need full page text

**Advanced** (enabled in this project's MCP URL):

- `web_search_advanced_exa` — domain/date/category filters, company/news/people categories

Do not use deprecated tools (`get_code_context_exa`, `company_research_exa`, `crawling_exa`, etc.).

## Workflow

1. Check MCP tool descriptors under the `exa` server before calling (schema varies by tool).
2. Start with `web_search_exa` unless filters are required.
3. Use `web_fetch_exa` to pull full content from a specific result URL.
4. Cite sources with URLs in the response.
5. Cross-check critical facts with a second query if results conflict.

## Advanced search notes

- `category: "company"` — do not combine with domain or date filters (400 errors).
- `includeText` / `excludeText` — single-item arrays only.
- For LinkedIn-style people lookup: `category: "people"`, no extra filters.

## If tools are unavailable

1. Confirm `exa` is green in **Settings → MCP**
2. Restart Cursor after config changes
3. See `docs/exa-mcp-setup.md` for OAuth, API key, and `tools=` URL options
