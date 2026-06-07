---
project: trAInR
researched_at: 2026-05-22
recommended_platform: Vercel
runner_up: Cloudflare Workers
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6
  runtime: Node.js (Vercel serverless) — migrating from workerd
---

## Recommendation

**Deploy on Vercel.**

Vercel scores a perfect 5/5 on the agent-friendly platform criteria (CLI-first, managed/serverless, agent-readable docs, stable deploy API, MCP integration) and offers a generous Hobby free tier ($0 at 10k–100k req/mo). While the project is currently wired for Cloudflare Workers via `@astrojs/cloudflare`, the anti-bias cross-check on Cloudflare surfaced meaningful workerd runtime risks — the 10ms free-tier CPU cap, ecosystem gaps from non-Node APIs, and a class of "works in miniflare but not in production" bugs that are expensive to debug on a 3-week solo timeline. Vercel's full Node.js runtime eliminates these risks, its automatic PR preview deploys boost iteration speed (the DX priority from the interview), and the adapter swap to `@astrojs/vercel` is a scoped half-day task.

## Platform Comparison

| Platform       | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total        |
| -------------- | --------- | ------------------ | ------------------- | ----------------- | ----------------- | ------------ |
| **Vercel**     | Pass      | Pass               | Pass                | Pass              | Pass              | **5 Pass**   |
| **Cloudflare** | Pass      | Pass               | Pass                | Pass              | Pass              | **5 Pass**   |
| **Netlify**    | Partial   | Pass               | Pass                | Partial           | Pass              | **3P / 2Pt** |
| **Railway**    | Partial   | Partial            | Pass                | Partial           | Pass              | **2P / 3Pt** |
| **Render**     | Partial   | Partial            | Pass                | Partial           | Pass              | **2P / 3Pt** |
| **Fly.io**     | Partial   | Partial            | Partial             | Partial           | Partial           | **0P / 5Pt** |

### Shortlisted Platforms

#### 1. Vercel (Recommended)

Vercel matches Cloudflare on all five criteria and runs a full Node.js runtime — no workerd ecosystem gaps, no virtual filesystem, no CPU-time billing surprises. The `@astrojs/vercel` adapter is GA with Astro 6 peer support, automatic PR preview deploys are zero-config, and the Hobby tier includes 1M function invocations, 100 GB bandwidth, and 4 CPU-hours per month at $0. The Vercel MCP server is GA and supports Cursor. The migration cost (adapter swap, env audit, CI update) is real but scoped: ~half a day.

#### 2. Cloudflare Workers (Runner-up)

Cloudflare scored identically on paper and has the massive advantage of zero migration cost — the project is already configured for it. It was the initial top pick. However, the anti-bias cross-check surfaced compounding risks: the free-tier 10ms CPU cap will likely force a $5/mo upgrade before real users arrive; workerd runtime differences create a class of production-only bugs; the 3 MB free-tier bundle limit is tight for a growing app; and preview deploy setup requires manual CI work. For a solo developer prioritizing DX on a tight timeline, these friction points add up. Cloudflare remains an excellent fallback if Vercel's Hobby limits prove too restrictive.

#### 3. Netlify

Netlify offers solid serverless Node.js SSR via `@astrojs/netlify` v7 and has a strong MCP integration (GA). However, it loses points on two criteria: no CLI rollback command (dashboard or API only) and the credit-based pricing model can pause sites on limit exhaustion. The free tier (300 credits/mo) is likely sufficient for MVP traffic but less transparent than Vercel's clear invocation/bandwidth limits. The adapter swap cost is comparable to Vercel's.

## Anti-Bias Cross-Check: Vercel

### Devil's Advocate — Weaknesses

1. **Adapter swap is real migration work on a 3-week timeline.** Replacing `@astrojs/cloudflare` with `@astrojs/vercel`, removing wrangler and `.dev.vars`, auditing `astro:env/server` secrets for Vercel's env model, updating CI, and configuring Supabase redirect URLs for `*.vercel.app` preview deploys — conservatively half a day, but scope creep from runtime differences could stretch it.

2. **Hobby plan has hard limits, not pay-as-you-go.** Exceeding 100 GB bandwidth, 1M function invocations, or 4 CPU-hours pauses the project entirely — no graceful degradation. A bot scraping the site or a viral moment could take the app offline.

3. **Serverless cold starts on SSR pages.** After idle periods, the first request to each route pays a 200-500ms cold-start penalty. For gym-time workout logging, this is noticeable on the first page load.

4. **Vercel Postgres and KV are sunset.** Co-located data services require Marketplace integrations (Neon, Upstash). Not a problem while using Supabase externally, but limits future flexibility within the Vercel ecosystem.

5. **No WebSockets.** Vercel Functions cannot accept WebSocket upgrades. Real-time features would require an external service (Supabase Realtime covers some cases).

### Pre-Mortem — How This Could Fail

The team swapped from Cloudflare to Vercel in week one, spending a full day on the adapter migration instead of the planned half-day — the `astro:env/server` module worked differently under Node.js, and three environment variables needed restructuring. Preview deploys worked beautifully from day one, boosting DX. But by week two, the Hobby plan's 4 CPU-hour limit became a concern: every SSR render consumed active CPU time, and automated Lighthouse CI checks in GitHub Actions were burning through the allowance. The team disabled preview-deploy CI to conserve hours. In month two, a fitness influencer shared a trainer's invite link on social media; 5,000 visitors hit the app in 2 hours. The function invocation count spiked and the project was paused for 6 hours until the billing period reset. The trainer lost credibility with their clients who couldn't log workouts. The team realized they needed Pro ($20/mo) for overage billing instead of hard pauses — a reasonable cost, but one they hadn't budgeted for.

