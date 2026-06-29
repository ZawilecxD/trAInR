# Guided-workout debounced set-log save loss — Plan Brief

> Full plan: `context/changes/guided-workoute-debounce-fix/plan.md`

## What & Why

Clients lose logged set data when they enter values and immediately leave an exercise: the 500 ms autosave debounce timer is cancelled on unmount, the `PUT` never fires, and no error is shown (false safety). We make the debounced save flushable and gate every exercise-leaving navigation on a completed flush so data is persisted before the view changes.

## Starting Point

`GuidedWorkoutHub` keys the exercise view by `currentExercise.id`, so any navigation unmounts the `SetLogRow`/`useDebouncedSetLogSave` subtree; the hook's cleanup runs `clearTimeout`, killing the pending save. The save API itself is healthy. The E2E `guided-workout-quick-navigation-persistence.spec.ts` reproduces this and is currently red.

## Desired End State

Typing into any set field and immediately leaving by any path (Next, Prev, nav list/menu jump, back-to-list, back-to-overview) persists the value before the destination renders; it's present on reload. If the flush save fails, the user stays on the exercise and sees the existing per-row retry control instead of silently losing data.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Flush strategy | Flush and await before switching exercise | Guarantees persistence before unmount and makes the navigate-then-reload E2E deterministic | Plan |
| Page-close scope | In-app navigation only | Matches Risk #6 / the failing test; keeps scope tight | Plan |
| Navigation paths | All exercise-leaving transitions | No silent-loss path remains regardless of how the user leaves | Plan |
| Flush UX | Briefly disable nav with a saving indicator | Honest feedback, prevents double-taps, ensures the await completes | Plan |
| Flush failure | Stay on the exercise, surface existing row retry | No silent loss; reuses current error UI, no new toast system | Plan |
| Verification | Existing E2E as the guard, no new unit tooling | Avoids adding jsdom/testing-library + Vitest config change | Plan |

## Scope

**In scope:**
- Awaitable `flush()` on `useDebouncedSetLogSave` (pending + in-flight, returns success).
- A small optional context flush registry; rows self-register.
- Async, flush-gated navigation handlers in `GuidedWorkoutHub` with a navigating state; `GuidedExerciseView` disables nav during flush.
- Make the red guided-workout E2E green.

**Out of scope:**
- `pagehide`/beacon for real refresh/tab-close; new unit-test tooling; API/schema/debounce changes; the `key` remount strategy; `SessionEditList` internal flushing; toast system.

## Architecture / Approach

`useDebouncedSetLogSave` tracks pending values + the in-flight save and exposes `flush()`. Each mounted row registers `flush` into a context registry created by the hub. Hub navigation handlers become async: set `isNavigating`, `await flushAll()`, transition only if all succeed, abort on failure. Controls disable during the flush. The registry is optional, so the hook stays usable/standalone when no provider is present.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Flushable hook + registry | `flush()` + context registry, rows self-register | Pending/in-flight tracking must not break debounce, skip-on-mount, or generation guard; cancel must clear pending |
| 2. Gate navigation + verify | Async flush-gated transitions, disabled controls, red E2E goes green | Every entry point (Next/Prev/jump/back) must route through the flush; flush-failure abort must not strand the user |

**Prerequisites:** Local Supabase + dev server, Playwright Chromium installed, seeded `client-A`.
**Estimated effort:** ~1-2 sessions across 2 phases.

## Open Risks & Assumptions

- Assumes flushing only currently-mounted rows is sufficient (guided mode mounts one exercise's rows at a time) — true for the in-scope transitions.
- Assumes awaiting the flush before the transition is acceptable UX latency (typically sub-200 ms; only noticeable on slow networks).

## Success Criteria (Summary)

- Type + immediate leave (any path) + reload → value persists.
- Flush failure keeps the user on the exercise with a working retry; success then allows navigation.
- `npm run lint`, `npm run build`, and the guided-workout E2E all pass.
