# Exercise Favourites — Plan Brief

> Full plan: `context/changes/exercise-favourites/plan.md`

## What & Why

S-15 extends FR-009 browse/filter: trainers can star their most-used exercises and narrow any exercise list to favourites only. This speeds up template building and session personalization when the library grows beyond a handful of rows.

## Starting Point

The exercise library (S-01) supports server-side filters for type, muscle group, and name on `/trainer/exercises`. Exercise pickers in template/session flows load the full unfiltered list and only support client-side name search. No favourite field exists on `exercises`.

## Desired End State

Trainers toggle favourites inline on library rows and on the exercise edit form. A "Favourites only" filter works on the library page (URL-driven, like existing filters) and inside `ExercisePickerModal` (client-side on the already-loaded list). Toggling persists via existing `PATCH /api/exercises/:id`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Storage | `is_favourite boolean` on `exercises` | Exercises are already trainer-scoped; a column is simpler than a junction table. | Plan |
| Toggle placement | Library rows + edit form | Inline stars are fastest for bulk marking; edit form covers detail-page workflow. | Plan |
| Library filter | URL param `favourites=1` | Matches existing `ExerciseFilters` full-page navigation pattern. | Research |
| Picker filter | Client-side on loaded list | Pickers already SSR the full list; avoids extra API calls per modal open. | Plan |
| API | Extend existing PATCH | Reuses `updateExercise` and trainer RLS; no new route needed. | Research |
| Linear issue | `ZAW-43` | No prior S-15 issue existed; created for this slice. | Linear |

## Scope

**In scope:**

- Migration adding `is_favourite` to `exercises`
- Types, schemas, service, filter-url extensions
- Library filters + favourite star column
- `ExercisePickerModal` favourites-only toggle
- Unit tests for schema/filter-url/client-filter; integration test for favourites query

**Out of scope:**

- Client-facing favourite UI (trainer-only)
- Sorting favourites to top (filter only, not reorder)
- Shared filter component refactor beyond picker + library needs
- UI redesign (S-18)

## Architecture / Approach

Add `is_favourite` column with default `false`. Extend `listExercises` with `favouritesOnly` filter. Library page uses server-side filter via URL; picker modal applies the same semantics client-side via a small pure helper in `src/lib/exercises/`. Favourite toggles call `PATCH { is_favourite: boolean }` through a reusable `ExerciseFavouriteButton` React island.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema and service layer | Migration, types, schemas, service, unit tests | Existing RLS UPDATE policy must cover `is_favourite` (it should) |
| 2. Library UI | Filters, star toggle on rows, edit form checkbox | Optimistic toggle vs page reload tradeoff |
| 3. Picker and verification | Modal filter, integration test, roadmap note | Picker state must reset when modal closes |

**Prerequisites:** S-01 exercise library (done).

## Open Risks & Assumptions

- Starter-seeded exercises (S-17) default to `is_favourite = false`; trainers opt in.
- Favourites on archived exercises are irrelevant (archived rows are excluded from lists).

## Success Criteria (Summary)

- Trainer can star/unstar exercises from library and edit form.
- "Favourites only" filter works on library and in exercise pickers.
- Lint, build, and tests pass; RLS isolation unchanged.
