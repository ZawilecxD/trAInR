---
change_id: guided-workoute-debounce-fix
title: Fix guided-workout debounced set-log save lost on quick navigation
status: archived
created: 2026-06-29
updated: 2026-06-29
archived_at: 2026-06-29T13:28:00Z
---

## Notes

The E2E spec `tests/e2e/guided-workout-quick-navigation-persistence.spec.ts` (Risk #6 in `context/foundation/test-plan.md` — "guided-workout false safety on client logging") is currently red and exposes a real product bug: when a client enters set values and immediately taps **Next**, the exercise row unmounts and the pending debounce timer in `useDebouncedSetLogSave` is cleared, so the autosave never fires. After reload the logged reps/load are gone, while the UI gave false confidence the data was saved.

Likely fix target: `src/components/hooks/useDebouncedSetLogSave.ts` — flush the latest pending values on unmount/navigation instead of silently discarding them. Possible call-site change in `src/components/guided-workout/GuidedExerciseView.tsx` if **Next** should explicitly flush before switching exercises.

Keep the red E2E test as the regression guard; consider lower-level coverage for "pending save flushes on unmount/navigation" before/with the hook fix. Done = focused E2E goes green (reload shows the saved reps/load).

Context: [Guided-workout E2E false safety risk](0c2b679a-5a52-4360-a785-4d0d3d6d2bf8)
