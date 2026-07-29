# Exercise Statistics (S-12) — Plan Brief

> Full plan: `context/changes/exercise-statistics/plan.md`

## What & Why

Give clients a read-only, per-exercise performance history so they can see progress over time: past performances (weight, reps/time, sets), estimated 1RM (Epley), and volume/tonnage. Satisfies FR-024/025/026; history visibility motivates continued logging (PRD note). Roadmap S-12, Linear ZAW-17.

## Starting Point

All logging data already exists in `set_logs` (S-06/S-10/S-13/S-21), joined through `session_exercises → workout_sessions → client_plans`. Working sets are `is_warmup = false`. RLS already scopes `set_logs` reads to the caller. There is no stats code, no client stats route, and no client "Exercises" nav today.

## Desired End State

A client sees an **Exercises** nav item → `/client/exercises` lists every exercise they've logged working sets for → `/client/exercises/:id` shows a headline all-time estimated 1RM plus a per-session history table (top set, est 1RM, volume) with expandable per-set detail. Columns adapt to the exercise metric.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Entry point | New `/client/exercises` list → `/client/exercises/[id]` detail + Topbar item | Discoverable, matches `/client/*` SSR-per-route pattern, scales | Plan |
| Which exercises | Only those with ≥1 logged working set | No empty pages; feature meaningful; avoids exposing full library | Plan |
| History granularity | One row per session, expandable to per-set | Matches FR-024 "across sessions"; scannable trend | Plan |
| Estimated 1RM | Epley per session + all-time best; "estimated" + >10-rep caveat | Satisfies FR-025, honors accuracy caveat | Plan |
| Non-weighted exercises | Adaptive columns; hide 1RM/tonnage when N/A | Honest, uncluttered, uses `default_metric` | Plan |
| API surface | None — SSR fetch + client-side expand | Simpler; matches `plan.astro` | Plan |
| Schema | No migration | Read-only; existing RLS covers it | Plan |

## Scope

**In scope:** calc core (Epley/volume/aggregates + tests), client-scoped stats service (+ integration test), two client pages, `ExerciseStatsView` island, Topbar nav item.

**Out of scope:** trainer stats view, charts/trends, warm-up-set stats, cross-exercise aggregates, RPE analytics, schema/RLS changes, new API route, new shadcn primitives.

## Architecture / Approach

Three vertical layers: (1) pure calculation util `src/lib/exercise-stats/calculations.ts`; (2) service `src/lib/exercise-stats/service.ts` with two client-scoped nested-select queries composing the calc core; (3) UI — Astro list + detail pages feeding `ExerciseStatsView` React island, plus Topbar nav.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Calculation core | Tested Epley/volume/session-aggregate util | Rounding/edge-case correctness (bodyweight, time, >10 reps) |
| 2. Service layer | Client-scoped list + history queries, integration test | Nested-select join filter correctness + RLS isolation |
| 3. UI + nav | Client pages, adaptive expandable table, nav item | Metric-adaptive columns; mobile readability |

**Prerequisites:** S-06 logging shipped (done). Local Supabase for the Phase 2 integration test.
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- 1RM is inaccurate above ~10 reps — mitigated by the "estimated" label + caveat.
- Feature is low-value until several sessions are logged (roadmap risk) — accepted; "logged-only" list avoids empty noise.
- `distance` metric has no `set_logs` column — logs only carry reps/load/duration; distance-specific figures are not shown.

## Success Criteria (Summary)

- Client can open any exercise they've logged and see correct per-session history, Epley 1RM, and volume.
- Warm-up sets are excluded; time/bodyweight exercises hide inapplicable metrics.
- A client can never see another client's history (RLS + integration test).
