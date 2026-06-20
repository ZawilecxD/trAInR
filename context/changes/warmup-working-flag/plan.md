# Warm-up vs Working Set Flag (S-10) Implementation Plan

## Overview

Implement S-10 (`warmup-working-flag`): trainers mark each prescribed round as warm-up or working in session templates and assigned sessions; clients log sets with `is_warmup` that **inherits the prescribed default** for matching `set_number` and **may be overridden**; only working logged sets (`set_logs.is_warmup = false`) count toward stats and performance hints (FR-019, FR-025). Session exercise **phase** (`warm_up` / `main` / `cool_down`) is unchanged.

## Current State Analysis

Reframed scope is locked in `context/foundation/roadmap.md`, `prd.md` (FR-018), and `docs/ERD.md`.

- **Prescription tables lack `is_warmup`.** `template_exercise_sets` and `session_exercise_sets` have per-round reps/duration/load/rest only (`supabase/migrations/20260605130000_per_round_template_prescription.sql`, `20260608120000_session_exercise_sets.sql`).
- **`set_logs.is_warmup` exists** with default `false` (`supabase/migrations/20260526120400_sessions_logging_comments.sql`) but `upsertSetLog` hardcodes `is_warmup: false` (`src/lib/set-logs/service.ts:120`).
- **Workout RPCs omit flag.** `create_workout_session` and `update_workout_session_snapshot` insert prescription rows without `is_warmup` (`supabase/migrations/20260612131600_fix_rpc_row_locking.sql:136–151`, `333–348`).
- **Trainer forms have no toggle.** `TemplateExerciseSetFormEntry` and round UI in `TemplateForm.tsx` / `SessionForm.tsx` only edit metric fields (`src/lib/session-templates/form-validation.ts:13–18`).
- **Guided workout has no warm-up UI.** `SetLogRow` toggles `is_complete` only; `useDebouncedSetLogSave` omits `is_warmup` (`src/components/guided-workout/SetLogRow.tsx`, `src/components/hooks/useDebouncedSetLogSave.ts`).
- **No inherit-default helper.** `ExerciseSetLogTable` passes `isPrescribed` but not prescribed `is_warmup` (`src/components/guided-workout/ExerciseSetLogTable.tsx`).

### Key Discoveries:

- Mirror **`is_complete`** end-to-end for logging: migration → `schemas.ts` → hook → `SetLogRow` toggle.
- Mirror **S-14 per-round fields** for prescription: `form-validation.ts` → service insert → RPC JSON.
- `sessionExercisesToPhaseEntries` maps session sets into template form shape — extend there for session edit path (`src/lib/workout-sessions/form-validation.ts`).
- Extra client rounds from `useLoggingSetNumbers.addRound` have no prescription row → default **working** per roadmap.
- FR-019 hints not shipped; no hint-filter work in this slice. S-12 will filter `!is_warmup` when built.

## Desired End State

Trainer creates/edits a template or session with rounds 1–2 marked warm-up and 3–5 working. Client opens guided workout: warm-up rows render muted; toggling warm-up/working autosaves to `set_logs.is_warmup`. New log rows without an existing row use `prescribedSet.is_warmup` when `isPrescribed`, else `false`. Client can override a prescribed warm-up to working or vice versa. `npm run lint`, `npx astro check`, `npm run build`, and `npm run test` pass.

## What We're NOT Doing

- Trainer dashboard / session readout warm-up display (S-07).
- FR-019 previous-performance hint filtering (hints deferred).
- S-12 exercise statistics / 1RM calculations.
- S-13 sealed-state UI beyond existing lock check on upsert.
- Changing session **phase** semantics (`warm_up` / `main` / `cool_down`).
- Bulk "mark all rounds working/warm-up" shortcuts.

## Implementation Approach

