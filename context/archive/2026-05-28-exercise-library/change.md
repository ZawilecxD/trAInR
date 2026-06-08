---
change_id: exercise-library
title: S-01 exercise library CRUD and filtering
status: archived
linear_issue: ZAW-6
phase_issues:
  "1": ZAW-26
  "2": ZAW-24
  "3": ZAW-25
created: 2026-05-28
updated: 2026-06-07
archived_at: 2026-06-07T05:27:42Z
---

## Notes

S-01 from `context/foundation/roadmap.md`.
Planning assumptions from skipped questions:

- filter logic: AND across active filter groups
- muscle filter: multi-select
- search: include case-insensitive name search

## Delivered behavior (implementation)

- API: `GET/POST /api/exercises`, `GET/PATCH /api/exercises/[id]` with zod validation and trainer-only guards
- UI: list with type + multi-select muscle + name search filters; create/edit forms with shared `ExerciseForm`; archive with confirmation
- Navigation: `/trainer/exercises` linked from topbar for trainer role
- RLS verification: `context/changes/exercise-library/verification.sql` (copy-paste Studio script, rolls back)
