# Per-Round Exercise Prescription (S-14) — Plan Brief

> Full plan: `context/changes/exercises-separate-rounds/plan.md`

## What & Why

Trainers can only prescribe one uniform set of reps/load/rest for all sets of a template exercise. S-14 lets them configure **each round separately** — e.g. Bench Press round 1: 10×50 kg + 2 min, round 2: 8×60 kg + 2 min, round 3: 6×70 kg + 3 min — which is how strength programming actually works.

## Starting Point

S-02 session templates is fully implemented (schema, zod, service with replace-all, API, the `TemplateForm` React component, tests). Prescription lives as flat columns on `template_exercises`. No code yet creates assigned sessions from templates (S-04/S-06 unbuilt), so the downstream `session_exercises` cascade is dormant.

## Desired End State

In the template builder, each exercise shows an ordered per-round editor (reps-or-duration / load / rest per round) with "Add round" and "Duplicate last round". Templates save and reload with every round intact. Existing templates appear as N identical rounds. Cross-trainer RLS isolation still holds for the new rounds table.

## Key Decisions Made

| Decision                  | Choice                                                                     | Why (1 sentence)                                                           | Source |
| ------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| Rounds data model         | New child table `template_exercise_sets`                                   | Matches the repo's fully-relational style + RLS-via-parent like `set_logs` | Plan   |
| Set count                 | Derived from number of round rows; drop `prescribed_sets`                  | Single source of truth, no count≠rows drift                                | Plan   |
| `session_exercises` scope | Template-only; defer to S-04                                               | Roadmap scope is S-02 only; no consumers exist yet (YAGNI)                 | Plan   |
| Existing data             | Backfill flat prescription into N identical rounds before dropping columns | No template loses data on migration                                        | Plan   |
| Editor UX                 | Per-round rows + Add round / Duplicate last round                          | Common case (same as previous round) is one click                          | Plan   |
| Per-round fields          | reps/duration, load, rest vary; metricMode + notes stay per-exercise       | Metric/notes don't change between sets                                     | Plan   |
| Validation                | ≥1 round, max 20, each round needs reps or duration                        | Prevents empty/invalid prescriptions                                       | Plan   |
| Tests                     | Schema + form-validation unit tests + RLS Studio SQL                       | Matches S-02 coverage                                                      | Plan   |

## Scope

**In scope:** `template_exercise_sets` table + RLS + backfill, type changes, nested zod schemas, service two-step nested insert, API round-trip, per-round `TemplateForm` editor, form-validation rounds layer, unit tests, RLS verification SQL.

**Out of scope:** `session_exercises` restructuring (S-04), session creation/logging, drag-and-drop rounds, per-round notes/metric, round presets beyond duplicate-last.

## Architecture / Approach

Bottom-up in three phases: data model + migration/backfill → API (schema/service/routes/tests) → UI (per-round editor + form-validation + RLS SQL). Replace-all create/update is preserved but upgraded to insert `template_exercises` with `.select()`, then bulk-insert the correlated `template_exercise_sets` child rows (no transactions in supabase-js).

## Phases at a Glance

| Phase                     | What it delivers                                                           | Key risk                                                                             |
| ------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1. Data model & migration | `template_exercise_sets` + RLS + backfill, drop flat columns, type updates | Backfill must run before column drop; type changes break later layers until built    |
| 2. API contracts          | Nested zod schema, service two-step nested insert, routes, schema tests    | Correlating returned `template_exercises` ids to their `sets[]` without transactions |
| 3. UI & hardening         | Per-round `TemplateForm` editor, form-validation rounds, tests, RLS SQL    | `TemplateForm` is already the most complex component in the repo                     |

**Prerequisites:** S-02 live (it is). Local Supabase running; `npx supabase db reset` available.
**Estimated effort:** ~2–3 focused sessions across 3 phases.

## Open Risks & Assumptions

- supabase-js has no transactions: a mid-insert failure can leave partial rounds. Mitigated by create-path template rollback and length-parity asserts; acceptable for single-trainer MVP.
- Irreversible migration (flat columns dropped) — fine pre-launch with no production data.
- S-04 inherits a follow-up: `session_exercises` must later mirror this per-round model + snapshot copy at session creation.

## Success Criteria (Summary)

- Trainer creates/edits a template with differing per-round prescriptions; reload persists them in order.
- Legacy templates migrate cleanly into identical rounds; no data loss.
- Trainer B cannot read or mutate trainer A's rounds (RLS SQL all PASS); lint + build + unit tests green.
