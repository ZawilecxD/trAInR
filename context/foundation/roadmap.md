---

## project: "trAInR"
version: 1
status: draft
created: 2026-05-25
updated: 2026-06-13
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


| ID   | Change ID                  | Outcome (user can …)                                                   | Prerequisites | PRD refs                                        | Status   |
| ---- | -------------------------- | ---------------------------------------------------------------------- | ------------- | ----------------------------------------------- | -------- |
| F-01 | database-schema-and-rls    | (foundation) Supabase schema with RLS and role-aware middleware landed | —             | NFR privacy, NFR data integrity, Access Control | done     |
| S-01 | exercise-library           | create, edit, and browse/filter exercises                              | F-01          | FR-007, FR-008, FR-009                          | done     |
| S-02 | session-templates          | create and edit reusable session templates from exercises              | F-01, S-01    | FR-010, FR-011                                  | done     |
| S-03 | client-onboarding          | register via invite link and be auto-assigned to trainer               | F-01          | FR-001, FR-002, FR-003, FR-004, FR-005          | done     |
| S-04 | plan-assignment            | place a session on a specific day of a client's calendar               | S-02, S-03    | FR-012, US-01                                   | done     |
| S-05 | client-calendar            | view assigned sessions in month/week view with status colors           | S-04          | FR-013, FR-014                                  | proposed |
| S-06 | guided-workout-logging     | open a session, step through exercises, log sets, see previous hints   | S-04          | FR-015, FR-016, FR-017, FR-019, FR-020, US-01   | proposed |
| S-07 | trainer-dashboard          | see client overview and read-only session detail with logged data      | S-04, S-06    | FR-027, FR-028, US-01                           | proposed |
| S-08 | session-completion-marking | manually mark a session as finished or finished partially              | S-06          | FR-021                                          | proposed |
| S-09 | session-comments           | comment on a session (bidirectional)                                   | S-04          | FR-023                                          | proposed |
| S-10 | warmup-working-flag        | flag each logged set as warm-up or working                             | S-06          | FR-018                                          | proposed |
| S-11 | client-removal             | remove or reject a wrongly-assigned client                             | S-03          | FR-006                                          | done     |
| S-12 | exercise-statistics        | view per-exercise history, estimated 1RM, and volume/tonnage           | S-06          | FR-024, FR-025, FR-026                          | proposed |
| S-13 | data-edit-window           | edit logged data for 24 hours, then sealed                             | S-06          | FR-022                                          | proposed |
| S-14 | exercises-separate-rounds  | prescribe each exercise round separately (reps, load, rest per round)  | S-02          | FR-010, FR-011                                  | done     |


### Quality & testing


| ID   | Change ID                             | Outcome (team can …)                                                                                   | Prerequisites                    | PRD refs                        | Status   |
| ---- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------- | -------- |
| Q-01 | add-stryker-mutation-testing          | run Stryker on risk-critical modules to catch weak assertions beyond coverage                          | test-plan Phase 1 complete       | NFR data integrity              | proposed |
| Q-02 | harden-replace-exercise-muscle-groups | close KNOWN GAP: RPC rejects cross-trainer muscle group replacement; flip integration test             | S-01, test-plan Phase 1 complete | NFR privacy, NFR data integrity | done     |
| Q-03 | harden-complete-client-invite         | close KNOWN GAP: block fraudulent p_client_id on authenticated invite completion; preserve anon signup | S-03, test-plan Phase 1 complete | FR-003, FR-004, FR-005          | proposed |


## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.


| Stream | Theme                          | Chain                                                        | Note                                                                                                                                                                                          |
| ------ | ------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Trainer authoring → north star | `F-01` → `S-01` → `S-02` → `S-04` → `S-06` → `S-07`          | Critical path: every link is on the shortest route to validating the async training loop.                                                                                                     |
| B      | Client onboarding & calendar   | `S-03` → `S-05`                                              | Joins Stream A at `S-04` (S-03 is a prerequisite for S-04); `S-05` branches off `S-04` parallel with `S-06`.                                                                                  |
| C      | Enhancement & polish           | `S-08` / `S-09` / `S-10` / `S-11` / `S-12` / `S-13` / `S-14` | Tier 2+3 items; sequence after core loop completes or when capacity opens. `S-14` extends session template prescription (after S-02).                                                         |
| D      | Quality & testing              | `Q-01` / `Q-02` / `Q-03`                                     | Cross-cutting; selective mutation testing per `test-plan.md` after the integration harness lands. `Q-02`/`Q-03` close SECURITY DEFINER gaps documented by the harness (flip KNOWN GAP tests). |


## Baseline

