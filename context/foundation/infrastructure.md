---
project: trAInR
researched_at: 2026-05-21
recommended_platform: Vercel
runner_up: Cloudflare Workers + Pages
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 SSR
  runtime: Node.js (Vercel serverless) — migrating from Cloudflare workerd
---

## Recommendation

**Deploy on Vercel.**

Vercel scored 5/5 on all platform criteria (CLI-first, managed/serverless, agent-readable docs, stable deploy API, MCP integration) and offers a generous free tier (1M serverless invocations/month) that comfortably covers MVP traffic. The deciding factor over the current Cloudflare setup was the Node.js runtime: it eliminates the `workerd` V8 isolate's API surface gaps (`fs`, `child_process`, `net` unavailable), removes the 10 MB compressed bundle ceiling that Astro 6 + React 19 + shadcn/ui could approach as features grow, and provides a familiar debugging model with richer error surfaces. The tradeoff is an adapter swap (`@astrojs/cloudflare` → `@astrojs/vercel`) estimated at half a day — a meaningful but bounded cost on the 3-week timeline.

## Platform Comparison

| Platform | CLI-first | Managed / Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
|---|---|---|---|---|---|---|
| **Cloudflare** | Pass | Pass | Pass | Pass | Pass | **5/5** |
| **Vercel** | Pass | Pass | Pass | Pass | Pass | **5/5** |
| **Render** | Pass | Pass | Pass | Pass | Pass | **5/5** |
| **Netlify** | Partial | Pass | Pass | Pass | Pass | **4.5/5** |
| **Railway** | Partial | Partial | Pass | Pass | Pass | **4/5** |
| **Fly.io** | Pass | Partial | Partial | Pass | Pass | **4/5** |

### Cost at MVP Scale (10k–100k requests/month)

| Platform | Monthly cost |
|---|---|
| Cloudflare | $0 (100k req/day free) |
| Vercel | $0 (1M invocations/mo free) |
| Netlify | $0 (~1.5M req capacity, credit-shared with bandwidth) |
| Railway | $5/mo minimum |
| Render | $7/mo for always-on (free tier sleeps) |
| Fly.io | $3–15/mo (no free tier) |

### Shortlisted Platforms

#### 1. Vercel (Recommended)

Vercel provides a fully managed serverless platform with a first-class Astro 6 adapter (`@astrojs/vercel`, GA, maintained by the Astro team). The Node.js 24 runtime means full npm compatibility — no polyfill gaps, no bundle size ceilings beyond Vercel's generous 250 MB uncompressed function limit. The free Hobby tier includes 1M serverless invocations/month, 100 GB bandwidth, and unlimited preview deployments. CLI tooling (`vercel deploy`, `vercel rollback`, `vercel logs`) covers the full deploy lifecycle. Official MCP server integration works with Cursor. The key weakness is zero WebSocket support (not relevant for MVP since Supabase Realtime handles client subscriptions), and some open Astro 6 adapter bugs around edge middleware body loss and hybrid chunk hash mismatches. Vercel Postgres/KV were sunset in June 2025, but this is irrelevant since trAInR uses Supabase externally.

#### 2. Cloudflare Workers + Pages (Runner-up)

Cloudflare was the original deployment target and the project is already fully configured with `@astrojs/cloudflare` v13.5.0 and wrangler v4.90.0. It scores 5/5 on criteria, has the most generous free tier (100k requests/day, not month), and delivers the fastest cold starts (~12ms p50 vs. 200-500ms on Vercel). The V8 isolate model is exceptionally lightweight. However, the `workerd` runtime's Node.js API gaps (no `fs`, `child_process`, `net`; partial `crypto`), the 10 MB compressed bundle ceiling, and the need for Durable Objects to handle any server-mediated realtime were the deciding factors against it. These constraints are manageable at MVP scale but become progressively more limiting as the feature set grows.

#### 3. Render