### Unknown Unknowns

- **Fluid Compute (GA, default since Apr 2025) changes function concurrency semantics.** Functions can handle multiple requests on a single instance, meaning shared state bugs (global variables, in-memory caches) can leak between requests if code isn't purely stateless.

- **`vercel rollback` on Hobby only reverts to the immediately previous deploy.** If a bad deploy goes unnoticed for two deploys, rollback to the known-good version requires redeploying from a specific git commit.

- **Vercel's build cache can mask dependency issues.** Builds relying on cached `node_modules` may fail on clean rebuild if dependencies have been yanked or updated with breaking changes.

- **Supabase OAuth redirect URLs need per-preview configuration.** Each PR gets a unique `*.vercel.app` URL. A wildcard redirect pattern in Supabase (e.g., `https://*-your-project.vercel.app/api/auth/callback`) or a custom preview domain is needed.

- **300-second function duration limit has edge cases.** If an SSR page makes multiple sequential Supabase calls (e.g., trainer dashboard aggregating 20 clients), slow responses can chain into a timeout — surfacing as a generic 504 to the user.

## Operational Story

- **Preview deploys**: Every PR push generates a unique preview URL automatically (`<branch>-<project>.vercel.app`). Preview deploys are zero-config with Vercel's GitHub integration. Protection via Vercel Authentication is available on Pro.
- **Secrets**: Environment variables are managed in Vercel Dashboard → Settings → Environment Variables, scoped per environment (Production / Preview / Development). `vercel env pull` syncs to local `.env`. Rotation: update in dashboard → redeploy. Secrets are encrypted at rest; team members with project access can read values.
- **Rollback**: `vercel rollback` from CLI reverts to the previous deploy (Hobby: one version back only). Typical time-to-revert: <30 seconds. Database migrations do not roll back automatically — Supabase migrations need manual revert if schema changes accompanied the deploy.
- **Approval**: Human required for: promoting to Pro plan, adding team members, deleting project, rotating integration tokens. Agent may perform unattended: deploy, rollback (one version), env var reads, log tailing.
- **Logs**: `vercel logs --follow` tails runtime logs. `vercel logs --deployment <url>` reads logs for a specific deploy. Build logs visible via `vercel inspect <url>`. Vercel MCP server provides structured log access from Cursor.

## Risk Register

| Risk                                                 | Source                        | Likelihood | Impact | Mitigation                                                                                                 |
| ---------------------------------------------------- | ----------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| Adapter migration takes >1 day                       | Devil's advocate              | M          | M      | Time-box to 4 hours; if blocked, fall back to Cloudflare (zero migration)                                  |
| Hobby plan hard-pause on traffic spike               | Devil's advocate / Pre-mortem | L          | H      | Monitor usage in Vercel dashboard; upgrade to Pro ($20/mo) before public launch if traction signals appear |
| Cold-start latency on workout logging pages          | Devil's advocate              | M          | L      | Fluid Compute reduces cold starts; critical paths can use ISR or edge middleware for warm routing          |
| `astro:env/server` requires restructuring for Vercel | Pre-mortem                    | M          | M      | Audit env access pattern during migration; test all auth flows in preview deploy before merging            |
| Supabase OAuth breaks on preview deploys             | Unknown unknowns              | H          | M      | Configure wildcard redirect URL in Supabase auth settings during migration                                 |
| Shared state leak via Fluid Compute concurrency      | Unknown unknowns              | L          | M      | Ensure all SSR handlers are stateless; avoid module-level mutable variables                                |
| Vercel rollback limited to one version on Hobby      | Unknown unknowns              | L          | L      | Use git-based revert (`git revert` + push) as primary rollback; CLI rollback as quick escape               |
| Build cache masks broken dependencies                | Unknown unknowns              | L          | M      | Run periodic clean builds in CI (`vercel build --no-cache`) on release branches                            |
| Function timeout on heavy dashboard aggregation      | Unknown unknowns              | L          | M      | Paginate Supabase queries; add request-level timeouts; consider edge caching for dashboard data            |

## Getting Started

1. **Install the Vercel CLI and link the project:**

   ```bash
   npm i -g vercel
   vercel link
   ```

2. **Swap the Astro adapter:**

   ```bash
   npm uninstall @astrojs/cloudflare wrangler
   npx astro add vercel
   ```

   In `astro.config.mjs`, replace the Cloudflare adapter import with `@astrojs/vercel` — the `npx astro add` command handles this automatically for Astro 6.

3. **Migrate environment variables:**
   - Remove `.dev.vars` references and `wrangler.jsonc`
   - Audit `astro:env/server` — Vercel uses `process.env` under Node.js; the Astro env schema in `astro.config.mjs` still works but secrets must be added to Vercel Dashboard → Settings → Environment Variables
   - Run `vercel env pull` to sync production env vars to local `.env`

4. **Configure Supabase redirect URLs:**
   Add a wildcard redirect URL in Supabase Dashboard → Auth → URL Configuration for preview deploys (e.g., `https://*-trainr.vercel.app/api/auth/callback`)

5. **Deploy and verify:**
   ```bash
   vercel deploy          # preview deploy — test auth flows
   vercel deploy --prod   # production deploy
   ```

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup (GitHub Actions workflow updates for Vercel)
- Production-scale architecture (multi-region, HA, DR)
