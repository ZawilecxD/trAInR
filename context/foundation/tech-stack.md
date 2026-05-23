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
    can_judge_agent: true
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

Solo developer shipping a trainer-client web app in 3 weeks after-hours, with auth as the only technology-forcing feature. The 10x Astro Starter matches the existing scaffold (Astro 6, React 19, Tailwind 4, Supabase, shadcn/ui, Cloudflare Workers) and clears all four agent-friendly gates: typed (TypeScript + Zod at boundaries), convention-based (Astro file-based routing + island architecture), popular in training data, and well-documented. Supabase provides auth and PostgreSQL database out of the box, directly covering the MVP's auth requirements without extra integration work. Cloudflare Pages is the starter's primary deployment default and the runtime the project is already wired for. CI runs on GitHub Actions with auto-deploy-on-merge. The custom path confirmed the pick over T3, Next.js, and React Router — all viable but each adding integration cost or re-scaffold friction on a tight after-hours timeline.
