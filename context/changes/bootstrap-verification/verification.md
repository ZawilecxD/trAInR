---
bootstrapped_at: 2026-05-21T06:51:00Z
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
    can_judge_agent: false
  has_auth: true
  has_payments: false
  has_realtime: true
  has_ai: false
  has_background_jobs: false
```

### Why this stack

Solo developer shipping a trainer-client web app in 3 weeks after-hours, with auth and realtime in scope. The 10x Astro Starter is the recommended default for web-app + JS and clears all four agent-friendly gates: typed (TypeScript + Zod), convention-based (Astro file-based routing + island architecture), popular in training data, and well-documented. Supabase provides auth, database (PostgreSQL), and realtime subscriptions out of the box — directly covering both technology-forcing features without extra integration work. The user initially explored T3 on the custom path but switched after the self-check surfaced gaps in type-system familiarity and agent-output judgment; the Astro starter's agent-optimized design compensates for those concerns. CI runs on GitHub Actions with auto-deploy-on-merge; deployment targets Cloudflare Pages as the starter's primary default.

## Pre-scaffold verification

| Signal      | Value                                          | Severity | Notes                                          |
| ----------- | ---------------------------------------------- | -------- | ---------------------------------------------- |
| npm package | not run                                        | n/a      | cmd_template starts with `git clone`; npm package check skipped per pre-scaffold-verification.md |
| GitHub repo | przeprogramowani/10x-astro-starter pushed 2026-05-17 | fresh    | resolved from card.docs_url; within 3 months   |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone (clone starter repo, delete upstream `.git/`, move files up)
**Exit code**: 0
**Files moved**: 19 (astro.config.mjs, CLAUDE.md, components.json, .env.example, eslint.config.js, .github/, .husky/, node_modules/, .nvmrc, package.json, package-lock.json, .prettierrc.json, public/, README.md, src/, supabase/, tsconfig.json, .vscode/, wrangler.jsonc)
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: append-merged — cwd's existing .gitignore kept in order, scaffold lines de-duped and appended with `# from 10x-astro-starter` separator
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 10 MODERATE, 0 LOW
**Direct vs transitive**: 0/0 direct of total 1 HIGH / 10 MODERATE — all findings are transitive (0 of 895 direct dependencies directly affected)

#### CRITICAL findings

None.

#### HIGH findings

| Package | Via (direct cause) | Notes |
| ------- | ------------------ | ----- |
| devalue | devalue (self) | Transitive; check if a direct dependency update resolves this |

#### MODERATE findings

| Package | Via |
| ------- | --- |
| @astrojs/check | @astrojs/language-server |
| @astrojs/cloudflare | @cloudflare/vite-plugin, wrangler |
| @astrojs/language-server | volar-service-yaml |
| @cloudflare/vite-plugin | miniflare, wrangler, ws |
| miniflare | ws |
| volar-service-yaml | yaml-language-server |
| wrangler | miniflare |
| ws | ws (self) |
| yaml | yaml (self) |
| yaml-language-server | yaml |

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                    | Value                  |
| ----------------------- | ---------------------- |
| bootstrapper_confidence | first-class            |
| quality_override        | false                  |
| path_taken              | custom                 |
| self_check_answers.typed | false                 |
| self_check_answers.from_official_starter | true     |
| self_check_answers.conventions | true            |
| self_check_answers.docs_current | true           |
| self_check_answers.can_judge_agent | false        |
| team_size               | solo                   |
| deployment_target       | cloudflare-pages       |
| ci_provider             | github-actions         |
| ci_default_flow         | auto-deploy-on-merge   |
| has_auth                | true                   |
| has_payments            | false                  |
| has_realtime            | true                   |
| has_ai                  | false                  |
| has_background_jobs     | false                  |

These hints are preserved in the audit trail for the future M1L4 skill (Memory Architecture) to act on. v1 bootstrapper does not modify the scaffold based on feature flags or CI/CD configuration.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep (none created this run).
- Address audit findings per your project's risk tolerance — the full breakdown is in this log. All 11 findings are transitive; running `npm audit fix` may resolve some without breaking changes.
- Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key to get the app running locally.
- Run `npx astro dev` to verify the scaffold starts cleanly.
