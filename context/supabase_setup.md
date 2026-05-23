# Supabase setup (trAInR)

Reference for configuring and using Supabase in this project. Supabase provides **authentication only** — no custom database tables or migrations are required for the starter auth flow.

## What Supabase does here

- Email/password sign-up and sign-in
- Cookie-based sessions via `@supabase/ssr` (SSR-safe, server-only)
- Route protection in middleware (`/dashboard` by default)
- Built-in `auth.users` table (managed by Supabase; no app migrations)

Auth is **disabled gracefully** when env vars are missing: API routes redirect with an error, and `context.locals.user` is `null`.

## Architecture

| Piece | Location | Role |
| ----- | -------- | ---- |
| Env schema | `astro.config.mjs` | Declares `SUPABASE_URL` and `SUPABASE_KEY` as server-only secrets |
| SSR client | `src/lib/supabase.ts` | `createServerClient()` with cookie read/write |
| Middleware | `src/middleware.ts` | Resolves user, protects `PROTECTED_ROUTES` |
| Auth API | `src/pages/api/auth/{signin,signup,signout}.ts` | Form POST handlers |
| Auth UI | `src/pages/auth/{signin,signup,confirm-email}.astro` | Sign-in/up forms |
| Config check | `src/lib/config-status.ts` | Surfaces missing Supabase config in UI |

Secrets are imported from `astro:env/server` — they are **never** exposed to the client bundle. See `CLAUDE.md` for Astro env notes.

## Environment variables

Copy `.env.example` to `.env` and set:

| Variable | Description |
| -------- | ----------- |
| `SUPABASE_URL` | Project API URL |
| `SUPABASE_KEY` | **anon** (public) key — not `service_role` |

Also configure the same variables for:

- **Local dev:** `.env` (Astro reads this via `astro:env`)
- **Vercel:** Project → Settings → Environment Variables
- **CI:** GitHub repository secrets (`SUPABASE_URL`, `SUPABASE_KEY`) — used during `npm run build` in `.github/workflows/ci.yml`

Never commit `.env` or paste secrets into the repo.

---

## Option A: Local Supabase (Docker)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create env file:

   ```bash
   cp .env.example .env
   ```

2. Initialize CLI config (creates `supabase/` if absent):

   ```bash
   npx supabase init
   ```

3. Start the local stack:

   ```bash
   npx supabase start
   ```

4. Copy credentials from CLI output into `.env`:

   ```env
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_KEY=<anon key from CLI output>
   ```

5. Optional: open local Studio at `http://localhost:54323`

6. Stop when done:

   ```bash
   npx supabase stop
   ```

Local auth redirect settings live in `supabase/config.toml` (`[auth]` → `site_url`, `additional_redirect_urls`). Email confirmation is **off** locally (`enable_confirmations = false`).

---

## Option B: Hosted Supabase (cloud project)

Use this when you have a project at [supabase.com/dashboard](https://supabase.com/dashboard).

### 1. Stop local stack (if running)

```bash
npx supabase stop
```

The `supabase/` folder can stay — it does not force the app to use local Supabase. The app follows **`.env`**, not Docker.

### 2. Set `.env` to cloud credentials

Dashboard → **Project Settings** → **API**:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon public key>
```

Replace any previous `http://127.0.0.1:54321` values.

### 3. Configure Auth in the dashboard

Hosted projects ignore local `config.toml` for redirects. In the Supabase dashboard:

1. **Authentication** → **URL Configuration**
   - **Site URL:** `http://localhost:4321` (Astro default dev port)
   - **Redirect URLs:** add `http://localhost:4321/**`
2. For production, add your Vercel URL (e.g. `https://<app>.vercel.app/**`).

### 4. Email confirmation (recommended for local dev)

**Authentication** → **Providers** → **Email** → turn **Confirm email** **off** for easier testing.

With confirmation on, users must click the email link before sign-in works.

### 5. (Optional) Link CLI to remote

For future schema work / migrations:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
```

`<project-ref>` is the subdomain in your project URL.

### 6. No migrations required

There are no files in `supabase/migrations/` for this starter. Auth uses Supabase’s built-in `auth.users` only — skip `db push` until you add custom tables.

---

## Auth routes

| Route | Description |
| ----- | ----------- |
| `/auth/signin` | Sign-in form |
| `/auth/signup` | Sign-up form |
| `/auth/confirm-email` | Post-signup “check your inbox” page |
| `/dashboard` | Example protected page (redirects to sign-in if unauthenticated) |

Add paths to `PROTECTED_ROUTES` in `src/middleware.ts` to require authentication elsewhere.

## API endpoints

| Method | Path | Action |
| ------ | ---- | ------ |
| `POST` | `/api/auth/signin` | `signInWithPassword` → redirect `/` |
| `POST` | `/api/auth/signup` | `signUp` → redirect `/auth/confirm-email` |
| `POST` | `/api/auth/signout` | `signOut` → redirect `/` |

All API route files must export `const prerender = false` when added (project convention for SSR endpoints).

## Verify setup

1. Restart dev server after changing `.env`:

   ```bash
   npm run dev
   ```

2. Visit `/auth/signup`, create a user, then `/auth/signin` and `/dashboard`.

3. Confirm the user appears under **Authentication** → **Users** in the Supabase dashboard (hosted) or local Studio.

## Local vs hosted quick reference

| | Local (`supabase start`) | Hosted (cloud) |
| --- | --- | --- |
| `SUPABASE_URL` | `http://127.0.0.1:54321` | `https://<ref>.supabase.co` |
| `SUPABASE_KEY` | anon key from CLI | anon key from dashboard |
| Auth redirect config | `supabase/config.toml` | Supabase dashboard |
| Docker | Required | Not required |
| Studio | `http://localhost:54323` | Dashboard UI |

## Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| “Supabase is not configured” | Missing/empty env vars | Set `SUPABASE_URL` and `SUPABASE_KEY` in `.env`, restart dev server |
| Still talking to local Supabase | `.env` has `127.0.0.1:54321` | Switch to cloud URL and anon key |
| Sign-in fails after signup | Email confirmation enabled | Disable in dashboard or confirm via email |
| Redirect / auth errors | Wrong Site URL or Redirect URLs | Use `http://localhost:4321` and `http://localhost:4321/**` for local dev |
| Build fails in CI | Missing GitHub secrets | Add `SUPABASE_URL` and `SUPABASE_KEY` repository secrets |

## Related docs

- `README.md` — high-level Supabase section (note: README still mentions Cloudflare/`.dev.vars`; this project deploys to **Vercel** and uses **`.env`**)
- `AGENTS.md` — agent rules (RLS required for new tables, migration naming, SSR auth pattern)
- [Supabase Auth docs](https://supabase.com/docs/guides/auth)
- [Supabase CLI local development](https://supabase.com/docs/guides/local-development)
