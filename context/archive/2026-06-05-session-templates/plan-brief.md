# Session Templates — Plan Brief

> Full plan: `context/changes/session-templates/plan.md`

## What & Why

Trainers need reusable session blueprints to avoid re-assembling the same warm-up/main/cool-down structure for each client session. S-02 delivers the template builder: create, edit, and delete templates with ordered exercises per phase and prescribed load parameters.

## Starting Point

DB schema is fully migrated (`session_templates`, `template_exercises`, complete RLS). TypeScript types exist. No API routes, pages, service module, or nav entry exists yet — pure build-out following S-01 exercise library patterns.

## Desired End State

Trainer opens `/trainer/templates` from the Topbar or dashboard, creates a template with exercises organized into Warm-up / Main / Cool-down sections (each with its own exercise picker modal), sets prescribed sets/reps-or-duration/load/rest per exercise, reorders with Up/Down buttons, saves in one request, and can edit or delete existing templates.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Exercise picker UX | Search-and-add modal per phase | Scales to large libraries; phase intent clear at pick-time | Plan |
| Phase organization | 3 collapsible sections in one form | Mirrors coach mental model; all phases visible at once | Plan |
| Sort order management | Up/Down arrow buttons per row | Simple React state swap; no extra library dependency | Plan |
| Prescribed fields | Reps/Duration toggle per row | Trainer override possible; default from exercise.default_metric | Plan |
| Template deletion | Hard delete + cascade | No archive column needed; acceptable for non-recoverable MVP delete | Plan |
| Navigation | Topbar + dashboard card | Required by lessons.md rule for new user-facing routes | Plan |
| API shape | Exercises embedded in template body | One round-trip; mirrors S-01 muscle_groups pattern | Plan |
| Exercise data fetch | SSR on page load, passed as props | No modal loading state; consistent with S-01 page pattern | Plan |
| Edit page hydration | SSR join query (template + exercises) | Form renders fully populated immediately; no extra client fetch | Plan |
| Tests | Schema + service unit tests | Consistent with S-01 coverage level | Plan |

## Scope

**In scope:** Template CRUD (create/edit/delete), phase-organized exercise composition, prescribed fields, Up/Down reorder, Topbar nav, dashboard entry, RLS verification SQL, schema unit tests.

**Out of scope:** Session assignment from templates (S-04), template duplication, drag-and-drop, soft archive for templates, client-visible views, pagination.

## Architecture / Approach

Two-phase delivery. Phase 1 builds the full API surface (zod schemas → service layer → endpoints) with replace-all semantics for template_exercises. Phase 2 builds the React form component (3 phase sections + picker modal + reorder) + Astro pages (list/new/edit) + navigation. Exercises for the picker are fetched server-side and passed as props; no extra client request on modal open.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Template API contracts | Typed schemas, service (list/get-with-join/create/update-replace-all/delete), API endpoints, schema unit tests | Replace-all semantics for template_exercises is a multi-step operation with no native transaction — acceptable for single-trainer MVP |
| 2. Template UI, navigation, and hardening | form-validation module + tests, TemplateForm + ExercisePickerModal (no exclusion — same exercise can repeat in any phase/order), 3 Astro pages, Topbar + dashboard nav entry, RLS verification SQL | TemplateForm is the most complex React component in the codebase (3 phase sections × exercise rows × picker modal state) |

**Prerequisites:** S-01 exercise library live (exercises must exist for picker to show anything). Local Supabase running with migration 20260526120300 applied.
**Estimated effort:** ~2–3 focused sessions across 2 phases.

## Open Risks & Assumptions

- Replace-all semantics for template_exercises: delete then insert without a transaction means a failure mid-insert leaves the template with fewer exercises than intended. Risk is low for single-trainer MVP; mitigated by checking error on delete step before proceeding.
- TemplateForm is substantially more complex than ExerciseForm (phase sections + modal + reorder state). Likely the largest React component in the codebase — worth an extra review pass before calling Phase 2 done.
- `exercises.trainer_id = auth.uid()` RLS on template_exercises insert means the RPC insert check happens in Supabase, not just the service layer. If a trainer's exercise is deleted between page load and form save, the insert will fail with a 403-class error that must surface clearly in the UI.

## Success Criteria (Summary)

- Trainer can create a multi-phase template, edit it, and delete it through the UI.
- Prescribed sets/reps-or-duration/load/rest persist correctly and reload correctly on edit.
- Trainer B cannot see or modify trainer A's templates (RLS verification SQL passes).
