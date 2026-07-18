---
change_id: exercise-statistics
title: Exercise statistics (S-12)
status: implemented
linear_issue: ZAW-17
created: 2026-07-18
updated: 2026-07-18
branch: s-12-exercise-statistics
archived_at: null
---

## Notes

Roadmap slice S-12. Client-facing per-exercise history: past performances (weight, reps/time, sets), estimated 1RM (Epley), and volume/tonnage. Builds on S-06 guided-workout logging. PRD refs FR-024, FR-025, FR-026.

Key planning decisions (confirmed with user):

- **Entry point:** new `/client/exercises` list → drill into `/client/exercises/[exerciseId]` stats page; add "Exercises" to client Topbar nav.
- **Scope of list:** only exercises the client has logged ≥1 working set for.
- **History granularity:** one row per session (date) with that session's aggregates (top set, est 1RM, volume), expandable to per-set detail.
- **Estimated 1RM:** Epley `load × (1 + reps/30)` on weighted working sets — best per session plus an all-time best; shown with "estimated" qualifier and >10-rep caveat.
- **Non-weighted exercises:** adaptive columns by `default_metric` — hide 1RM/tonnage where not applicable.

Read-only feature; no schema migration required (existing RLS on `set_logs` chain covers client-scoped reads).
