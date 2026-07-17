import { describe, expect, it } from "vitest";
import { resolveLogIsWarmup } from "@/lib/guided-workout/warmup-default";
import type { SessionExerciseSet, SetLog } from "@/types";

const prescribedSet: SessionExerciseSet = {
  id: "set-1",
  session_exercise_id: "ex-1",
  set_number: 1,
  prescribed_reps: 8,
  prescribed_duration_seconds: null,
  prescribed_load_kg: 80,
  rest_after_seconds: 120,
  is_warmup: true,
};

const existingLog: SetLog = {
  id: "log-1",
  session_exercise_id: "ex-1",
  set_number: 1,
  is_warmup: false,
  is_complete: true,
  reps: 8,
  duration_seconds: null,
  load_kg: 80,
  rpe: null,
  logged_at: "2026-06-20T10:00:00Z",
};

describe("resolveLogIsWarmup", () => {
  it("uses existing log value when present", () => {
    expect(
      resolveLogIsWarmup({
        existingLog,
        prescribedSet,
        isPrescribed: true,
      }),
    ).toBe(false);
  });

  it("inherits prescribed warm-up when no log exists", () => {
    expect(
      resolveLogIsWarmup({
        existingLog: undefined,
        prescribedSet,
        isPrescribed: true,
      }),
    ).toBe(true);
  });

  it("defaults extra rounds to working", () => {
    expect(
      resolveLogIsWarmup({
        existingLog: undefined,
        prescribedSet: undefined,
        isPrescribed: false,
      }),
    ).toBe(false);
  });
});