Four phases bottom-up: schema and RPC write path first (unblocks API), trainer prescription UI second, client logging third, tests and ERD sync last. Reuse existing round-editor and OK-toggle UX patterns; extract a small `resolveDefaultIsWarmup(prescribedSets, setNumber, existingLog)` helper in `src/lib/guided-workout/` if it keeps `SetLogRow` lean.

## Critical Implementation Details

- **RPC backward compat:** when parsing exercise JSON in RPCs, use `coalesce((v_set->>'is_warmup')::boolean, false)` so older clients omitting the field still work.
- **Autosave:** `is_warmup` changes must flow through `useDebouncedSetLogSave` like `is_complete` — debounced PUT includes the flag.
- **Stats contract:** no new stats in this slice; document that future consumers filter `set_logs` where `is_warmup = false` only.

## Phase 1: Schema and RPC snapshot

### Overview

Add `is_warmup` to prescription tables and teach workout session RPCs to persist it when snapshotting exercises.

### Changes Required:

#### 1. Migration — prescription `is_warmup`

**File**: `supabase/migrations/YYYYMMDDHHmmss_warmup_working_prescription.sql` (new)

**Intent**: Store trainer warm-up intent on each prescribed round.

**Contract**: `alter table template_exercise_sets add column is_warmup boolean not null default false`; same for `session_exercise_sets`. Existing rows backfill via default. Update `TemplateExerciseSet` and `SessionExerciseSet` in `src/types.ts` with `is_warmup: boolean`.

#### 2. Migration — RPC updates

**File**: `supabase/migrations/YYYYMMDDHHmmss_warmup_working_rpc.sql` (new)

**Intent**: Snapshot `is_warmup` when creating/updating session exercise sets from JSON payload.

**Contract**: `create or replace` `create_workout_session` and `update_workout_session_snapshot` — extend INSERT into `session_exercise_sets` with `is_warmup` from `(v_set->>'is_warmup')::boolean` defaulting to `false`. Update JSON shape comment at top of migration to include `is_warmup` in each set object.

#### 3. Zod schemas — set input

**Files**: `src/lib/session-templates/schemas.ts`, `src/lib/workout-sessions/schemas.ts`

**Intent**: Accept `is_warmup` on round payloads from trainer API.

**Contract**: Add `is_warmup: z.boolean().optional().default(false)` (or required boolean) to `templateExerciseSetInputSchema` and `sessionExerciseSetInputSchema`.

#### 4. Services — map and persist

**Files**: `src/lib/session-templates/service.ts`, `src/lib/workout-sessions/service.ts`

**Intent**: Read/write `is_warmup` on prescription rows.

