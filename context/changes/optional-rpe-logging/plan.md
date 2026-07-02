# Optional RPE Logging Implementation Plan

## Overview

Add optional per-round RPE (1–10) to client set logging and session readouts. Extends `set_logs` with a nullable column; RPE is client-logged metadata that does not affect set-completion heuristics.

## Current State Analysis

- `set_logs` stores reps, duration, load, warmup, `is_complete` (`supabase/migrations/20260526120400_sessions_logging_comments.sql`)
- `SetLogRow` autosaves via `useDebouncedSetLogSave` → `PUT /api/client/set-logs`
- `SessionExerciseSummary` shows prescribed/actual/reps/load/done columns (`src/components/workout-sessions/SessionExerciseSummary.tsx`)
- S-13 edit-window RLS policies gate `set_logs` mutations when session is sealed

### Key Discoveries

- `SetLogValues` in `useDebouncedSetLogSave.ts` is the form-state contract — extend with `rpe`
- `upsertSetLog` in `src/lib/set-logs/service.ts` is the single write path
- `formatSetActual` formats actual column text — append RPE suffix when present (optional enhancement)
- Integration tests in `tests/integration/rls/set-logs.test.ts` seed via direct Supabase client

## Desired End State

Clients see an optional RPE field per set row in guided workout. Saving with RPE null or 1–10 works. Trainer session detail and client summary show RPE column. Sealed sessions are read-only for RPE.

### Key Discoveries

- RPE must not change `isSetLogged` / progress counts
- Integer 1–10 only; zod + DB check constraint

## What We're NOT Doing

- Prescribed target RPE on `session_exercise_sets`
- Half-step RPE (7.5)
- Exercise statistics / 1RM impact (S-12)
- Trainer-side RPE entry

## Implementation Approach

Migration first, then API/types, then UI input, then readout surfaces, then tests.

## Phase 1: Data layer — migration, types, API

### Overview

Add `rpe` column and wire through type system and upsert service.

### Changes Required:

#### 1. Supabase migration

**File**: `supabase/migrations/20260702120000_set_logs_rpe.sql`

**Intent**: Persist optional RPE per set log.

**Contract**: `alter table public.set_logs add column rpe smallint null;` with `check (rpe is null or (rpe >= 1 and rpe <= 10))`. Column comment documents Borg CR-10 client-logged optional field.

#### 2. Shared types

**File**: `src/types.ts`

**Intent**: Expose `rpe` on `SetLog`.

**Contract**: `rpe: number | null` on `SetLog` interface.

#### 3. Zod schema

**File**: `src/lib/set-logs/schemas.ts`

**Intent**: Validate optional RPE on upsert body.

**Contract**: `rpe: z.number().int().min(1).max(10).nullable()` on `upsertSetLogBodySchema`.

#### 4. Upsert service

**File**: `src/lib/set-logs/service.ts`

**Intent**: Include `rpe` in upsert payload.

**Contract**: Pass `rpe: body.rpe` in `.upsert()` object. No change to `validateMetricFields` (RPE independent of metric).

### Success Criteria:

#### Automated Verification:

- `npm run lint`
- `npm test -- src/lib/set-logs/schemas.test.ts`

#### Manual Verification:

- Apply migration on local Supabase: `npx supabase db reset` or `npx supabase migration up`

---

## Phase 2: UI — logging input and readouts

### Overview

Add RPE input to guided workout rows; show RPE in session exercise summary.

### Changes Required:

#### 1. Debounced save hook

**File**: `src/components/hooks/useDebouncedSetLogSave.ts`

**Intent**: Include RPE in form state and API payload.

**Contract**: `SetLogValues` gains `rpe: number | null`.

#### 2. Set log row

**File**: `src/components/guided-workout/SetLogRow.tsx`

**Intent**: Optional RPE input per set row.

**Contract**: Compact numeric input `aria-label="Set N RPE"`, values 1–10 or empty; `initialValues` reads `existingLog?.rpe`; does not affect fill/delete eligibility.

#### 3. Session exercise summary

**File**: `src/components/workout-sessions/SessionExerciseSummary.tsx`

