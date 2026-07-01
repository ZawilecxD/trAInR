import { describe, expect, it } from "vitest";
import { fillValuesFromPrescription, hasLoggedValues } from "@/lib/guided-workout/prescription-fill";
import type { SessionExerciseSet } from "@/types";

function makeSet(overrides: Partial<SessionExerciseSet> = {}): SessionExerciseSet {
  return {
    id: "set-1",
    session_exercise_id: "session-exercise-1",
    set_number: 1,
    prescribed_reps: 8,
    prescribed_duration_seconds: null,
    prescribed_load_kg: 80,
    rest_after_seconds: 120,
    is_warmup: false,
    ...overrides,
  };
}

describe("fillValuesFromPrescription", () => {
  it("copies reps and load for reps_weight prescriptions", () => {
    expect(
      fillValuesFromPrescription(makeSet({ prescribed_reps: 10, prescribed_load_kg: 82.5 }), "reps_weight"),
    ).toEqual({
      reps: 10,
      duration_seconds: null,
      load_kg: 82.5,
      is_complete: false,
      is_warmup: false,
    });
  });

  it("copies duration for timed prescriptions", () => {
    expect(
      fillValuesFromPrescription(
        makeSet({ prescribed_reps: null, prescribed_duration_seconds: 45, prescribed_load_kg: null }),
        "time",
      ),
    ).toEqual({
      reps: null,
      duration_seconds: 45,
      load_kg: null,
      is_complete: false,
      is_warmup: false,
    });
  });

  it("preserves null load for bodyweight-style reps prescriptions", () => {
    expect(fillValuesFromPrescription(makeSet({ prescribed_load_kg: null }), "reps_weight").load_kg).toBeNull();
  });

  it("inherits prescribed warm-up state", () => {
    expect(fillValuesFromPrescription(makeSet({ is_warmup: true }), "reps_weight").is_warmup).toBe(true);
  });
});

describe("hasLoggedValues", () => {
  it("returns true when reps, duration, or load are present", () => {
    expect(hasLoggedValues({ reps: 8, duration_seconds: null, load_kg: null })).toBe(true);
    expect(hasLoggedValues({ reps: null, duration_seconds: 60, load_kg: null })).toBe(true);
    expect(hasLoggedValues({ reps: null, duration_seconds: null, load_kg: 0 })).toBe(true);
  });

  it("does not require or honor the historical is_complete flag", () => {
    const valueWithOldFlag = { reps: 8, duration_seconds: null, load_kg: null, is_complete: false };
    const emptyWithOldFlag = { reps: null, duration_seconds: null, load_kg: null, is_complete: true };

    expect(hasLoggedValues(valueWithOldFlag)).toBe(true);
    expect(hasLoggedValues(emptyWithOldFlag)).toBe(false);
  });

  it("returns false when all logged fields are empty", () => {
    expect(hasLoggedValues({ reps: null, duration_seconds: null, load_kg: null })).toBe(false);
    expect(hasLoggedValues(null)).toBe(false);
  });
});