What's already in place in the codebase as of 2026-05-25 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 islands, shadcn/ui (new-york), Tailwind 4, file-based routing (`src/pages/`), Vite build
- **Backend / API:** present — Astro SSR with Vercel adapter, 3 auth API routes (`src/pages/api/auth/`), middleware (`src/middleware.ts`)
- **Data:** partial — Supabase JS client wired (`src/lib/supabase.ts`), but no migrations or schema (proposed ERD in `docs/ERD.md` only), no seeds
- **Auth:** present — Supabase Auth via `@supabase/ssr`, cookie sessions, route-level middleware guards for `/dashboard`
- **Deploy / infra:** present — Vercel via `@astrojs/vercel`, GitHub Actions CI (`.github/workflows/ci.yml`: lint + build + deploy)
- **Observability:** absent — no logging, error tracking, metrics, or structured logging

## Foundations

### F-01: Database schema + RLS + role-aware middleware

- **Outcome:** (foundation) All Supabase tables per the ERD are created with row-level security policies enforcing cross-tenant isolation; middleware exposes the user's role (`trainer` | `client`) on `context.locals`.
- **Change ID:** database-schema-and-rls
- **PRD refs:** NFR privacy ("strict cross-tenant data isolation enforced at the database level"), NFR data integrity, Access Control section
- **Unlocks:** S-01, S-02, S-03, S-04, S-05, S-06, S-07, S-08, S-09, S-10, S-11, S-12, S-13 — every data-dependent slice
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
- **Status:** proposed

### S-06: Guided workout + logging

- **Outcome:** client can open a session and step through exercises one at a time (designed for one-handed phone use), navigate via exercise list menu, log each set (reps + weight or time), and see performance data from the last workout containing each exercise
- **Change ID:** guided-workout-logging
- **PRD refs:** FR-015, FR-016, FR-017, FR-019, FR-020, US-01
- **Prerequisites:** S-04
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** One-handed phone UX for set-by-set logging is the hardest UI challenge in the product; previous-performance hints (FR-019) need a query pattern that scales as session history grows.
- **Status:** proposed

### S-07: Trainer dashboard

- **Outcome:** trainer can see an overview of all their clients, assigned plans, and recent session activity; can view a read-only detail of a client's session showing exercises, sets, weights
- **Change ID:** trainer-dashboard
- **PRD refs:** FR-027, FR-028, US-01
- **Prerequisites:** S-04, S-06
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Dashboard "clients who need attention" prioritization logic is under-specified in PRD; for MVP, a simple chronological activity feed is sufficient.
- **Status:** proposed

### S-08: Session completion marking

- **Outcome:** client manually marks a session as "finished" or "finished partially"
- **Change ID:** session-completion-marking
- **PRD refs:** FR-021
- **Prerequisites:** S-06
- **Parallel with:** S-07, S-10, S-12, S-13
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Minimal — simple status toggle on an already-logged session.
- **Status:** proposed

### S-09: Session comments

