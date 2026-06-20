---
change_id: starter-exercise-seed
title: Starter exercise seed
status: implemented
created: 2026-06-20
updated: 2026-06-20
archived_at: null
linear_issue: ZAW-34
---

## Notes

Plan S-17 from `context/foundation/roadmap.md`: copy a curated starter exercise library to each trainer on signup as trainer-owned exercises.

Planning decisions: static SQL catalog inside a DB seeding function, `handle_new_user()` trigger wiring, new signups only, 15-25 starter exercises, global `muscle_groups`, explicit `profiles.starter_exercises_seeded_at` idempotency marker.
