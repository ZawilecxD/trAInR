import { describe, expect, it } from "vitest";
import { fillValuesFromPrescription } from "@/lib/guided-workout/fill-from-prescription";
import type { SessionExerciseSet, SetLog } from "@/types";

const prescribedSet: SessionExerciseSet = {
  id: "set-1",
  session_exercise_id: "ex-1",
  set_number: 1,
  prescribed_reps: 10,
  prescribed_duration_seconds: null,
  prescribed_load_kg: 50,
  rest_after_seconds: 90,
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
  load_kg: 40,
  logged_at: "2026-06-14T10:00:00Z",
};

describe("fillValuesFromPrescription", () => {
  it("copies prescribed reps and load for reps_weight exercises", () => {
    expect(
      fillValuesFromPrescription({
        prescribedSet,
        defaultMetric: "reps_weight",
        existingLog: undefined,
        isPrescribed: true,
      }),
    ).toEqual({
      reps: 10,
      duration_seconds: null,
      load_kg: 50,
      is_complete: false,
      is_warmup: true,
    });
  });

  it("copies prescribed duration for timed exercises", () => {
    const timedSet: SessionExerciseSet = {
      ...prescribedSet,
      prescribed_reps: null,
      prescribed_duration_seconds: 45,
      prescribed_load_kg: null,
    };

    expect(
      fillValuesFromPrescription({
        prescribedSet: timedSet,
        defaultMetric: "time",
        existingLog: undefined,
        isPrescribed: true,
      }),
    ).toEqual({
      reps: null,
      duration_seconds: 45,
      load_kg: null,
      is_complete: false,
      is_warmup: true,
    });
  });

  it("preserves existing values when no prescription is available", () => {
    expect(
      fillValuesFromPrescription({
        prescribedSet: undefined,
        defaultMetric: "reps_weight",
        existingLog,
        isPrescribed: false,
      }),
    ).toEqual({
      reps: 8,
      duration_seconds: null,
      load_kg: 40,
      is_complete: false,
      is_warmup: false,
    });
  });
});
