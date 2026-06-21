# Repository Guidelines

trAInR is an Astro 6 SSR application with React 19 islands, Tailwind CSS 4, Supabase auth, and shadcn/ui components, deployed to Vercel via `@astrojs/vercel`.

## Hard Rules

- Never commit `.env` or Vercel secrets — secrets go in `.env` locally, in Vercel Dashboard (Environment Variables) or GitHub repository secrets for prod/CI.
- Never use Next.js directives (`"use client"`, `"use server"`) — this is Astro, not Next.
- Do not concatenate Tailwind class strings manually; always use `cn()` from `@/lib/utils`.
- Every new Supabase table must have RLS enabled with granular per-operation, per-role policies.
- API route files must export `const prerender = false`.
- Supabase migrations use naming format `YYYYMMDDHHmmss_short_description.sql`.
- Extract React hooks to `src/components/hooks/`.

## Build, Test, and Development Commands

- `npm run dev` — local dev server (Node.js, standard Vite)
- `npm run build` — production build (SSR via `@astrojs/vercel`, outputs to `.vercel/output/`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules (CI gate)
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (prettier-plugin-astro + prettier-plugin-tailwindcss)

Pre-commit hook (husky + lint-staged) runs `eslint --fix` on `*.{ts,tsx,astro}`, related Vitest tests on staged `*.{ts,tsx}` via `scripts/vitest-staged.cjs`, and `prettier --write` on `*.{json,css,md}` automatically.

## Project Structure

```
src/
├── components/       # Astro + React components
│   ├── ui/           # shadcn/ui (new-york variant)
│   └── hooks/        # React hooks
├── layouts/          # Astro layouts
├── lib/              # Helpers, services, Supabase client
├── pages/            # Astro pages + API routes (pages/api/)
├── styles/           # Global CSS
└── types.ts          # Shared types/DTOs
supabase/migrations/  # SQL migrations (YYYYMMDDHHmmss_description.sql)
```

Path alias: `@/*` → `./src/*`.

## Architecture

Full SSR (`output: "server"` in astro.config.mjs). Auth uses `@supabase/ssr` with cookie-based sessions:

- `src/lib/supabase.ts` — SSR client; secrets via `astro:env/server` (declared in astro.config.mjs `env.schema`).
- `src/middleware.ts` — resolves user, attaches to `context.locals.user`, redirects unauthenticated users per `PROTECTED_ROUTES`.
- Endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Pages: `src/pages/auth/{signin,signup,confirm-email}.astro`

## Coding Conventions

- Astro for static content/layout; React only for interactivity.
- shadcn/ui: `npx shadcn@latest add [name]`, lives in `src/components/ui/`.
- API routes: uppercase `GET`/`POST` exports, validate with zod.
- Services in `src/lib/` (or `src/lib/services/`). Shared types in `src/types.ts`.
- TypeScript strict mode (`astro/tsconfigs/strict`).

## CI Gate

GitHub Actions (`.github/workflows/ci.yml`) runs `npm run lint` then `npm run build` on every push/PR to `master`. Both must pass. On success, deploys to Vercel: preview deploy on PRs, production deploy on master push. Requires `SUPABASE_URL`, `SUPABASE_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as repository secrets.

## Commit Conventions

Use lowercase imperative messages under 72 characters (e.g. `fix auth redirect on signout`, `add RLS policy for profiles table`). No enforced prefix schema yet.

## Environment

- Node.js v22.14.0 (see `.nvmrc`)
- Copy `.env.example` to `.env` for local development
- Local Supabase: `npx supabase start` (requires Docker)
- Deploy: `npx vercel deploy --prod` (requires Vercel account + `vercel login`)

For full setup details see @README.md.

## Developer Tools

- **GitHub MCP**: Cursor agents can interact with GitHub (issues, PRs, repos, code search, CI) via the GitHub-hosted remote MCP server. Setup: `docs/github-mcp-setup.md`. Config lives at `.cursor/mcp.json` (local, gitignored — never commit).
- Token env var: `GITHUB_PERSONAL_ACCESS_TOKEN` — export in shell profile, never commit.
- Skill for common trAInR workflows: `.cursor/skills/github-mcp/SKILL.md`.
- **Exa MCP**: Cursor agents can search the web and fetch pages via Exa's hosted MCP server (OAuth on first connect; optional `EXA_API_KEY` for rate limits). Setup: `docs/exa-mcp-setup.md`. Skill: `.cursor/skills/exa-mcp/SKILL.md`.
- **Linear MCP**: Cursor agents can manage issues, projects, cycles, and docs via the Linear plugin (`plugins.linear` in `.cursor/settings.json`). OAuth through the plugin — no repo token. Skills: `.cursor/skills/linear-mcp/SKILL.md`, `.cursor/skills/linear-sync/SKILL.md` (plan/implement milestones when `linear_issue` is set on `change.md`), `.cursor/skills/start-linear-issue/SKILL.md` (branch + In Progress when starting an issue — user-invoked only).
- **Token efficiency**: Optional agent token savings — caveman mode (opt-in per session) and RTK CLI for compressed command output. Guide: `docs/token-efficiency.md`. RTK is local-machine setup; verify with `rtk gain` after install.

## Lessons learned

See: `context/foundation/lessons.md`
