---
change_id: plan-assignment
title: Plan assignment — place sessions on client calendar
status: archived
created: 2026-06-08
updated: 2026-06-13
archived_at: 2026-06-13T07:59:55Z
linear_issue: ZAW-9
---

## Notes

Roadmap slice S-04 (FR-012, US-01). Trainer drills into a client from the Clients list, uses a month-grid calendar to place sessions on specific days, assigns from a template or blank session, personalizes exercises in a pre-save editor, and persists an atomic snapshot via SECURITY DEFINER RPCs. Includes `session_exercise_sets` (S-14 follow-up), trainer month calendar (reused/adapted for S-05 client calendar).

## Addendum — implementation architecture

Phase 3 plan described `plan.astro` as the hub for calendar, day panel, and CTAs. In implementation, interactive responsibilities were extracted to `src/components/plans/ClientPlanHub.tsx` (a React island), keeping `plan.astro` as a thin SSR shell for auth checks, data loading, and initial hydration. This is idiomatic Astro SSR and was not scope creep — the plan's intended behavior is fully present; the decomposition just maps better to the Astro islands model.
