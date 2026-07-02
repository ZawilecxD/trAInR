import { describe, expect, it } from "vitest";

import { deriveSessionReadout } from "@/lib/trainer-dashboard/readout";
import { toExerciseReadoutInputs } from "@/lib/trainer-dashboard/to-exercise-readout-input";
import type { SessionExerciseDetail } from "@/lib/workout-sessions/service";

function buildExercise(overrides: Partial<SessionExerciseDetail> = {}): SessionExerciseDetail {
  return {
    id: "c1000001-0000-4000-8000-000000000001",
    session_id: "a1000001-0000-4000-8000-000000000001",
    exercise_id: "d1000001-0000-4000-8000-000000000001",
    phase: "main",
    sort_order: 0,
    notes: "Keep elbows tucked",
    sets: [
      {
        id: "s1000001-0000-4000-8000-000000000001",
        session_exercise_id: "c1000001-0000-4000-8000-000000000001",
        set_number: 1,
        prescribed_reps: 8,
        prescribed_duration_seconds: null,
        prescribed_load_kg: 40,
        rest_after_seconds: 60,
        is_warmup: false,
      },
    ],
    exercise_name: "Bench Press",
    exercise_default_metric: "reps_weight",
    logs: [
      {
        id: "l1000001-0000-4000-8000-000000000001",
        session_exercise_id: "c1000001-0000-4000-8000-000000000001",
        set_number: 1,
        is_warmup: false,
        is_complete: true,
        reps: 8,
        duration_seconds: null,
        load_kg: 42.5,
        logged_at: "2026-06-14T12:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("toExerciseReadoutInputs", () => {
  it("maps client session exercise details for deriveSessionReadout", () => {
    const exercises = [buildExercise()];
    const inputs = toExerciseReadoutInputs(exercises);

    expect(inputs).toEqual([
      {
        id: exercises[0].id,
        exercise_id: exercises[0].exercise_id,
        phase: "main",
        sort_order: 0,
        exercise_name: "Bench Press",
        exercise_default_metric: "reps_weight",
        sets: exercises[0].sets,
        logs: exercises[0].logs,
      },
    ]);

    const summary = deriveSessionReadout(inputs);
    expect(summary.status).toBe("fully_logged");
    expect(summary.completedSets).toBe(1);
    expect(summary.exercises[0].exerciseName).toBe("Bench Press");
  });
});
