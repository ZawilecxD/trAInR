# Vercel Setup

Summarizes how Vercel is configured in this project, how the CI/CD flow works, and what to do when continuing development.

---

## What was done

The project was migrated from Cloudflare Workers (`@astrojs/cloudflare` + Wrangler) to Vercel (`@astrojs/vercel`). Changes made:

- `astro.config.mjs` — adapter swapped to `@astrojs/vercel`
- `package.json` — `@astrojs/cloudflare` and `wrangler` removed, `@astrojs/vercel` added
- `.github/workflows/ci.yml` — deploy steps added (preview on PR, production on master push)
- `.gitignore` — Cloudflare entries replaced with `.vercel/`
- `wrangler.jsonc` — deleted

---

## Vercel project

The project was linked via `vercel link`. Project metadata lives in `.vercel/repo.json` (gitignored):

- **Project name:** `tr-a-in-r`
- **Project ID:** `prj_0eeCL92XP14Pyi5mDwsclrWZctif`
- **Org ID:** `team_WceflVqXGTp5gkXucSsty62M`

Dashboard: [vercel.com/dashboard](https://vercel.com/dashboard) → select `tr-a-in-r`.

---

## How CI/CD works

Every push or PR to `master` triggers `.github/workflows/ci.yml`:

```
npm ci → astro sync → lint → build → deploy
```

- **PR opened/updated** → `vercel deploy --prebuilt` → generates a unique preview URL (e.g. `tr-a-in-r-git-branch-name.vercel.app`)
- **Push to master** → `vercel deploy --prebuilt --prod` → updates production

The `--prebuilt` flag means `npm run build` runs once locally in CI (output goes to `.vercel/output/`), and that exact artifact is uploaded to Vercel — no second build on Vercel's servers.

---

## Required GitHub secrets

These must be set in GitHub → repository Settings → Secrets → Actions:

| Secret | Value |
|---|---|
| `VERCEL_TOKEN` | Token from vercel.com/account/tokens |
| `VERCEL_ORG_ID` | `team_WceflVqXGTp5gkXucSsty62M` |
| `VERCEL_PROJECT_ID` | `prj_0eeCL92XP14Pyi5mDwsclrWZctif` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon key |

---

## Required Vercel environment variables

Set in Vercel Dashboard → project → Settings → Environment Variables (scope: Production + Preview + Development):

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon key |

These are accessed at runtime via `astro:env/server` — they are server-only secrets and never exposed to the client.

---

## Local development

```bash
cp .env.example .env          # add SUPABASE_URL and SUPABASE_KEY
npm run dev                   # starts Vite dev server on Node.js (no wrangler needed)
```

To sync Vercel env vars to local `.env`:
```bash
vercel env pull .env.local    # pulls Production vars — review before using locally
```

---

## Deploying manually

```bash
npm run build                 # builds to .vercel/output/
vercel deploy --prebuilt --prod   # deploys to production
```

Or without pre-building (Vercel builds on its servers):
```bash
vercel deploy --prod
```

---

## Rolling back

```bash
vercel rollback               # reverts to the previous deploy (Hobby: one version back only)
```

For older versions: find the target commit in git, push it to master, or `git revert` + push.

---

## Hobby plan limits to watch

| Resource | Limit |
|---|---|
| Function invocations | 1M / month |
| Bandwidth | 100 GB / month |
| CPU time | 4 hours / month |

Exceeding any limit **pauses the project** until the billing period resets (no graceful degradation). Monitor usage in the Vercel Dashboard. Upgrade to Pro ($20/mo) before any public traffic push.

---

## Supabase OAuth and preview deploys

Each PR preview gets a unique URL like `tr-a-in-r-<hash>.vercel.app`. For auth redirects to work on preview deploys, Supabase must allow those URLs.

In Supabase Dashboard → Authentication → URL Configuration, add a wildcard:
```
https://tr-a-in-r-*.vercel.app/api/auth/callback
```

Production redirect URL:
```
https://tr-a-in-r.vercel.app/api/auth/callback
```
