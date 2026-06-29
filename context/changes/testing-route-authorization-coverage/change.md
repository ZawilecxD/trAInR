---
change_id: testing-route-authorization-coverage
title: Route authorization coverage — 401/403 on every protected API route
status: implemented
created: 2026-06-29
updated: 2026-06-29
archived_at: null
linear_issue: ZAW-44
---

## Notes

Test plan Phase 2 — Risk #3 (missing or drifted route authorization). Every protected API route must return 401 (no session) and 403 (wrong role) before any data work. Closes the gap between guard helper unit tests and per-route enforcement.
