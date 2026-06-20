import { describe, expect, it } from "vitest";
import {
  formatExercisePrescriptionDetail,
  formatPrescribedSetDetail,
  formatPrescription,
  formatSetActual,
} from "@/lib/guided-workout/format-prescription";
import type { SessionExerciseSet, SetLog } from "@/types";

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

function makeLog(overrides: Partial<SetLog> & Pick<SetLog, "set_number">): SetLog {
  return {
    id: `log-${overrides.set_number}`,
    session_exercise_id: "ex-1",
    is_warmup: false,
    is_complete: false,
    reps: null,
    duration_seconds: null,
    load_kg: null,
    logged_at: "2026-06-20T10:00:00.000Z",
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

describe("formatPrescribedSetDetail", () => {
  it("includes rest after prescribed values", () => {
    const set = makeSet({ set_number: 1 });
    expect(formatPrescribedSetDetail(set, "reps_weight")).toBe("8 reps @ 80 kg · Rest 2 min");
  });

  it("returns em dash when no prescribed set", () => {
    expect(formatPrescribedSetDetail(null, "reps_weight")).toBe("—");
  });
});

describe("formatSetActual", () => {
  it("returns not logged when log is missing", () => {
    expect(formatSetActual(null, "reps_weight")).toBe("Not logged");
  });

  it("formats reps and load from a log", () => {
    const log = makeLog({ set_number: 1, reps: 10, load_kg: 82.5, is_complete: true });
    expect(formatSetActual(log, "reps_weight")).toBe("10 reps @ 82.5 kg");
  });

  it("formats timed actuals", () => {
    const log = makeLog({ set_number: 1, duration_seconds: 45, is_complete: true });
    expect(formatSetActual(log, "time")).toBe("45s");
  });

  it("returns completed when marked complete without values", () => {
    const log = makeLog({ set_number: 1, is_complete: true });
    expect(formatSetActual(log, "reps_weight")).toBe("Completed");
  });
});
