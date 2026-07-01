---

## project: "trAInR"

version: 1
status: draft
created: 2026-05-25
updated: 2026-07-01
prd_version: 1
main_goal: speed
top_blocker: time

# Roadmap: trAInR

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Independent personal trainers lose coaching time to admin — hunting across spreadsheets, chat, and PDFs to build plans, assign them, and check adherence. Clients train alone with no structured way to log what they actually did. trAInR closes this gap with an async coaching workflow: trainer builds an exercise library, composes session templates, assigns sessions to a client's calendar, the client executes through a guided workout view logging real metrics, and the trainer reviews the results — all in one tool built for phone-at-the-gym use.

## North star

**S-07: Trainer sees logged workout data on their dashboard** — the point at which the full async training loop (plan creation → assignment → client logging → trainer visibility) is proven end-to-end, validating that the product replaces the spreadsheet-and-chat fragmentation described in the Vision.

> "North star" here means: the smallest set of delivered slices whose combined completion proves the core product hypothesis — placed as early as Prerequisites allow because everything downstream only matters if this loop works.

## At a glance


| ID   | Change ID                  | Outcome (user can …)                                                      | Prerequisites | PRD refs                                          | Status   |
| ---- | -------------------------- | ------------------------------------------------------------------------- | ------------- | ------------------------------------------------- | -------- |
| F-01 | database-schema-and-rls    | (foundation) Supabase schema with RLS and role-aware middleware landed    | —             | NFR privacy, NFR data integrity, Access Control   | done     |
| S-01 | exercise-library           | create, edit, and browse/filter exercises                                 | F-01          | FR-007, FR-008, FR-009                            | done     |
| S-02 | session-templates          | create and edit reusable session templates from exercises                 | F-01, S-01    | FR-010, FR-011                                    | done     |
| S-03 | client-onboarding          | register via invite link and be auto-assigned to trainer                  | F-01          | FR-001, FR-002, FR-003, FR-004, FR-005            | done     |
| S-04 | plan-assignment            | place a session on a specific day of a client's calendar                  | S-02, S-03    | FR-012, US-01                                     | done     |
| S-05 | client-calendar            | view assigned sessions in month/week view with status colors              | S-04          | FR-013, FR-014                                    | done     |
| S-06 | guided-workout-logging     | open a session, step through exercises, log sets, see previous hints      | S-04          | FR-015, FR-016, FR-017, FR-019, FR-020, US-01     | done     |
| S-07 | trainer-dashboard          | see client overview and read-only session detail with logged data         | S-04, S-06    | FR-027, FR-028, US-01                             | done     |
| S-08 | session-completion-marking | mark a planned session finished, partially finished, or cancelled         | S-06          | FR-021                                            | proposed |
| S-09 | session-comments           | leave and read comments on a session (client ↔ trainer)                   | S-04          | FR-023                                            | proposed |
| S-10 | warmup-working-flag        | prescribe and log warm-up vs working per round (client may override)      | S-02, S-04, S-06 | FR-018                                         | done     |
| S-11 | client-removal             | remove or reject a wrongly-assigned client                                | S-03          | FR-006                                            | done     |
| S-12 | exercise-statistics        | view per-exercise history, estimated 1RM, and volume/tonnage              | S-06          | FR-024, FR-025, FR-026                            | proposed |
| S-13 | data-edit-window           | edit logged data for 24 hours, then sealed                                | S-06          | FR-022                                            | proposed |
| S-14 | exercises-separate-rounds  | prescribe each exercise round separately (reps, load, rest per round)     | S-02          | FR-010, FR-011                                    | done     |
| S-15 | exercise-favourites        | mark exercises as favourites and filter exercise lists by favourites only | S-01          | FR-009                                            | done     |
| S-16 | ad-hoc-session-logging     | log an unplanned workout not on the calendar                              | S-06          | FR-015, FR-016, FR-017 (extends)                  | parked   |
| S-17 | starter-exercise-seed      | receive a curated starter exercise library on trainer signup              | S-01, S-03    | FR-007, FR-008 (extends; supersedes Non-Goal #14) | done     |
| S-18 | ui-redesign                | use a unified premium dark UI per DESIGN.md with accessible touch targets and Pencil-aligned key flows | S-06          | NFR mobile usability                              | proposed |
| S-19 | prescription-fill-logging  | one-click fill a round with prescribed reps and load; no per-set completed toggle | S-06          | FR-015, FR-017 (extends)                          | proposed |
| S-20 | finished-session-summary-for-client | see a read-only exercise summary before editing or after completion | S-06, S-08, S-13 | FR-015, FR-017, FR-021, FR-022 (extends)          | proposed |


### Quality & testing


| ID   | Change ID                             | Outcome (team can …)                                                                                   | Prerequisites                    | PRD refs                        | Status   |
| ---- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------- | -------- |
| Q-01 | add-stryker-mutation-testing          | run Stryker on risk-critical modules to catch weak assertions beyond coverage                          | test-plan Phase 1 complete       | NFR data integrity              | proposed |
| Q-02 | harden-replace-exercise-muscle-groups | close KNOWN GAP: RPC rejects cross-trainer muscle group replacement; flip integration test             | S-01, test-plan Phase 1 complete | NFR privacy, NFR data integrity | done     |
| Q-03 | harden-complete-client-invite         | close KNOWN GAP: block fraudulent p_client_id on authenticated invite completion; preserve anon signup | S-03, test-plan Phase 1 complete | FR-003, FR-004, FR-005          | proposed |
| Q-04 | add-e2e-ci-gate                       | run the Playwright E2E suite automatically on every PR against an ephemeral Supabase, blocking merge on browser-flow regressions | S-06, test-plan Phase 5 | NFR mobile usability, NFR data integrity | proposed |


## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.


| Stream | Theme                          | Chain                                                                          | Note                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Trainer authoring → north star | `F-01` → `S-01` → `S-02` → `S-04` → `S-06` → `S-07`                            | Critical path: every link is on the shortest route to validating the async training loop.                                                                                                                                                                                                                                                                                                                  |
| B      | Client onboarding & calendar   | `S-03` → `S-05`                                                                | Joins Stream A at `S-04` (S-03 is a prerequisite for S-04); `S-05` branches off `S-04` parallel with `S-06`.                                                                                                                                                                                                                                                                                               |
| C      | Enhancement & polish           | `S-08` / `S-09` / `S-10` / `S-11` / `S-12` / `S-13` / `S-14` / `S-15` / `S-17` / `S-18` / `S-19` / `S-20` | Tier 2+3 items; sequence after core loop completes or when capacity opens. `S-14` extends session template prescription (after S-02). `S-15` extends exercise library browse/filter (after S-01). `S-16` was parked for post-MVP after planning research showed it changes creation ownership, exercise-library access, and trainer dashboard semantics. `S-17` seeds starter exercises on trainer signup. `S-18` unifies the dual design-system debt (shadcn tokens vs cosmic palette) per `DESIGN.md`, `context/changes/ui-redesign/research.md`, and Pencil mockups in `docs/pencil/`. `S-19` replaces the per-set OK/completed toggle with one-click prescription fill and defers completion semantics to session level (S-08). `S-20` makes the terminal/client summary state useful by showing the same exercise/log data read-only before the user chooses Edit or after editing is sealed. |
| D      | Quality & testing              | `Q-01` / `Q-02` / `Q-03` / `Q-04`                                              | Cross-cutting; selective mutation testing per `test-plan.md` after the integration harness lands. `Q-02`/`Q-03` close SECURITY DEFINER gaps documented by the harness (flip KNOWN GAP tests). `Q-04` promotes the existing local-only Playwright suite to a PR gate, reusing the `test-integration` Supabase-in-CI pattern.                                                                          |


## Baseline

What's already in place in the codebase as of 2026-06-20 (auto-researched + shipped slices through S-17).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 islands, shadcn/ui (new-york), Tailwind 4, file-based routing (`src/pages/`), Vite build
- **Backend / API:** present — Astro SSR with Vercel adapter, auth + domain API routes under `src/pages/api/`, middleware (`src/middleware.ts`)
- **Data:** present — Supabase migrations with RLS (`supabase/migrations/`), local seed data (`supabase/seed.sql`), starter exercise catalog on trainer signup (S-17)
- **Auth:** present — Supabase Auth via `@supabase/ssr`, cookie sessions, role-aware middleware guards for trainer/client routes
- **Testing:** present — Vitest unit + integration tests; RLS isolation harness (`tests/integration/`); CI runs lint + build (see `context/foundation/test-plan.md` for phased rollout)
- **Deploy / infra:** present — Vercel via `@astrojs/vercel`, GitHub Actions CI (`.github/workflows/ci.yml`: lint + build + deploy)
- **Observability:** absent — no logging, error tracking, metrics, or structured logging

## Foundations

### F-01: Database schema + RLS + role-aware middleware

- **Outcome:** (foundation) All Supabase tables per the ERD are created with row-level security policies enforcing cross-tenant isolation; middleware exposes the user's role (`trainer` | `client`) on `context.locals`.
- **Change ID:** database-schema-and-rls
- **PRD refs:** NFR privacy ("strict cross-tenant data isolation enforced at the database level"), NFR data integrity, Access Control section
- **Unlocks:** S-01, S-02, S-03, S-04, S-05, S-06, S-07, S-08, S-09, S-10, S-11, S-12, S-13, S-20 — every data-dependent slice
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Schema decisions lock in early; changing table shapes later cascades through all slices. Mitigated by following the reviewed ERD in `docs/ERD.md`.
- **Status:** done

## Quality

### Q-01: Stryker mutation testing

- **Outcome:** team can run Stryker (Vitest runner) on scoped, risk-critical modules to surface survived mutants — weak assertions and mirror-implementation tests that green coverage misses
- **Change ID:** add-stryker-mutation-testing
- **PRD refs:** NFR data integrity (test quality as a guardrail for regressions in high-churn `src/lib/` and security-sensitive paths)
- **Prerequisites:** test-plan Phase 1 complete (RLS isolation harness + `npm test` in CI); initial scope targets modules already covered by unit/integration tests
- **Parallel with:** any in-flight test-plan phase or feature slice — run selectively after `/10x-implement`, not on every commit
- **Blockers:** —
- **Unknowns:** which modules from `test-plan.md` risk map yield the best signal-per-runtime on first run; whether mutation runs belong in CI or stay local/pre-merge only
- **Risk:** chasing 100% mutation score produces brittle mirror tests; treat survived mutants as review items, not a todo list (m3-l2). Scope with `--mutate` and incremental mode to keep runs practical.
- **Status:** proposed

### Q-04: E2E suite in CI

- **Outcome:** team can rely on the Playwright E2E suite running automatically on every PR — against the app backed by an ephemeral local Supabase with the dev seed — so guided-workout and trainer-form browser regressions block merge instead of being caught only when someone remembers to run `npm run test:e2e` locally
- **Change ID:** add-e2e-ci-gate
- **PRD refs:** NFR mobile usability (guided-workout phone flow), NFR data integrity (autosave false-safety on client logging — Risk #6 in `test-plan.md`)
- **Prerequisites:** S-06 (guided-workout E2E specs already exist in `tests/e2e/*.spec.ts`); the Supabase-in-CI pattern already used by the `test-integration` job in `.github/workflows/ci.yml`; aligns with `test-plan.md` §3 Phase 5 and the §8 refresh trigger ("E2E moves from local-only to CI-gated")
- **Parallel with:** any in-flight slice — CI wiring touches `.github/workflows/ci.yml` and `playwright.config.ts` only, no product code
- **Blockers:** —
- **Unknowns:**
  - whether the E2E job blocks merge from day one or runs informational (non-required) first to measure flakiness and runtime
  - whether to keep running against `astro dev` (preserves the `data-testid` hooks the specs rely on and matches the current `webServer` + `auth.setup.ts` flow) or invest in a test build that retains test ids — production strips them via `babel-plugin-react-remove-properties`
  - browser/runtime cost: install `chromium` only vs a wider matrix; whether to shard once the suite grows beyond the current three specs
- **Risk:** E2E is the slowest, flakiest gate; a poorly-isolated suite erodes trust in CI. Mitigations: reuse the proven `supabase start` + seed flow (dev users `trainer-A@`/`client-A@`, password `Rooster2`, created by `scripts/seed-dev-users.sql` on reset), export `SUPABASE_URL=$API_URL` and `SUPABASE_KEY=$ANON_KEY` from `supabase status` for the dev server (mirror the integration job), pin the Playwright browser version, upload `playwright-report` + traces on failure, and gate on a single `chromium` project before expanding.
- **Status:** proposed

## Slices

### S-01: Exercise library

- **Outcome:** trainer can create exercises (name, type, muscle groups, notes, optional video/photo link), edit them, and browse/filter by type and muscle group
- **Change ID:** exercise-library
- **PRD refs:** FR-007, FR-008, FR-009
- **Prerequisites:** F-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Over-engineering the exercise model (too many fields, too much validation) when a simple form is enough for MVP. Keep it lean.
- **Status:** done

### S-02: Session templates

- **Outcome:** trainer can create a reusable session template organized into phases (warm-up/main/cooldown) with prescribed sets/reps/load and rest time per exercise, and edit existing templates
- **Change ID:** session-templates
- **PRD refs:** FR-010, FR-011
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Phase structure (warm-up/main/cooldown with ordered exercises) is the most complex data model in the product; template editing needs careful UX to avoid becoming tedious.
- **Status:** done

### S-03: Client onboarding

- **Outcome:** trainer generates an invite link, client registers through it (email+password or Google), is auto-assigned to that trainer, and can log in/out
- **Change ID:** client-onboarding
- **PRD refs:** FR-001, FR-002, FR-003, FR-004, FR-005
- **Prerequisites:** F-01
- **Parallel with:** S-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Invite link security (expiry, single-use) not fully specified in PRD; existing auth covers trainer registration (FR-001/FR-002) so delta work is the invite flow only.
- **Status:** done

### S-04: Plan assignment

- **Outcome:** trainer can create a session on a specific day of a client's calendar — from a template or from scratch — and personalize exercises (move/remove/edit)
- **Change ID:** plan-assignment
- **PRD refs:** FR-012, US-01
- **Prerequisites:** S-02, S-03
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** Assigned sessions inherit S-14 per-round prescription: `session_exercises` must gain a `session_exercise_sets` child table (mirror of `template_exercise_sets`), snapshot-copied from the template at session creation; `docs/ERD.md` still shows flat `session_exercises` and must be updated in this slice.
- **Risk:** Session personalization (move/remove/edit exercises per client) adds complexity beyond basic template instantiation; keep the first version simple (clone + edit). S-14 left template-only gaps to resolve here: align load validation with ERD (`0` = bodyweight, negative = assisted — template schema currently rejects negative), add DB `check` that each prescription round has reps or duration on both `template_exercise_sets` (hardening) and new `session_exercise_sets`.
- **Status:** done

### S-05: Client calendar view

- **Outcome:** client can view their assigned plan in a month view (default) with the ability to switch to week view; sessions visually distinguished by status (not started / finished / finished partially)
- **Change ID:** client-calendar
- **PRD refs:** FR-013, FR-014
- **Prerequisites:** S-04
- **Parallel with:** S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Calendar UX on mobile (month + week toggle in a phone browser) may need more iteration than expected to feel usable one-handed.
- **Status:** done

### S-06: Guided workout + logging

- **Outcome:** client can open a session and step through exercises one at a time (designed for one-handed phone use), navigate via exercise list menu, log each set (reps + weight or time), and see performance data from the last workout containing each exercise
- **Change ID:** guided-workout-logging
- **PRD refs:** FR-015, FR-016, FR-017, FR-019, FR-020, US-01
- **Prerequisites:** S-04
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** One-handed phone UX for set-by-set logging is the hardest UI challenge in the product; previous-performance hints (FR-019) need a query pattern that scales as session history grows.
- **Status:** done

### S-07: Trainer dashboard

- **Outcome:** trainer can see an overview of all their clients, assigned plans, and recent session activity; can view a read-only detail of a client's session showing exercises, sets, weights
- **Change ID:** trainer-dashboard
- **PRD refs:** FR-027, FR-028, US-01
- **Prerequisites:** S-04, S-06
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Dashboard "clients who need attention" prioritization logic is under-specified in PRD; for MVP, a simple chronological activity feed is sufficient.
- **Status:** done

### S-08: Session completion marking

- **Outcome:** client can mark a planned session as "finished", "finished partially", or "cancelled" (did not attempt / chose not to do it); cancelled sessions remain visible on the calendar with distinct status
- **Change ID:** session-completion-marking
- **PRD refs:** FR-021 (extends with cancelled status — add at `/10x-plan` if scope needs contract lock-in)
- **Prerequisites:** S-06
- **Parallel with:** S-07, S-10, S-12, S-13, S-19
- **Blockers:** —
- **Unknowns:** Whether a cancelled session can be reopened and started later, or is permanently closed; whether partial logging before cancel is retained
- **Risk:** Calendar status colors (S-05) need a fourth state; trainer dashboard (S-07) must surface cancelled vs not-started clearly. Per-set `is_complete` from S-06 should not drive session status once S-19 lands — session finished/partial/cancelled stays session-scoped (FR-021).
- **Status:** proposed

### S-09: Session comments

- **Outcome:** client and trainer can each leave comments on a training session and read the other's comments (bidirectional thread per session)
- **Change ID:** session-comments
- **PRD refs:** FR-023
- **Prerequisites:** S-04
- **Parallel with:** S-05, S-06, S-08
- **Blockers:** —
- **Unknowns:** Whether comments are allowed on cancelled sessions and ad-hoc sessions (S-16); chronological vs threaded display
- **Risk:** Users may expect real-time notification on new comments; notifications are out of scope (Non-Goal #5), so comments are pull-only.
- **Status:** proposed

### S-10: Warm-up/working set flag

- **Outcome:** trainer marks each prescribed round as warm-up or working when building session templates and personalizing assigned sessions; client logs each set with a warm-up/working flag that **inherits the prescribed default** when a matching round exists and **may be overridden** at log time; only working logged sets (`set_logs.is_warmup = false`) count toward stats and performance hints (FR-019, FR-025). Session **phase** warm-up/main/cool-down (whole exercises) is unchanged — this slice is per-round within an exercise.
- **Change ID:** warmup-working-flag
- **PRD refs:** FR-018
- **Prerequisites:** S-02, S-04, S-06 (extends per-round prescription from S-14 on templates and sessions, plus guided logging)
- **Parallel with:** S-07, S-08, S-12, S-13
- **Blockers:** —
- **Unknowns:** ~~Client-added rounds beyond prescription default to working; whether S-07 trainer readout should surface prescribed vs logged warm-up mismatch~~ — **Resolved:** client-added rounds default to working at log time; S-07 trainer readout surfaces warm-up/working flags.
- **Risk:** Moderate — same boolean on three row types (`template_exercise_sets`, `session_exercise_sets`, `set_logs`); assignment RPCs must snapshot the flag; default-inherit + client-override rules must stay consistent for hints/stats consumers
- **Status:** done

### S-11: Client removal

- **Outcome:** trainer can remove or reject a wrongly-assigned client
- **Change ID:** client-removal
- **PRD refs:** FR-006
- **Prerequisites:** S-03
- **Parallel with:** S-01, S-02, S-04, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Soft-delete of trainer-client relationship (retain all client data, hide from trainer view). Future: configurable retention period and optional "browse old clients" feature.
- **Status:** done

### S-12: Exercise statistics

- **Outcome:** client can view a per-exercise history table showing past performances (weight, reps/time, sets), estimated 1RM (Epley), and volume/tonnage
- **Change ID:** exercise-statistics
- **PRD refs:** FR-024, FR-025, FR-026
- **Prerequisites:** S-06
- **Parallel with:** S-07, S-08, S-10, S-13
- **Blockers:** —
- **Unknowns:** —
- **Risk:** 1RM formula is inaccurate above 10 reps; display with "estimated" qualifier. Feature is low-value until several sessions are logged.
- **Status:** proposed

### S-13: Data edit window

- **Outcome:** logged workout data can be edited for 24 hours after first entry, then sealed (immutable)
- **Change ID:** data-edit-window
- **PRD refs:** FR-022
- **Prerequisites:** S-06
- **Parallel with:** S-07, S-08, S-10, S-12
- **Blockers:** —
- **Unknowns:** —
- **Risk:** 24-hour window enforcement needs careful timezone handling; for MVP, use UTC and document the behavior.
- **Status:** proposed

### S-14: Per-round exercise prescription

- **Outcome:** trainer can add an exercise to a session template and configure each round separately — e.g. round 1: 10 reps × 50 kg + 2 min rest, round 2: 8 × 60 kg + 2 min rest, round 3: 6 × 70 kg + 3 min rest — instead of a single uniform prescription for all sets
- **Change ID:** exercises-separate-rounds
- **PRD refs:** FR-010, FR-011
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04 (once S-02 is done)
- **Blockers:** —
- **Unknowns:** ~~Whether per-round rows live on template exercises only or also on assigned session exercises~~ — **Resolved:** both; session mirror deferred to S-04 (`session_exercise_sets`). Metric variants (time/distance) per round remain per-exercise (S-14).
- **Risk:** Data model shift from flat `prescribed`_* fields to round rows cascades to S-04 (assignment), S-06 (guided logging), and S-07 (trainer readout); plan should define migration/backfill for templates created with uniform prescriptions
- **Status:** done

### S-15: Exercise favourites

- **Outcome:** trainer can mark exercises as favourites and filter exercise lists to show favourites only (exercise library and anywhere else exercises are browsed for selection)
- **Change ID:** exercise-favourites
- **PRD refs:** FR-009 (extends browse/filter; dedicated FR not yet in PRD — add at `/10x-plan` if scope needs contract lock-in)
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, S-04, S-05, S-06, S-07, S-08, S-09, S-10, S-12, S-13
- **Blockers:** —
- **Unknowns:** ~~Whether favourite toggle appears inline on list rows only, or also on exercise detail/edit; whether template builder exercise picker shares the same filter component as the library page~~ — **Resolved:** inline star on library rows + checkbox on edit form; picker uses client-side favourites filter via `filterExercises` helper (same semantics, not shared URL component).
- **Risk:** Minimal — per-trainer boolean flag; main work is consistent filter UX across exercise pickers (library, template builder, session personalization)
- **Status:** done

### S-16: Ad-hoc session logging

- **Outcome:** client can log a custom training session that was not on their calendar — pick date, add exercises (from their trainer's library or free-form where allowed), log sets/metrics through the same guided flow as planned sessions, and save it as a completed session visible to the trainer
- **Change ID:** ad-hoc-session-logging
- **PRD refs:** FR-015, FR-016, FR-017 (extends guided logging to off-plan sessions; dedicated FR not yet in PRD — add at `/10x-plan`)
- **Prerequisites:** S-06
- **Parallel with:** S-07, S-08, S-09, S-12, S-13
- **Blockers:** —
- **Unknowns:** Whether ad-hoc sessions appear on the client calendar retroactively; whether the trainer can convert an ad-hoc log into a reusable template; exercise picker scope (trainer library only vs client can add arbitrary exercise names)
- **Risk:** Blurs the line between "assigned plan" and "client self-directed training"; trainer dashboard needs a clear visual distinction from planned sessions. Initial planning research showed this is not a small S-06 extension: it needs client-scoped session creation, client-safe trainer exercise-library access, session provenance, and downstream calendar/dashboard distinctions.
- **Status:** parked

### S-17: Starter exercise library seed

- **Outcome:** every new trainer receives a copy of a curated collection of popular exercises on signup; seeded exercises behave like trainer-owned exercises (editable, deletable, usable in templates) with no read-only or "system" lock
- **Change ID:** starter-exercise-seed
- **PRD refs:** FR-007, FR-008 (extends exercise library; supersedes PRD Non-Goal #14 — pre-populated library promoted from post-MVP to proposed slice)
- **Prerequisites:** S-01, S-03
- **Parallel with:** S-02, S-15
- **Blockers:** —
- **Unknowns:** ~~Seed source (static SQL migration vs seed script vs admin-maintained catalog table); whether existing trainers get a one-time backfill; initial exercise count and muscle-group coverage; whether muscle groups from the seed are global or trainer-scoped copies~~ — **Resolved in plan:** static SQL catalog inside a DB seeding function; new trainer signups only (no backfill); 15-25 starter exercises; reuse global `muscle_groups`; guard idempotency with `profiles.starter_exercises_seeded_at`.
- **Risk:** Copy-on-signup must be a true per-trainer clone (not shared rows) to preserve RLS isolation and allow destructive edits without affecting other trainers. Duplication logic should live in the signup/onboarding path or a SECURITY DEFINER RPC triggered once per trainer.
- **Status:** done

### S-18: UI redesign

- **Outcome:** trainer and client use a unified premium dark interface per `DESIGN.md` — semantic design tokens replace hardcoded cosmic palette classes, Geist typography and WCAG 44px touch targets land globally, and key flows match Pencil mockups in `docs/pencil/` (guided workout logging and trainer dashboard)
- **Change ID:** ui-redesign
- **PRD refs:** NFR mobile usability (phone-at-the-gym portrait use)
- **Prerequisites:** S-06
- **Parallel with:** S-07, S-08, S-09, S-10, S-12, S-13, S-15, S-17, S-19
- **Blockers:** —
- **Unknowns:** Whether to adopt a trainer sidebar at `lg:` breakpoints; dark-only vs future light mode; whether amber achievement accent fits brand — see `context/changes/ui-redesign/research.md` Open Questions
- **Risk:** Token injection alone changes ~20% of visible UI; the bulk of work is replacing hardcoded `purple-500` / `text-white` / `bg-white/10` classes across ~30 files. Trainer dashboard screen polish can proceed now that S-07 is done (`docs/pencil/trainer_dashboard.pen`).
- **Status:** proposed

### S-19: Prescription fill logging

- **Outcome:** client can one-click fill a round's log with prescribed reps and load (or duration) instead of retyping each time; the per-set OK/completed toggle is removed; exercise nav progress is inferred from logged values, not an explicit round-completed flag; session finished/partial/cancelled remains session-level only (S-08)
- **Change ID:** prescription-fill-logging
- **PRD refs:** FR-015, FR-017 (extends set logging UX; dedicated FR not yet in PRD — add at `/10x-plan` if scope needs contract lock-in)
- **Prerequisites:** S-06
- **Parallel with:** S-08, S-10, S-12, S-13, S-18
- **Blockers:** —
- **Unknowns:** Whether to drop `set_logs.is_complete` from the schema or stop using it in UI while keeping the column for existing rows; whether fill copies prescription exactly or pre-fills editable fields the client can still change before save
- **Risk:** S-06 shipped the OK toggle and `is_complete`-driven exercise progress (`SetLogRow`, `exercise-progress.ts`, trainer readout in S-07); this slice must redefine progress/readout heuristics (e.g. logged reps/load present) without reintroducing per-exercise completion state the product no longer needs
- **Status:** proposed

### S-20: Finished session summary for client

- **Outcome:** client opening a finished, partially finished, cancelled, or edit-window pre-edit session sees a useful read-only summary of all exercises, prescribed targets, and logged values before any optional Edit action
- **Change ID:** finished-session-summary-for-client
- **Linear:** ZAW-51
- **PRD refs:** FR-015, FR-017 (logged data display), FR-021 (terminal session statuses), FR-022 (edit-window pre-edit/sealed summary); dedicated client summary FR not yet in PRD — add at `/10x-plan` if scope needs contract lock-in
- **Prerequisites:** S-06 for logged exercise data shape; S-08 for terminal statuses; S-13 for edit-window summary vs edit transitions
- **Parallel with:** S-09, S-12, S-18, S-19 once S-08/S-13 contracts are stable
- **Blockers:** S-13 Phase 4 navigation must land first if the summary is exposed through `completed` mode
- **Unknowns:** Whether cancelled sessions with no logs should show the full prescription, a compact "not attempted" exercise list, or both; whether summary rows should reuse trainer dashboard read-only components or client edit-list components in read-only mode
- **Risk:** The existing completion page is sparse and comments-focused; duplicating exercise readout logic from trainer dashboard or edit-list could drift. Prefer a shared read-only exercise summary component if current data shapes allow it without a broad refactor.
- **Status:** proposed

## Backlog Handoff


| Roadmap ID | Change ID                             | Suggested issue title                                                       | Ready for `/10x-plan` | Notes                                                                                                                       |
| ---------- | ------------------------------------- | --------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| F-01       | database-schema-and-rls               | Create Supabase schema with RLS policies and role-aware middleware          | —                     | done → `context/archive/2026-05-26-database-schema-and-rls/`                                                                |
| S-01       | exercise-library                      | Build exercise library CRUD (create, edit, browse/filter)                   | —                     | done → `context/archive/2026-05-28-exercise-library/`                                                                       |
| S-02       | session-templates                     | Build session template builder with phase structure                         | —                     | done → `context/archive/2026-06-05-session-templates/`                                                                      |
| S-03       | client-onboarding                     | Implement invite-link client registration and auto-assignment               | —                     | done → `context/archive/2026-05-30-client-onboarding/`                                                                      |
| S-04       | plan-assignment                       | Build plan assignment: place session on client calendar                     | —                     | done → `context/archive/2026-06-08-plan-assignment/`                                                                        |
| S-05       | client-calendar                       | Build client calendar view (month/week + status colors)                     | —                     | done → `context/archive/2026-06-13-client-calendar/`                                                                        |
| S-06       | guided-workout-logging                | Build guided workout view with set-by-set logging                           | —                     | done → `context/archive/2026-06-14-guided-workout-logging/`                                                                 |
| S-07       | trainer-dashboard                     | Build trainer dashboard with client overview and session detail             | —                     | done → `context/archive/2026-06-20-trainer-dashboard/`                                                                       |
| S-08       | session-completion-marking            | Add session status: finished, partial, or cancelled                         | yes                   | Prerequisites met (S-06); extends FR-021 with cancelled state; update S-05 calendar colors                                    |
| S-09       | session-comments                      | Add bidirectional session comments (client ↔ trainer)                       | yes                   | Prerequisites met (S-04)                                                                                                    |
| S-10       | warmup-working-flag                   | Prescribe warm-up/working per round; log with inherit + client override     | —                     | done → `context/archive/2026-06-20-warmup-working-flag/`                                                                    |
| S-11       | client-removal                        | Implement trainer can remove/reject client                                  | —                     | done → `context/archive/2026-06-05-client-removal/`                                                                         |
| S-12       | exercise-statistics                   | Build per-exercise history with 1RM and volume stats                        | yes                   | Prerequisites met (S-06)                                                                                                    |
| S-13       | data-edit-window                      | Implement 24h edit window then seal logged data                             | yes                   | Prerequisites met (S-06)                                                                                                    |
| S-14       | exercises-separate-rounds             | Per-round prescription (reps, load, rest) in session templates              | —                     | done → `context/archive/2026-06-05-exercises-separate-rounds/`                                                              |
| S-15       | exercise-favourites                   | Mark exercises as favourites and filter exercise lists                      | yes                   | Run `/10x-plan exercise-favourites`; extends FR-009 browse/filter                                                           |
| S-16       | ad-hoc-session-logging                | Log an unplanned custom workout not on the calendar                         | —                     | Parked post-MVP; see `context/changes/ad-hoc-session-logging/research.md`                                                   |
| S-17       | starter-exercise-seed                 | Copy curated starter exercises to each trainer on signup                    | —                     | done → `context/archive/2026-06-20-starter-exercise-seed/`                                                                 |
| S-18       | ui-redesign                           | Unify design tokens and apply DESIGN.md + Pencil mockups to key flows       | yes                   | Run `/10x-plan ui-redesign`; spec in `DESIGN.md`; research in `context/changes/ui-redesign/research.md`; screens in `docs/pencil/` |
| S-19       | prescription-fill-logging             | Replace per-set OK toggle with one-click prescription fill                  | yes                   | Run `/10x-plan prescription-fill-logging`; removes `is_complete` UX from S-06; session status stays in S-08                    |
| S-20       | finished-session-summary-for-client   | Show read-only exercise summary on finished client session pages            | yes                   | Linear ZAW-51; run `/10x-plan finished-session-summary-for-client`; depends on S-08/S-13 summary-mode contracts               |
| Q-01       | add-stryker-mutation-testing          | Add Stryker mutation testing as a selective quality gate                    | yes                   | Run `/10x-research add-stryker-mutation-testing`; see `context/changes/add-stryker-mutation-testing/`                       |
| Q-02       | harden-replace-exercise-muscle-groups | Add auth.uid() ownership check to replace_exercise_muscle_groups RPC        | —                     | done → `context/archive/2026-06-08-harden-replace-exercise-muscle-groups/`                                                  |
| Q-03       | harden-complete-client-invite         | Harden complete_client_invite p_client_id binding for authenticated callers | no                    | Run `/10x-frame harden-complete-client-invite` first (anon vs authenticated design); then `/10x-plan`                       |
| Q-04       | add-e2e-ci-gate                       | Wire the Playwright E2E suite into CI as a PR quality gate                   | yes                   | Run `/10x-research add-e2e-ci-gate`; mirror the `test-integration` Supabase job; see `test-plan.md` §3 Phase 5 / §8         |


## Open Roadmap Questions

1. ~~**What happens to client data when a trainer removes a client?**~~ — **Resolved:** Sever the trainer-client link (soft-delete relationship); retain all client data. Removed client is no longer visible to the trainer. Retention period TBD in the future. Future enhancement: allow trainer to browse archived client data for insights.
2. ~~**Ad-hoc session exercise scope:** Can clients pick only from their trainer's library when logging an unplanned session, or can they add arbitrary exercise names? (S-16)~~ — **Parked with S-16:** revisit post-MVP.
3. **Cancelled session reopen:** Can a client reopen a cancelled planned session and start logging, or is cancel permanent? (S-08)
4. ~~**Starter seed backfill:** Should existing trainers receive the starter exercise library retroactively, or only new signups? (S-17)~~ — **Resolved:** new trainer signups only; existing trainers are not backfilled.
5. **Trainer sidebar vs top nav:** Should the trainer area adopt a collapsible sidebar at `lg:` breakpoints, or keep the horizontal topbar? (S-18)
6. **Dark-only vs light/dark toggle:** The app is always dark today; should a light mode ever be supported? (S-18)
7. ~~**Warm-up default on extra rounds:** Client-added rounds beyond prescription default to working — confirm at `/10x-plan` (S-10)~~ — **Resolved:** client-added rounds default to working at log time (S-10 shipped).
8. **`set_logs.is_complete` column:** Drop from schema after S-19, or keep unused for backward compatibility? (S-19)

## Parked

- **Native mobile app** — Why parked: PRD §Non-Goals #1. Web-only; responsive design covers the gym use case.
- **Subscription/billing system** — Why parked: PRD §Non-Goals #2. Free tier only at launch.
- **Client goals and progress tracking** — Why parked: PRD §Non-Goals #3. Post-MVP.
- **Advanced analytics or reports** — Why parked: PRD §Non-Goals #4. Post-MVP.
- **Notifications (email/push)** — Why parked: PRD §Non-Goals #5. Post-MVP.
- **Calendar integrations** — Why parked: PRD §Non-Goals #6. Post-MVP.
- **Media asset uploads** — Why parked: PRD §Non-Goals #7. External links only.
- **In-app messaging/chat** — Why parked: PRD §Non-Goals #8. Session comments are the only feedback channel.
- **Multi-trainer organizations** — Why parked: PRD §Non-Goals #9. Single-trainer model only.
- **AI-powered plan generation** — Why parked: PRD §Non-Goals #10. All plan creation is manual.
- **Audit logging** — Why parked: PRD §Non-Goals #11. No compliance event log.
- **Plan templates (multi-week programs)** — Why parked: PRD §Non-Goals #12. Sessions placed one-by-one.
- **Offline mode** — Why parked: PRD §Non-Goals #13. Requires internet.
- ~~**Pre-populated exercise database**~~ — **Promoted to S-17** (`starter-exercise-seed`): curated starter library copied per trainer on signup; trainers edit/delete like their own exercises.
- **Ad-hoc session logging (S-16)** — Why parked: post-MVP scope. Initial planning research found it requires client-created session provenance, client-safe trainer exercise-library access, a new create RPC/API, calendar semantics, and trainer-dashboard distinction before it is safe to implement.
- **Static invite link + trainer approval** — Why parked: research spike complete (`context/archive/2026-06-07-static-invite-link-approval/`). Recommends Everfit-style reusable link + optional approval queue, but departs from locked S-03 contract (auto-assign, no pending state). Needs explicit product decision before a roadmap slice.

## Done

- **F-01: (foundation) All Supabase tables per the ERD are created with row-level security policies enforcing cross-tenant isolation; middleware exposes the user's role (`trainer` | `client`) on `context.locals`.** — Archived 2026-06-07 → `context/archive/2026-05-26-database-schema-and-rls/`. Lesson: —.
- **S-01: trainer can create exercises (name, type, muscle groups, notes, optional video/photo link), edit them, and browse/filter by type and muscle group** — Archived 2026-06-07 → `context/archive/2026-05-28-exercise-library/`. Lesson: —.
- **S-03: trainer generates an invite link, client registers through it (email+password or Google), is auto-assigned to that trainer, and can log in/out** — Archived 2026-06-07 → `context/archive/2026-05-30-client-onboarding/`. Lesson: —.
- **S-02: trainer can create a reusable session template organized into phases (warm-up/main/cooldown) with prescribed sets/reps/load and rest time per exercise, and edit existing templates** — Archived 2026-06-07 → `context/archive/2026-06-05-session-templates/`. Lesson: —.
- **S-11: trainer can remove or reject a wrongly-assigned client** — Archived 2026-06-07 → `context/archive/2026-06-05-client-removal/`. Lesson: —.
- **S-14: trainer can add an exercise to a session template and configure each round separately — e.g. round 1: 10 reps × 50 kg + 2 min rest, round 2: 8 × 60 kg + 2 min rest, round 3: 6 × 70 kg + 3 min rest — instead of a single uniform prescription for all sets** — Archived 2026-06-07 → `context/archive/2026-06-05-exercises-separate-rounds/`. Lesson: —.
- **S-04: trainer can create a session on a specific day of a client's calendar — from a template or from scratch — and personalize exercises (move/remove/edit)** — Archived 2026-06-13 → `context/archive/2026-06-08-plan-assignment/`. Lesson: —.
- **S-05: client can view their assigned plan in a month view (default) with the ability to switch to week view; sessions visually distinguished by status (not started / finished / finished partially)** — Archived 2026-06-14 → `context/archive/2026-06-13-client-calendar/`. Lesson: —.
- **Q-02: close KNOWN GAP: RPC rejects cross-trainer muscle group replacement; flip integration test** — Archived 2026-06-13 → `context/archive/2026-06-08-harden-replace-exercise-muscle-groups/`. Lesson: —.
- **S-06: client can open a session and step through exercises one at a time (designed for one-handed phone use), navigate via exercise list menu, log each set (reps + weight or time), and see performance data from the last workout containing each exercise** — Archived 2026-06-20 → `context/archive/2026-06-14-guided-workout-logging/`. Lesson: —.
- **S-07: trainer can see an overview of all their clients, assigned plans, and recent session activity; can view a read-only detail of a client's session showing exercises, sets, weights** — Archived 2026-06-20 → `context/archive/2026-06-20-trainer-dashboard/`. Lesson: —.
- **S-10: trainer marks each prescribed round as warm-up or working when building session templates and personalizing assigned sessions; client logs each set with a warm-up/working flag that inherits the prescribed default when a matching round exists and may be overridden at log time; only working logged sets (`set_logs.is_warmup = false`) count toward stats and performance hints (FR-019, FR-025). Session phase warm-up/main/cool-down (whole exercises) is unchanged — this slice is per-round within an exercise.** — Archived 2026-06-20 → `context/archive/2026-06-20-warmup-working-flag/`. Lesson: —.
- **S-17: every new trainer receives a copy of a curated collection of popular exercises on signup; seeded exercises behave like trainer-owned exercises (editable, deletable, usable in templates) with no read-only or "system" lock** — Archived 2026-06-20 → `context/archive/2026-06-20-starter-exercise-seed/`. Lesson: —.
- **S-15: trainer can mark exercises as favourites and filter exercise lists to show favourites only (exercise library and anywhere else exercises are browsed for selection)** — Archived 2026-06-29 → `context/archive/2026-06-29-exercise-favourites/`. Lesson: —.