- **Outcome:** both client and trainer can comment on a session (bidirectional)
- **Change ID:** session-comments
- **PRD refs:** FR-023
- **Prerequisites:** S-04
- **Parallel with:** S-05, S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Users may expect real-time notification on new comments; notifications are out of scope (Non-Goal #5), so comments are pull-only.
- **Status:** proposed

### S-10: Warm-up/working set flag

- **Outcome:** client can flag each logged set as warm-up or working (only working sets count toward stats and performance hints)
- **Change ID:** warmup-working-flag
- **PRD refs:** FR-018
- **Prerequisites:** S-06
- **Parallel with:** S-07, S-08, S-12, S-13
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Minimal — one boolean per set row; main question is UX (toggle vs default).
- **Status:** proposed

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
- **Risk:** Data model shift from flat `prescribed_`* fields to round rows cascades to S-04 (assignment), S-06 (guided logging), and S-07 (trainer readout); plan should define migration/backfill for templates created with uniform prescriptions
- **Status:** done

## Backlog Handoff


| Roadmap ID | Change ID                             | Suggested issue title                                                       | Ready for `/10x-plan` | Notes                                                                                                                       |
| ---------- | ------------------------------------- | --------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| F-01       | database-schema-and-rls               | Create Supabase schema with RLS policies and role-aware middleware          | yes                   | Run `/10x-plan database-schema-and-rls`                                                                                     |
| S-01       | exercise-library                      | Build exercise library CRUD (create, edit, browse/filter)                   | —                     | done                                                                                                                        |
| S-02       | session-templates                     | Build session template builder with phase structure                         | no                    | Needs F-01                                                                                                                  |
| S-03       | client-onboarding                     | Implement invite-link client registration and auto-assignment               | no                    | Needs F-01                                                                                                                  |
| S-04       | plan-assignment                       | Build plan assignment: place session on client calendar                     | no                    | Needs S-02 + S-03; must include `session_exercise_sets` mirror (S-14 follow-up), load semantics, and DB prescription checks |
| S-05       | client-calendar                       | Build client calendar view (month/week + status colors)                     | no                    | Needs S-04                                                                                                                  |
| S-06       | guided-workout-logging                | Build guided workout view with set-by-set logging                           | no                    | Needs S-04                                                                                                                  |
| S-07       | trainer-dashboard                     | Build trainer dashboard with client overview and session detail             | no                    | Needs S-04 + S-06                                                                                                           |
| S-08       | session-completion-marking            | Add manual session completion status (finished/partial)                     | no                    | Needs S-06                                                                                                                  |
| S-09       | session-comments                      | Add bidirectional session comments                                          | no                    | Needs S-04                                                                                                                  |
| S-10       | warmup-working-flag                   | Add warm-up/working set flag per logged set                                 | no                    | Needs S-06                                                                                                                  |
| S-11       | client-removal                        | Implement trainer can remove/reject client                                  | no                    | Needs S-03                                                                                                                  |
| S-12       | exercise-statistics                   | Build per-exercise history with 1RM and volume stats                        | no                    | Needs S-06                                                                                                                  |
| S-13       | data-edit-window                      | Implement 24h edit window then seal logged data                             | no                    | Needs S-06                                                                                                                  |
| S-14       | exercises-separate-rounds             | Per-round prescription (reps, load, rest) in session templates              | no                    | Needs S-02                                                                                                                  |
| Q-01       | add-stryker-mutation-testing          | Run Stryker on risk-critical modules                                        | no                    | Needs test-plan Phase 1 complete                                                                                            |
| Q-02       | harden-replace-exercise-muscle-groups | Add auth.uid() ownership check to replace_exercise_muscle_groups RPC        | yes                   | Run `/10x-plan harden-replace-exercise-muscle-groups`; flip KNOWN GAP test in `tests/integration/security-definer/`         |
| Q-03       | harden-complete-client-invite         | Harden complete_client_invite p_client_id binding for authenticated callers | no                    | Run `/10x-frame harden-complete-client-invite` first (anon vs authenticated design); then `/10x-plan`                       |
| Q-01       | add-stryker-mutation-testing          | Add Stryker mutation testing as a selective quality gate                    | yes                   | Run `/10x-research add-stryker-mutation-testing`; see `context/changes/add-stryker-mutation-testing/`                       |


## Open Roadmap Questions

1. ~~**What happens to client data when a trainer removes a client?**~~ — **Resolved:** Sever the trainer-client link (soft-delete relationship); retain all client data. Removed client is no longer visible to the trainer. Retention period TBD in the future. Future enhancement: allow trainer to browse archived client data for insights.

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
- **Pre-populated exercise database** — Why parked: PRD §Non-Goals #14. Trainers build from scratch.

## Done

- **F-01: (foundation) All Supabase tables per the ERD are created with row-level security policies enforcing cross-tenant isolation; middleware exposes the user's role (`trainer` | `client`) on `context.locals`.** — Archived 2026-06-07 → `context/archive/2026-05-26-database-schema-and-rls/`. Lesson: —.
- **S-01: trainer can create exercises (name, type, muscle groups, notes, optional video/photo link), edit them, and browse/filter by type and muscle group** — Archived 2026-06-07 → `context/archive/2026-05-28-exercise-library/`. Lesson: —.
- **S-03: trainer generates an invite link, client registers through it (email+password or Google), is auto-assigned to that trainer, and can log in/out** — Archived 2026-06-07 → `context/archive/2026-05-30-client-onboarding/`. Lesson: —.
- **S-02: trainer can create a reusable session template organized into phases (warm-up/main/cooldown) with prescribed sets/reps/load and rest time per exercise, and edit existing templates** — Archived 2026-06-07 → `context/archive/2026-06-05-session-templates/`. Lesson: —.
- **S-11: trainer can remove or reject a wrongly-assigned client** — Archived 2026-06-07 → `context/archive/2026-06-05-client-removal/`. Lesson: —.
- **S-14: trainer can add an exercise to a session template and configure each round separately — e.g. round 1: 10 reps × 50 kg + 2 min rest, round 2: 8 × 60 kg + 2 min rest, round 3: 6 × 70 kg + 3 min rest — instead of a single uniform prescription for all sets** — Archived 2026-06-07 → `context/archive/2026-06-05-exercises-separate-rounds/`. Lesson: —.
- **S-04: trainer can create a session on a specific day of a client's calendar — from a template or from scratch — and personalize exercises (move/remove/edit)** — Archived 2026-06-13 → `context/archive/2026-06-08-plan-assignment/`. Lesson: —.
- **Q-02: close KNOWN GAP: RPC rejects cross-trainer muscle group replacement; flip integration test** — Archived 2026-06-13 → `context/archive/2026-06-08-harden-replace-exercise-muscle-groups/`. Lesson: —.

