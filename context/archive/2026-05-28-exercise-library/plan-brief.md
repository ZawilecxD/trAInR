# S-01 Exercise Library — Plan Brief

> Full plan: `context/changes/exercise-library/plan.md`

## What & Why

This slice delivers the first trainer-facing product workflow after F-01 foundations: managing an exercise library. Trainers need to create, edit, and quickly find exercises by type/muscle focus without leaving the app, so this closes a core admin gap identified in FR-007/008/009 and unlocks downstream template/assignment work.

## Starting Point

Database schema and RLS for exercises are already implemented (`exercises`, `muscle_groups`, `exercise_muscle_groups`), and muscle groups are seeded. The app layer still lacks exercise API routes, trainer pages, and reusable UI components for CRUD/filter flows.

## Desired End State

Trainer can open a protected `/trainer/exercises` area, create/edit/archive exercises, and browse with type filter, multi-select muscle-group filter, and name search. API contracts are validated with zod, route-level trainer guards are enforced for `/api/exercises/*`, and ownership isolation remains guaranteed by RLS. The feature is robust enough to be used as a dependency for S-02 template building.

## Key Decisions Made

| Decision           | Choice                                                      | Why (1 sentence)                                                                      | Source |
| ------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ |
| Delivery scope     | Full trainer CRUD + filter UI                               | Matches S-01 outcome directly and avoids a throwaway API-only increment.              | Plan   |
| Edit UX shape      | Dedicated create/edit pages                                 | Cleaner mental model and simpler validation/state handling than modal/inline editing. | Plan   |
| Archive behavior   | Archive via `is_archived` and hide from default search/list | Avoids FK conflicts with template references and keeps historical data safe.          | Plan   |
| API structure      | REST-style split routes                                     | Clear contracts and easier testing/maintenance in Astro file-based API routes.        | Plan   |
| Filter logic       | AND across filter groups                                    | Predictable narrow result behavior for trainers.                                      | Plan   |
| Muscle filtering   | Multi-select groups                                         | Better real-world browsing with manageable complexity.                                | Plan   |
| Search             | Include case-insensitive name search                        | Improves usability with low incremental scope cost.                                   | Plan   |
| Verification level | Heavy verification with explicit test harness bootstrap     | Keeps success criteria executable in a repo that initially had no test runner.        | Plan   |

## Scope

**In scope:**

- Trainer exercise API routes (`index` + `[id]`) with validation
- Exercise service/schemas module in `src/lib/exercises/`
- Trainer pages for list, create, edit
- Reusable form/filter UI components
- RLS ownership verification and final hardening docs

**Out of scope:**

- Session template UX integration (S-02)
- Preloaded exercise catalog/import
- Media uploads
- Advanced pagination/virtualization
- Client-facing exercise library views

## Architecture / Approach

Use a staged implementation:

1. API contracts + validation first,
2. trainer UI consumption second,
3. security and regression hardening last.
   This keeps contracts stable before UI wiring and makes issues easier to isolate during verification.

## Phases at a Glance

| Phase                           | What it delivers                                                | Key risk                                                 |
| ------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- |
| 1. API contracts and validation | Trainer CRUD/filter endpoints with zod and service helpers      | Contract drift between route handlers and UI needs       |
| 2. Trainer UI                   | List/filter/search + dedicated create/edit pages + archive flow | UX edge cases around filter state and archive visibility |
| 3. Hardening                    | RLS verification script, regression checks, doc touch-ups       | False confidence without realistic ownership tests       |

**Prerequisites:** F-01 schema/RLS already applied locally; trainer auth flow operational.
**Estimated effort:** ~2-3 focused sessions across 3 phases.

## Open Risks & Assumptions

- Archive visibility defaults must stay predictable (hidden in default list/search, optionally revealable in admin views later).
- Heavy verification scope may stretch timeline if test harness gaps are discovered.
- Filter defaults were inferred from planning assumptions where user skipped explicit selection.

## Success Criteria (Summary)

- Trainer can complete `create -> filter -> edit -> archive` in UI without backend errors.
- API validation rejects malformed input and role-mismatched access reliably.
- RLS ownership checks confirm cross-trainer access is blocked.
