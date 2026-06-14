import { describe, expect, it } from "vitest";
import {
  findFirstIncompleteSetNumber,
  getLoggingSetNumbers,
  getNextSetNumber,
  isPrescribedSetNumber,
} from "@/lib/guided-workout/logging-sets";
import type { SessionExerciseSet, SetLog } from "@/types";

function prescribed(setNumber: number): SessionExerciseSet {
  return {
    id: `set-${setNumber}`,
    session_exercise_id: "ex-1",
    set_number: setNumber,
    prescribed_reps: 8,
    prescribed_duration_seconds: null,
    prescribed_load_kg: 80,
    rest_after_seconds: 120,
  };
}

function log(setNumber: number, isComplete = false): SetLog {
  return {
    id: `log-${setNumber}`,
    session_exercise_id: "ex-1",
    set_number: setNumber,
    is_warmup: false,
    is_complete: isComplete,
    reps: 8,
    duration_seconds: null,
    load_kg: 80,
    logged_at: "2026-06-14T10:00:00Z",
  };
}

describe("getLoggingSetNumbers", () => {
  it("merges prescribed, logged, and additional set numbers", () => {
    expect(getLoggingSetNumbers([prescribed(1), prescribed(2)], [log(4)], [3])).toEqual([1, 2, 3, 4]);
  });

  it("returns next set number after the highest known set", () => {
    expect(getNextSetNumber([1, 2, 3])).toBe(4);
    expect(getNextSetNumber([])).toBe(1);
  });

  it("detects prescribed set numbers", () => {
    expect(isPrescribedSetNumber([prescribed(1), prescribed(2)], 2)).toBe(true);
    expect(isPrescribedSetNumber([prescribed(1), prescribed(2)], 3)).toBe(false);
  });

  it("finds the first incomplete set number", () => {
    expect(findFirstIncompleteSetNumber([1, 2, 3], [log(1, true)])).toBe(2);
  });
});
