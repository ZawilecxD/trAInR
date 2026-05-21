# Repository Guidelines

trAInR is an Astro 6 SSR application with React 19 islands, Tailwind CSS 4, Supabase auth, and shadcn/ui components, deployed to Cloudflare Workers via `@astrojs/cloudflare`.

## Hard Rules

- Never commit `.env` or `.dev.vars` — secrets go in those files locally, in Cloudflare dashboard or GitHub repository secrets for prod/CI.
- Never use Next.js directives (`"use client"`, `"use server"`) — this is Astro, not Next.
- Do not concatenate Tailwind class strings manually; always use `cn()` from `@/lib/utils`.
- Every new Supabase table must have RLS enabled with granular per-operation, per-role policies.
- API route files must export `const prerender = false`.

## Build, Test, and Development Commands

- `npm run dev` — local dev server (Cloudflare workerd runtime)
- `npm run build` — production build
- `npm run lint` — ESLint with type-checked rules (CI gate)
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (astro + tailwindcss plugins)

Pre-commit hook (husky + lint-staged) runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}` automatically.

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

## Coding Conventions

- Astro components for static content/layout; React only when interactivity is needed.
- shadcn/ui components: install via `npx shadcn@latest add [name]`, live in `src/components/ui/`.
- API routes: uppercase `GET`/`POST` exports, validate input with zod.
- Services and helpers in `src/lib/` (or `src/lib/services/` for business logic).
- TypeScript strict mode (extends `astro/tsconfigs/strict`).

## CI Gate

GitHub Actions (`.github/workflows/ci.yml`) runs `npm run lint` then `npm run build` on every push/PR to `master`. Both must pass. Requires `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets.

## Commit Conventions

Use short, lowercase, descriptive messages (observed style: `npm audit fix`, `project structure generated`). No enforced prefix schema yet — keep messages concise and meaningful.

## Environment

- Node.js v22.14.0 (see `.nvmrc`)
- Copy `.env.example` to `.env` (Node) or `.dev.vars` (Cloudflare local dev)
- Local Supabase: `npx supabase start` (requires Docker)
- Deploy: `npx wrangler deploy`

For full setup details see @README.md. For architecture depth see @CLAUDE.md.
