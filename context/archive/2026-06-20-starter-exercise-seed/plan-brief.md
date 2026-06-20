# Starter Exercise Seed — Plan Brief

> Full plan: `context/changes/starter-exercise-seed/plan.md`

## What & Why

S-17 promotes the previously deferred pre-populated exercise library into a concrete enhancement: every new trainer should start with a useful set of common exercises instead of an empty library. The starter rows must be copied into each trainer's own `exercises` table records so they behave exactly like manually created exercises and preserve RLS isolation.

## Starting Point

The exercise library, global `muscle_groups`, trainer-owned `exercises`, and exercise RLS policies already exist. Signup currently creates only `profiles` through `handle_new_user()`, while local dev fixtures seed sample exercises outside the product signup path.

## Desired End State

New trainer signups receive 15-25 curated starter exercises with muscle-group links. Client signups receive no starter exercises. Existing trainers are not backfilled, and seeded exercises are ordinary trainer-owned rows that can be edited, deleted, filtered, and used in session templates.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Change ID | `starter-exercise-seed` | Roadmap S-17 uses this canonical ID, even though the invocation included the slice label. | Research |
| Seed source | Static SQL inside a seeding function | Versioned migrations are simplest and reviewable without adding admin catalog scope. | Plan |
| Signup hook | Extend `handle_new_user()` | The DB trigger covers app signup and admin-created trainers through one path. | Research / Plan |
| Rollout | New signups only | Avoids surprising existing trainers or polluting real libraries. | Plan |
| Catalog size | 15-25 exercises | Gives meaningful coverage without turning S-17 into a large content project. | Plan |
| Muscle groups | Reuse global `muscle_groups` | Matches current schema, filters, and existing seed data. | Research / Plan |
| Idempotency | `profiles.starter_exercises_seeded_at` | A durable marker avoids guessing from exercise names/counts and prevents duplicates. | Plan |
| Verification | Integration tests plus Studio SQL | CI guards the trigger/RLS behavior while manual SQL supports local review. | Lessons / Plan |
| Linear issue | `ZAW-34` | No existing matching S-17 issue was found, so a new Stream C issue was created. | Linear |

## Scope

**In scope:**

- Add `profiles.starter_exercises_seeded_at`.
- Create `seed_starter_exercises_for_trainer(p_trainer_id uuid)`.
- Update `handle_new_user()` to seed only trainers.
- Add 15-25 starter exercises and global muscle-group links.
- Add integration tests for trainer signup, client exclusion, idempotency, and RLS isolation.
- Add copy-paste Supabase Studio verification SQL.
- Align `change.md`, roadmap notes, PRD note, and Linear issue.

**Out of scope:**

- Backfilling existing trainers.
- Shared/global exercise rows.
- Trainer-scoped muscle groups.
- Catalog admin UI or catalog table.
- App-layer signup RPC wiring.
- Starter session templates or plans.
- Exercise library UI redesign.

## Architecture / Approach

S-17 is database-first. A migration adds the idempotency marker and a SECURITY DEFINER seeding function. `handle_new_user()` keeps creating the profile, then calls the seeding function only when the resolved role is `trainer`. The seeding function inserts ordinary trainer-owned exercises and junction rows against global muscle groups, then sets the marker after successful insertion.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Catalog and Provisioning Migration | DB marker, static catalog, seeding function, and signup trigger wiring | Trigger failures can break signup if not transactional and tested |
| 2. Test Coverage and Local Verification | Integration tests plus Studio SQL verification | Local Supabase setup must exercise the same auth trigger path |
| 3. Docs and Planning Alignment | Change status, roadmap/PRD notes, and Linear alignment | Docs can drift if roadmap unknowns stay unresolved |

**Prerequisites:** S-01 exercise library and S-03 client onboarding are already done.
**Estimated effort:** ~2-3 implementation sessions across 3 phases.

## Open Risks & Assumptions

- The starter catalog content still needs curation inside the 15-25 exercise range.
- The migration should not backfill existing trainers; this is a deliberate product decision.
- The seeding function must not depend on `auth.uid()` because signup trigger execution has no authenticated trainer JWT.
- If a future admin-editable catalog is needed, it should be a separate slice rather than added here.

## Success Criteria (Summary)

- New trainers receive starter exercises automatically on signup, and clients do not.
- Seeded exercises remain ordinary, editable, deletable trainer-owned rows.
- Integration tests and manual Studio SQL prove idempotency and cross-trainer RLS isolation.