**Contract**: `mapTemplateExerciseSetRow` / `mapSessionExerciseSetRow` include `is_warmup`. `insertTemplateExercises` includes column in insert rows. Session create/update already delegates to RPC — no service change beyond types/schemas once RPC accepts field.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` or migration apply succeeds locally
- `npm run lint` passes
- `npx astro check` passes
- `npm run build` passes
- `npm run test` passes (existing tests; update seeds if they insert prescription sets)

#### Manual Verification:

- Supabase Studio: `template_exercise_sets` and `session_exercise_sets` show `is_warmup` column defaulting `false`

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Trainer prescription UI

### Overview

Let trainers toggle warm-up vs working on each round in template builder and session personalization forms.

### Changes Required:

#### 1. Form model

**File**: `src/lib/session-templates/form-validation.ts`

**Intent**: Carry warm-up flag through round editor state and API payload assembly.

**Contract**: Extend `TemplateExerciseSetFormEntry` with `isWarmup: boolean`. `defaultRound()` → `isWarmup: false`. `setToRound` / `roundToPayload` map `is_warmup` ↔ `isWarmup`. `addRound` copies prior round's `isWarmup` (same as load/rest copy pattern).

#### 2. Session form mapping

**File**: `src/lib/workout-sessions/form-validation.ts`

**Intent**: Load session prescription `is_warmup` into template-shaped form entries.

**Contract**: In `sessionExercisesToPhaseEntries`, map `set.is_warmup` into round `isWarmup`.

#### 3. Template round UI

**File**: `src/components/session-templates/TemplateForm.tsx`

**Intent**: Per-round warm-up/working control in template builder.

**Contract**: Add toggle or segmented control on each round card (label: "Warm-up" / "Working"). Wire to `updateExerciseRound(..., { isWarmup })`. Warm-up rounds may use muted border/text per `DESIGN.md` / stitch prompt (desaturated vs full-strength).

#### 4. Session round UI

**File**: `src/components/workout-sessions/SessionForm.tsx`

**Intent**: Same round warm-up control when personalizing assigned sessions.

**Contract**: Mirror TemplateForm round toggle UX and wiring (forms duplicate round UI today — keep them consistent).

### Success Criteria:

#### Automated Verification:

- `npm run test` — extend `form-validation.test.ts` and `schemas.test.ts` for `is_warmup` round payloads
- `npm run lint` and `npm run build` pass

#### Manual Verification:

- Create template with round 1 warm-up, round 2 working; save and reload — flags persist
- Assign/edit session from template; warm-up flags snapshot to session and survive reload

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Client logging inherit + override

### Overview

Wire guided workout to default `is_warmup` from prescription, allow client override, and persist via set-log API.

### Changes Required:

#### 1. Set-log schema and service

**Files**: `src/lib/set-logs/schemas.ts`, `src/lib/set-logs/service.ts`

**Intent**: Accept and persist client warm-up flag.

**Contract**: Add `is_warmup: z.boolean()` to `upsertSetLogBodySchema`. Replace hardcoded `is_warmup: false` with `body.is_warmup` in upsert payload.

#### 2. Debounced save hook

**File**: `src/components/hooks/useDebouncedSetLogSave.ts`

**Intent**: Include warm-up flag in autosave payload.

**Contract**: Extend `SetLogValues` with `is_warmup: boolean`. PUT body includes field.

#### 3. Default resolution helper

**File**: `src/lib/guided-workout/warmup-default.ts` (new)

**Intent**: Centralize inherit-default rules.

**Contract**: `resolveLogIsWarmup({ existingLog, prescribedSet, isPrescribed }): boolean` — if `existingLog`, use `existingLog.is_warmup`; else if `isPrescribed && prescribedSet`, use `prescribedSet.is_warmup`; else `false`.

#### 4. Set log row UI

**Files**: `src/components/guided-workout/ExerciseSetLogTable.tsx`, `src/components/guided-workout/SetLogRow.tsx`

**Intent**: Show warm-up toggle; apply muted styling for warm-up rows.

**Contract**: `ExerciseSetLogTable` looks up `exercise.sets.find(s => s.set_number === setNumber)` and passes `prescribedSet` + `defaultIsWarmup` from helper. `SetLogRow` adds warm-up/working toggle (mirror OK button pattern); row `className` uses `cn()` with muted tokens for `is_warmup` per design system. Initialize `values.is_warmup` from `resolveLogIsWarmup`; toggling updates state and triggers debounced save.

#### 5. Prescription display (optional polish)

**File**: `src/lib/guided-workout/format-prescription.ts`

**Intent**: Label warm-up rounds in overview prescription text.

**Contract**: When formatting per-round prescription strings, prefix or suffix warm-up rounds (e.g. "WU" or muted label).

### Success Criteria:

#### Automated Verification:

- `npm run test` — `schemas.test.ts`, `warmup-default.test.ts` (new), update `logging-sets.test.ts` fixtures with `is_warmup`
- `npm run lint`, `npx astro check`, `npm run build` pass

#### Manual Verification:

- Guided workout: prescribed warm-up rounds show muted + toggled warm-up by default
- Override warm-up → working persists after navigation away and back
- "Add round" extra set defaults to working
- Edit-list mode (`SessionEditList`) reflects warm-up toggle if it reuses `SetLogRow`

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Integration tests and ERD sync

### Overview

Prove RPC snapshot and RLS paths; align ERD TypeScript interfaces with mermaid.

### Changes Required:

#### 1. Integration — create workout session

**File**: `tests/integration/security-definer/create-workout-session.test.ts`

**Intent**: Assert `is_warmup` snapshots from RPC payload to `session_exercise_sets`.

**Contract**: Extend sample exercise JSON with mixed warm-up/working sets; query `session_exercise_sets` and assert flags.

#### 2. Integration helpers

**File**: `tests/integration/helpers/session-graph.ts`

**Intent**: Seed prescription sets with `is_warmup` where applicable.

**Contract**: Extend `SessionExerciseSetSeed` with optional `is_warmup`.

#### 3. ERD documentation

**File**: `docs/ERD.md`

**Intent**: TS `SessionExerciseSet` interface includes `is_warmup` (mermaid already planned from reframe PR).

**Contract**: Align interface block with migration reality.

### Success Criteria:

#### Automated Verification:

- `npm run test` passes including integration suite
- `npm run lint` and `npm run build` pass

#### Manual Verification:

- Copy-paste RLS spot-check: client can upsert `is_warmup` on own `set_logs` only (optional `verification.sql` in change folder)

---

## Testing Strategy

### Unit Tests:

- `warmup-default.ts` — existing log wins; prescribed inherit; extra round → false
- Form validation — round payload includes `is_warmup`
- Set-log schema — rejects missing boolean when required

### Integration Tests:

- RPC snapshot preserves warm-up flags on session assignment
- RLS unchanged paths still pass (no policy changes expected)

### Manual Testing Steps:

1. Template: 3 rounds, first warm-up — save, reload, assign to client session
2. Client guided workout: verify default + override + autosave
3. Add extra round — defaults working
4. Mobile: toggle thumb-reachable, muted warm-up readable in gym lighting

## Performance Considerations

Negligible — one boolean per row; no new queries.

## Migration Notes

All existing prescription and log rows default `is_warmup = false` (working). No user action required.

## References

- Roadmap S-10: `context/foundation/roadmap.md`
- PRD FR-018: `context/foundation/prd.md`
- S-06 plan (deferred warm-up): `context/archive/2026-06-14-guided-workout-logging/plan.md`
- Design: `docs/stitch-ui-design-prompt.md` (warm-up muted, working full-strength)
- Linear: ZAW-15

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema and RPC snapshot

#### Automated

- [ ] 1.1 Migration apply succeeds locally
- [x] 1.2 `npm run lint` passes
- [x] 1.3 `npx astro check` passes
- [x] 1.4 `npm run build` passes
- [x] 1.5 `npm run test` passes

#### Manual

- [ ] 1.6 Prescription tables show `is_warmup` column in Studio

### Phase 2: Trainer prescription UI

#### Automated

- [ ] 2.1 `npm run test` passes (form/schema tests)
- [ ] 2.2 `npm run lint` and `npm run build` pass

#### Manual

- [ ] 2.3 Template round warm-up flag persists on save/reload
- [ ] 2.4 Session assignment snapshots warm-up flags

### Phase 3: Client logging inherit + override

#### Automated

- [ ] 3.1 `npm run test` passes (warmup-default, schemas, logging)
- [ ] 3.2 `npm run lint`, `npx astro check`, `npm run build` pass

#### Manual

- [ ] 3.3 Guided workout defaults, override, and extra-round behavior verified
- [ ] 3.4 Edit-list mode shows warm-up toggle if applicable

### Phase 4: Integration tests and ERD sync

#### Automated

- [ ] 4.1 `npm run test` passes including integration
- [ ] 4.2 `npm run lint` and `npm run build` pass

#### Manual

- [ ] 4.3 Optional RLS verification script reviewed
