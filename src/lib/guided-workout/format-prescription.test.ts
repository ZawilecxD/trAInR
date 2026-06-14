import { describe, expect, it } from "vitest";
import { formatExercisePrescriptionDetail, formatPrescription } from "@/lib/guided-workout/format-prescription";
import type { SessionExerciseSet } from "@/types";

function makeSet(overrides: Partial<SessionExerciseSet> & Pick<SessionExerciseSet, "set_number">): SessionExerciseSet {
  return {
    id: `set-${overrides.set_number}`,
    session_exercise_id: "ex-1",
    prescribed_reps: 8,
    prescribed_duration_seconds: null,
    prescribed_load_kg: 80,
    rest_after_seconds: 120,
    ...overrides,
  };
}

describe("formatPrescription", () => {
  it("formats uniform reps and load with rest", () => {
    const sets = [makeSet({ set_number: 1 }), makeSet({ set_number: 2 }), makeSet({ set_number: 3 })];
    expect(formatPrescription(sets, "reps_weight")).toBe("3 sets · 8 reps · 80 kg · Rest 2 min");
  });

  it("formats timed exercises with duration", () => {
    const sets = [
      makeSet({ set_number: 1, prescribed_reps: null, prescribed_duration_seconds: 45, prescribed_load_kg: null }),
      makeSet({ set_number: 2, prescribed_reps: null, prescribed_duration_seconds: 45, prescribed_load_kg: null }),
    ];
    expect(formatPrescription(sets, "time")).toBe("2 sets · 45s · Rest 2 min");
  });

  it("shows varied reps as a range with load and rest", () => {
    const sets = [
      makeSet({ set_number: 1, prescribed_reps: 8 }),
      makeSet({ set_number: 2, prescribed_reps: 10 }),
      makeSet({ set_number: 3, prescribed_reps: 8 }),
    ];
    expect(formatPrescription(sets, "reps_weight")).toBe("3 sets · 8–10 reps · 80 kg · Rest 2 min");
  });

  it("returns fallback when no sets prescribed", () => {
    expect(formatPrescription([], "reps_weight")).toBe("No sets prescribed");
  });

  it("omits rest when zero", () => {
    const sets = [makeSet({ set_number: 1, rest_after_seconds: 0 }), makeSet({ set_number: 2, rest_after_seconds: 0 })];
    expect(formatPrescription(sets, "reps_weight")).toBe("2 sets · 8 reps · 80 kg");
  });
});

describe("formatExercisePrescriptionDetail", () => {
  it("lists each round with reps and weight", () => {
    const sets = [
      makeSet({ set_number: 1 }),
      makeSet({ set_number: 2, prescribed_reps: 10 }),
      makeSet({ set_number: 3 }),
    ];
    expect(formatExercisePrescriptionDetail(sets, "reps_weight")).toBe(
      "8 reps @ 80 kg · 10 reps @ 80 kg · 8 reps @ 80 kg",
    );
  });

  it("lists timed rounds as duration", () => {
    const sets = [
      makeSet({ set_number: 1, prescribed_reps: null, prescribed_duration_seconds: 45, prescribed_load_kg: null }),
      makeSet({ set_number: 2, prescribed_reps: null, prescribed_duration_seconds: 60, prescribed_load_kg: null }),
    ];
    expect(formatExercisePrescriptionDetail(sets, "time")).toBe("45s · 60s");
  });
});
