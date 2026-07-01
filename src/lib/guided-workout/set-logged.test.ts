import { describe, expect, it } from "vitest";
import { isSetLogged, isSetValuesLogged } from "@/lib/guided-workout/set-logged";
import type { SetLog } from "@/types";

function makeLog(overrides: Partial<SetLog>): SetLog {
  return {
    id: "log-1",
    session_exercise_id: "ex-1",
    set_number: 1,
    is_warmup: false,
    is_complete: false,
    reps: null,
    duration_seconds: null,
    load_kg: null,
    logged_at: "2026-06-14T10:00:00Z",
    ...overrides,
  };
}

describe("isSetLogged", () => {
  it("returns false when log is missing", () => {
    expect(isSetLogged(null, "reps_weight")).toBe(false);
  });

  it("counts reps_weight sets with reps as logged", () => {
    expect(isSetLogged(makeLog({ reps: 10, load_kg: null }), "reps_weight")).toBe(true);
  });

  it("counts timed sets with duration as logged", () => {
    expect(isSetLogged(makeLog({ reps: null, duration_seconds: 45 }), "time")).toBe(true);
  });

  it("honors legacy is_complete without metric values", () => {
    expect(isSetLogged(makeLog({ is_complete: true }), "reps_weight")).toBe(true);
  });

  it("returns false when reps_weight set has no reps", () => {
    expect(isSetLogged(makeLog({ load_kg: 50 }), "reps_weight")).toBe(false);
  });
});

describe("isSetValuesLogged", () => {
  it("mirrors isSetLogged for in-progress form values", () => {
    expect(isSetValuesLogged({ reps: 8, duration_seconds: null, load_kg: 40 }, "reps_weight")).toBe(true);
    expect(isSetValuesLogged({ reps: null, duration_seconds: null, load_kg: null }, "reps_weight")).toBe(false);
  });
});
