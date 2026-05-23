---
bootstrapped_at: 2026-05-22T16:30:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: trainr
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: trainr
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: false
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: true
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

Solo developer shipping a trainer-client web app in 3 weeks after-hours, with auth as the only technology-forcing feature. The 10x Astro Starter matches the existing scaffold (Astro 6, React 19, Tailwind 4, Supabase, shadcn/ui, Cloudflare Workers) and clears all four agent-friendly gates: typed (TypeScript + Zod at boundaries), convention-based (Astro file-based routing + island architecture), popular in training data, and well-documented. Supabase provides auth and PostgreSQL database out of the box, directly covering the MVP's auth requirements without extra integration work. Cloudflare Pages is the starter's primary deployment default and the runtime the project is already wired for. CI runs on GitHub Actions with auto-deploy-on-merge. The custom path confirmed the pick over T3, Next.js, and React Router — all viable but each adding integration cost or re-scaffold friction on a tight after-hours timeline.

## Pre-scaffold verification

| Signal | Value | Severity | Notes |
| --- | --- | --- | --- |
| npm package | not run | n/a | cmd_template uses `git clone`, not an npm create CLI |
| GitHub repo | not run | n/a | `gh` CLI not installed; could not query repos/przeprogramowani/10x-astro-starter pushed_at |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 2 (`.gitignore` and `supabase/.gitignore` append-merged)
**Conflicts (.scaffold siblings)**: 47 — `astro.config.mjs`, `CLAUDE.md`, `components.json`, `.env.example`, `eslint.config.js`, `.github/workflows/ci.yml`, `.husky/pre-commit`, `.nvmrc`, `package.json`, `package-lock.json`, `.prettierrc.json`, `public/.assetsignore`, `public/favicon.png`, `public/template.png`, `README.md`, `src/components/auth/FormField.tsx`, `src/components/auth/PasswordToggle.tsx`, `src/components/auth/ServerError.tsx`, `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`, `src/components/auth/SubmitButton.tsx`, `src/components/Banner.astro`, `src/components/Topbar.astro`, `src/components/ui/button.tsx`, `src/components/ui/LibBadge.astro`, `src/components/Welcome.astro`, `src/env.d.ts`, `src/layouts/Layout.astro`, `src/lib/config-status.ts`, `src/lib/supabase.ts`, `src/lib/utils.ts`, `src/middleware.ts`, `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signout.ts`, `src/pages/api/auth/signup.ts`, `src/pages/auth/confirm-email.astro`, `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/dashboard.astro`, `src/pages/index.astro`, `src/styles/global.css`, `supabase/config.toml`, `tsconfig.json`, `.vscode/extensions.json`, `.vscode/launch.json`, `.vscode/settings.json`, `wrangler.jsonc`
**.gitignore handling**: append-merged (root `.gitignore` and `supabase/.gitignore`)
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 0 HIGH, 9 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/2/0 direct of total 0/0/9/0

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

1. **ws** v8.0.0–8.20.0 — GHSA-58qx-3vcg-4xpx — "Uninitialized memory disclosure" (CVSS 4.4). Fix: update to ws >=8.20.1. Transitive via miniflare → wrangler (direct), @cloudflare/vite-plugin.

2. **yaml** v2.0.0–2.8.2 — GHSA-48c2-rrv3-qjmp — "Stack Overflow via deeply nested YAML collections" (CVSS 4.3). Fix: update to yaml >=2.8.3. Transitive via yaml-language-server → volar-service-yaml → @astrojs/language-server → @astrojs/check (direct).

3. **@astrojs/check** (direct) — moderate via @astrojs/language-server → volar-service-yaml → yaml-language-server → yaml. Fix available: downgrade to @astrojs/check 0.9.2 (semver major).

4. **@astrojs/language-server** — moderate via volar-service-yaml → yaml chain. Transitive.

5. **@cloudflare/vite-plugin** — moderate via miniflare → ws + wrangler. Transitive.

6. **miniflare** — moderate via ws. Transitive. Affects wrangler and @cloudflare/vite-plugin.

7. **volar-service-yaml** — moderate via yaml-language-server → yaml. Transitive.

8. **wrangler** (direct) — moderate via miniflare → ws. Fix available.

9. **yaml-language-server** — moderate via yaml. Transitive.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint | Value |
| --- | --- |
| bootstrapper_confidence | first-class |
| quality_override | false |
| path_taken | custom |
| self_check_answers | typed: false, from_official_starter: true, conventions: true, docs_current: true, can_judge_agent: true |
| team_size | solo |
| deployment_target | cloudflare-pages |
| ci_provider | github-actions |
| ci_default_flow | auto-deploy-on-merge |
| has_auth | true |
| has_payments | false |
| has_realtime | false |
| has_ai | false |
| has_background_jobs | false |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
- The 47 `.scaffold` files can be diffed against their existing counterparts (`diff README.md README.md.scaffold`) to see what the latest starter ships vs what you have. Clean them up once reviewed.
