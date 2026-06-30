---
change_id: test-plan-refresh-2026-06-27
title: Refresh stale foundation test plan
status: implemented
created: 2026-06-28
updated: 2026-06-28
archived_at: null
---

## Notes

Open a change folder to refresh context/foundation/test-plan.md without editing it in place.

Refresh scope:

- Existing guide is stale: last reviewed 2026-06-07, still says integration and e2e layers are absent, but the repo now has Vitest unit tests, Vitest integration tests, Playwright config, and tests/e2e/seed.spec.ts.
- Hot-spot scan: src/, supabase/, tests/; 50 scoped commits; top dirs include src/lib/session-templates/, tests/e2e/, src/components/guided-workout/, src/lib/set-logs/.
- User concerns: mobile guided-workout flow, autosave false-safety, session-template/round-form confidence, E2E for session form/template creation.
- Negative space: do not spend budget on shadcn/ui primitives.

After creating the folder, follow the downstream continuation rule: research the refresh, then plan the precise update to context/foundation/test-plan.md.
