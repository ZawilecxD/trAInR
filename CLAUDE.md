# Rules for AI

All project rules, conventions, and architecture are in @AGENTS.md — read it first.

This file adds only Claude-specific guidance that doesn't apply to other AI tools.

## Claude-specific

- When using `astro:env/server` imports, note that `SUPABASE_URL` and `SUPABASE_KEY` are declared in astro.config.mjs `env.schema` as server-only secrets — they are not available client-side and will not appear in `import.meta.env`.