**Intent**: Show RPE in readout table.

**Contract**: Add "RPE" column header (font-mono label style); cell shows `setReadout.log?.rpe ?? "—"`.

#### 4. Format helper (optional display enrichment)

**File**: `src/lib/guided-workout/format-prescription.ts`

**Intent**: Append RPE to actual text when present.

**Contract**: `formatSetActual` appends ` · RPE N` when `log.rpe !== null`.

### Success Criteria:

#### Automated Verification:

- `npm run lint`
- `npm run build`

#### Manual Verification:

- Log a set with RPE 8 in guided workout; reload and confirm value persists
- Complete session; summary shows RPE column
- Trainer session detail shows RPE

---

## Phase 3: Tests and verification SQL

### Overview

Unit, integration, and E2E coverage plus Studio script.

### Changes Required:

#### 1. Schema unit tests

**File**: `src/lib/set-logs/schemas.test.ts`

**Intent**: Cover valid/null/out-of-range RPE.

**Contract**: Tests for `rpe: null`, `rpe: 7`, reject `rpe: 0` and `rpe: 11`.

#### 2. Format unit test

**File**: `src/lib/guided-workout/format-prescription.test.ts`

**Intent**: Verify RPE suffix in `formatSetActual`.

#### 3. Integration test

**File**: `tests/integration/rls/set-logs-rpe.test.ts` (new)

**Intent**: Client upsert with nullable `rpe` under RLS.

**Contract**: Insert with `rpe: 8`, update to `rpe: 9`, clear to `null`; trainer can SELECT.

#### 4. E2E test

**File**: `tests/e2e/optional-rpe-logging.spec.ts` (new)

**Intent**: Client logs RPE via UI, reload persists, completed summary shows RPE.

#### 5. Studio verification SQL

**File**: `context/changes/optional-rpe-logging/verify-s21-manual.sql`

**Intent**: Copy-paste RLS verification per lessons.md.

### Success Criteria:

#### Automated Verification:

- `npm run lint`
- `npm test -- src/lib/set-logs/schemas.test.ts src/lib/guided-workout/format-prescription.test.ts`
- `npm run test:integration -- tests/integration/rls/set-logs-rpe.test.ts`
- `npm run build`

#### Manual Verification:

- Run `verify-s21-manual.sql` in Supabase Studio after migration

---

## Testing Strategy

### Unit Tests

- Schema accepts null and 1–10; rejects out of range
- `formatSetActual` includes RPE suffix when set

### Integration Tests

- RLS: client INSERT/UPDATE with `rpe`; trainer SELECT

### E2E

- Mobile client fills set + RPE, navigates/reloads, sees value; finished summary shows RPE

### Manual Testing Steps

1. Apply migration locally
2. Start guided session as client; log set without RPE — saves normally
3. Log set with RPE 7 — reload shows 7
4. Trainer views session — RPE visible
5. Complete session within edit window; summary shows RPE
6. After seal (or mock `locked_at`), RPE field read-only

## Migration Notes

Nullable column — no backfill. Existing rows have `rpe = null`.

## References

- Roadmap S-21: `context/foundation/roadmap.md`
- Linear ZAW-53
- Set log service: `src/lib/set-logs/service.ts`
- Session summary: `src/components/workout-sessions/SessionExerciseSummary.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Data layer — migration, types, API

#### Automated

- [x] 1.1 `npm run lint`
- [x] 1.2 `npm test -- src/lib/set-logs/schemas.test.ts`

#### Manual

- [x] 1.3 Apply migration on local Supabase

### Phase 2: UI — logging input and readouts

#### Automated

- [x] 2.1 `npm run lint`
- [x] 2.2 `npm run build`

#### Manual

- [x] 2.3 Log set with RPE in guided workout; reload persists
- [x] 2.4 Trainer session detail and client summary show RPE

### Phase 3: Tests and verification SQL

#### Automated

- [x] 3.1 `npm run lint`
- [x] 3.2 Unit tests pass
- [x] 3.3 Integration test passes
- [x] 3.4 `npm run build`

#### Manual

- [x] 3.5 Run `verify-s21-manual.sql` in Supabase Studio