Render is a full-featured PaaS that scores 5/5 on criteria and offers native WebSocket support, co-located Postgres, and a comprehensive MCP server. It requires the `@astrojs/node` adapter and a $7/mo Starter plan for always-on service (free tier sleeps after 15 minutes with ~1 minute cold starts). Its strength is operational simplicity for a Node.js app — familiar deployment model, persistent filesystem available, and built-in rollback across 5-30 retained builds. The cost and the adapter swap make it a viable but slightly less attractive alternative to Vercel for this project.

## Anti-Bias Cross-Check: Vercel

### Devil's Advocate — Weaknesses

1. **Adapter swap cost on a 3-week timeline.** Migrating from `@astrojs/cloudflare` to `@astrojs/vercel` requires removing wrangler, `.dev.vars`, and the cloudflare adapter; installing the vercel adapter; reconfiguring `astro.config.mjs`; auditing env var access patterns (`astro:env/server` → Vercel's env system); and updating the CI workflow. Estimated: half-day to full day.

2. **Open Astro 6 adapter bugs.** Active issues include edge middleware body loss, hybrid chunk hash mismatches, and over-bundled functions in `@astrojs/vercel`. These could surface during development and cost debugging time.

3. **Zero WebSocket support with no roadmap.** If the app ever needs server-initiated push beyond what Supabase Realtime provides, Vercel offers no path forward.

4. **Serverless function cold starts (200-500ms).** Notably slower than Cloudflare's ~12ms. For a gym app where clients pull up sessions mid-workout, the first request latency after idle is noticeable.

5. **Vendor lock-in via proprietary features.** Vercel's image optimization, ISR, and edge middleware are platform-specific. Adopting them makes future migration harder.

### Pre-Mortem — How This Could Fail

The team spent two evenings swapping from `@astrojs/cloudflare` to `@astrojs/vercel`. The migration seemed clean — build passed, deploy succeeded, auth worked. But two weeks in, they discovered that the Supabase SSR cookie middleware behaved differently under Vercel's serverless model: the `getUser()` call in Astro middleware was occasionally returning `null` for authenticated users because Vercel's function cold starts weren't preserving the cookie jar across the middleware-to-page handoff. The fix was a workaround in the middleware, but it cost a full evening of debugging. Then the plan-creation form started hitting Vercel's 10-second serverless function timeout on slower Supabase queries during peak hours. The Astro 6 adapter's edge middleware body loss bug surfaced when a trainer tried to submit a plan with 20+ exercises — the request body was silently truncated. The trainer lost their work. By month 3, the free tier's 1M invocations were still plenty, but the team had burned 4 of their 15 available after-hours evenings on platform issues that wouldn't have existed on Cloudflare, where the project was already configured and running.

### Unknown Unknowns

- **`@astrojs/vercel` is maintained by the Astro team, not Vercel.** Bug-fix velocity depends on Astro maintainer bandwidth, not Vercel's engineering resources. Vercel prioritizes their own Next.js integration.
- **Vercel's free tier has a "fair use" policy.** While 1M invocations/month is generous, Vercel reserves the right to throttle or suspend hobby projects under sustained load. The boundary isn't precisely defined.
- **Environment variable behavior differences.** The current setup uses `astro:env/server` with secrets declared in `astro.config.mjs`. On Vercel, runtime env vars work via `process.env`, but build-time vs. runtime distinction differs from Cloudflare's model. Every env var import needs auditing.
- **Vercel function regions default to `iad1` (US East).** If users are in Europe, you'll need to explicitly configure the function region — a one-line config that's easy to miss, and latency to Supabase compounds if it's in a different region.
- **Preview deployments and Supabase auth callbacks.** Each Vercel preview deploy gets a unique URL. Supabase OAuth redirect URLs need to be updated or wildcarded for preview deploys, or auth will break on every PR preview.

## Operational Story

- **Preview deploys**: Every push to a non-production branch gets an automatic preview URL (e.g., `trainr-git-feature-x-username.vercel.app`). Protected by default on Pro plan; Hobby plan preview URLs are public. Fork PRs do not get preview deploys unless explicitly enabled.
- **Secrets**: Environment variables are set in the Vercel dashboard (Project Settings → Environment Variables) with per-environment scoping (Production / Preview / Development). Secrets are encrypted at rest. For local dev, `vercel env pull` writes a `.env.local` file. GitHub Secrets are separate (for CI); Vercel-specific secrets live in Vercel's vault.
- **Rollback**: `vercel rollback` (CLI) or one-click in dashboard. Restores the previous deployment's code and serverless functions. Typical time-to-revert: < 30 seconds. Database migrations are NOT rolled back automatically — Supabase migrations are managed separately.
- **Approval**: Publishing to production is automatic on merge to `master` (can be gated by requiring manual promotion in dashboard). Rotating secrets requires dashboard access. An agent can deploy and tail logs unattended; destructive env var changes require human confirmation.
- **Logs**: `vercel logs <deployment-url> --follow` for real-time function logs. `vercel inspect <deployment-url>` for build logs. Vercel MCP server provides read-only log access from Cursor.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Adapter swap takes longer than half a day | Devil's advocate | M | M | Time-box to 4 hours; if blocked, fall back to Cloudflare (already configured) |
| Open Astro 6 adapter bugs (body loss, hash mismatch) | Devil's advocate / Research | M | H | Pin adapter version; avoid edge middleware for form submissions; test plan-creation flow with large payloads |
| Serverless function cold starts (200-500ms) | Devil's advocate | H | L | Acceptable for MVP; monitor p99 latency; upgrade to Pro for faster cold starts if needed |
| Supabase SSR cookie issues under serverless model | Pre-mortem | L | H | Test auth flow thoroughly post-migration; ensure middleware calls `supabase.auth.getUser()` on every request per Supabase SSR docs |
| 10s function timeout on slow Supabase queries | Pre-mortem | L | M | Add Supabase query timeouts; paginate large data fetches; monitor function duration |
| Preview deploy breaks Supabase OAuth callbacks | Unknown unknowns | M | M | Add wildcard redirect URL in Supabase dashboard for `*.vercel.app`; or use a stable preview domain |
| Function region defaults to US East, users in Europe | Unknown unknowns | M | L | Set `regions: ['cdg1']` (Paris) or nearest region in `vercel.json` |
| Vercel fair-use throttling on Hobby tier | Unknown unknowns | L | M | Monitor invocation count; upgrade to Pro ($20/mo) if approaching sustained load |
| Env var access pattern changes break auth | Unknown unknowns | M | H | Audit every `import` from `astro:env/server`; test all auth endpoints post-migration |

## Getting Started

1. **Remove Cloudflare dependencies:**
   ```bash
   npm uninstall @astrojs/cloudflare wrangler
   rm -f wrangler.jsonc .dev.vars
   ```

2. **Install Vercel adapter:**
   ```bash
   npm install @astrojs/vercel
   ```

3. **Update `astro.config.mjs`:**
   Replace `import cloudflare from "@astrojs/cloudflare"` with `import vercel from "@astrojs/vercel"` and set `adapter: vercel()`. Keep `output: "server"`. Audit `env.schema` — Vercel exposes runtime env vars via `process.env`; confirm `astro:env/server` still resolves correctly or switch to `process.env.SUPABASE_URL` / `process.env.SUPABASE_KEY`.

4. **Link to Vercel and deploy:**
   ```bash
   npx vercel link
   npx vercel env add SUPABASE_URL
   npx vercel env add SUPABASE_KEY
   npx vercel deploy --prod
   ```

5. **Update CI workflow (`.github/workflows/ci.yml`):**
   The existing CI runs `npm run lint` then `npm run build`. The build step should work with the new adapter. If deploying via Vercel's GitHub integration (recommended), remove any wrangler deploy steps and let Vercel auto-deploy on push to `master`.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (beyond noting the CI gate change)
- Production-scale architecture (multi-region, HA, DR)
