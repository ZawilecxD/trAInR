# Finished session summary for client — Plan Brief

> Full plan: `context/changes/finished-session-summary-for-client/plan.md`
> Research: codebase exploration (S-20); S-13 Phase 4 nav already shipped

## What & Why

Clients opening a finished, partially finished, cancelled, or edit-window pre-edit session should see a useful read-only summary of all exercises, prescribed targets, and logged values before choosing Edit or after the edit window seals. Today `SessionCompletedView` only shows metadata and comments.

## Starting Point

- S-08 terminal statuses and completion API are done.
- S-13 edit-window seal + Phase 4 summary-first navigation (`completed` → Edit → `edit-list`) are done.
- `ClientSessionDetail` already loads exercises, sets, and logs via `getMySessionDetail`.
- Trainer dashboard uses `deriveSessionReadout` + `SessionActualsReview` for the same data contract.

## Desired End State

`SessionCompletedView` renders a phase-grouped read-only exercise summary (prescribed vs actual per set) for all terminal sessions. Edit-window sessions still show the Edit CTA; sealed/cancelled sessions show summary only. Trainer and client share one summary component to avoid readout drift.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Summary data source | Reuse `deriveSessionReadout` on existing `ClientSessionDetail.exercises` | No new API; same heuristics as trainer | Research |
| UI reuse | Extract shared `SessionExerciseSummary` from `SessionActualsReview` | Roadmap risk: avoid duplicated readout UI | Plan |
| Cancelled + no logs | Show full prescription with "Not logged" actuals | Matches trainer readout; useful vs count-only | Plan |
| Edit flow | Unchanged — Edit still routes to `edit-list` | S-13 Phase 4 contract | Research |
| Tests | Unit on readout mapping; integration on service readout; E2E on completed re-entry | Matches repo patterns (lib vitest + Playwright) | Plan |

## Scope

**In scope:** Shared summary component; wire into `SessionCompletedView`; refactor trainer review to use shared component; unit/integration/E2E tests.

**Out of scope:** New API routes; schema changes; redesign of edit-list; trainer dashboard changes beyond refactor.

## Architecture / Approach

Map `SessionExerciseDetail[]` → `ExerciseReadoutInput[]` → `deriveSessionReadout` → `SessionExerciseSummary` (phase-grouped `ExerciseActualsCard` tables). Render inside `SessionCompletedView` between metadata and comments.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared summary component | Extract + map helper; refactor trainer review | Accidental UI regression on trainer page |
| 2. Client completed view | Summary in `SessionCompletedView` | Layout/padding with fixed Edit bar |
| 3. Tests | Unit, integration, E2E | E2E hydration timing on client island |

**Prerequisites:** S-06, S-08, S-13 (all done).

## Open Risks & Assumptions

- Cancelled sessions with zero logs still show prescribed sets (acceptable per decision above).
- Mobile table overflow handled by existing `overflow-x-auto` on summary tables.

## Success Criteria (Summary)

- Finished session re-entry shows exercise names, prescribed targets, and logged values on the summary page.
- Edit-window summary shows details before Edit; Edit still works.
- Sealed/cancelled sessions show summary without Edit controls.
