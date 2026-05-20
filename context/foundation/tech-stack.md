---
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
---

## Why this stack

Solo developer shipping a trainer-client web app in 3 weeks after-hours, with auth and realtime in scope. The 10x Astro Starter is the recommended default for web-app + JS and clears all four agent-friendly gates: typed (TypeScript + Zod), convention-based (Astro file-based routing + island architecture), popular in training data, and well-documented. Supabase provides auth, database (PostgreSQL), and realtime subscriptions out of the box — directly covering both technology-forcing features without extra integration work. The user initially explored T3 on the custom path but switched after the self-check surfaced gaps in type-system familiarity and agent-output judgment; the Astro starter's agent-optimized design compensates for those concerns. CI runs on GitHub Actions with auto-deploy-on-merge; deployment targets Cloudflare Pages as the starter's primary default.
