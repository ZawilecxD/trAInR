import { describe, expect, it } from "vitest";
import {
  findFirstIncompleteExerciseIndex,
  getExerciseProgress,
  getSessionProgressSummary,
} from "@/lib/guided-workout/exercise-progress";
import type { SessionExerciseSet, SetLog } from "@/types";

function makeLog(setNumber: number, overrides: Partial<SetLog> = {}): SetLog {
  return {
    id: `log-${setNumber}`,
    session_exercise_id: "ex-1",
    set_number: setNumber,
    is_warmup: false,
    is_complete: false,
    reps: 8,
    duration_seconds: null,
    load_kg: 80,
    logged_at: "2026-06-14T10:00:00Z",
    ...overrides,
  };
}

function makeEmptyLog(setNumber: number, overrides: Partial<SetLog> = {}): SetLog {
  return makeLog(setNumber, {
    reps: null,
    duration_seconds: null,
    load_kg: null,
    ...overrides,
  });
}

function prescribed(count: number): SessionExerciseSet[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `set-${index + 1}`,
    session_exercise_id: "ex-1",
    set_number: index + 1,
    prescribed_reps: 8,
    prescribed_duration_seconds: null,
    prescribed_load_kg: 80,
    rest_after_seconds: 120,
    is_warmup: false,
  }));
}

describe("getExerciseProgress", () => {
  it("returns empty progress when no sets are shown", () => {
    expect(getExerciseProgress([], [])).toEqual({
      completedSets: 0,
      totalSets: 0,
      isDone: false,
      isActive: false,
    });
  });

  it("counts logged values and marks done when all sets have values", () => {
    const logs = [makeLog(1), makeLog(2), makeLog(3)];
    expect(getExerciseProgress([1, 2, 3], logs)).toEqual({
      completedSets: 3,
      totalSets: 3,
      isDone: true,
      isActive: false,
    });
  });

  it("includes extra logged rounds beyond prescription", () => {
    const logs = [makeLog(1), makeLog(2), makeLog(3), makeLog(4)];
    expect(getExerciseProgress([1, 2, 3, 4], logs)).toEqual({
      completedSets: 4,
      totalSets: 4,
      isDone: true,
      isActive: false,
    });
  });

  it("marks partial progress as not done", () => {
    const logs = [makeLog(1), makeEmptyLog(2)];
    expect(getExerciseProgress([1, 2, 3], logs)).toEqual({
      completedSets: 1,
      totalSets: 3,
      isDone: false,
      isActive: false,
    });
  });

  it("ignores historical complete flags without logged values", () => {
    const logs = [makeEmptyLog(1, { is_complete: true }), makeLog(2)];
    expect(getExerciseProgress([1, 2], logs)).toEqual({
      completedSets: 1,
      totalSets: 2,
      isDone: false,
      isActive: false,
    });
  });

  it("passes through isActive flag", () => {
    expect(getExerciseProgress([1, 2], [], true).isActive).toBe(true);
  });
});

describe("getSessionProgressSummary", () => {
  it("summarizes done, active, and remaining exercises", () => {
    const exercises = [
      { sets: prescribed(3), logs: [makeLog(1), makeLog(2), makeLog(3)] },
      { sets: prescribed(2), logs: [makeLog(1), makeLog(2)] },
      { sets: prescribed(2), logs: [makeLog(1)] },
      { sets: prescribed(1), logs: [] },
      { sets: prescribed(1), logs: [] },
    ];

    expect(getSessionProgressSummary(exercises, 2)).toEqual({
      done: 2,
      active: 1,
      remaining: 2,
    });
  });

  it("treats current exercise as done when all sets complete", () => {
    const exercises = [
      { sets: prescribed(1), logs: [makeLog(1)] },
      { sets: prescribed(1), logs: [makeLog(1)] },
    ];

    expect(getSessionProgressSummary(exercises, 1)).toEqual({
      done: 2,
      active: 0,
      remaining: 0,
    });
  });
});

describe("findFirstIncompleteExerciseIndex", () => {
  it("returns first exercise with incomplete sets", () => {
    const exercises = [
      { sets: prescribed(1), logs: [makeLog(1)] },
      { sets: prescribed(2), logs: [makeLog(1)] },
      { sets: prescribed(1), logs: [] },
    ];

    expect(findFirstIncompleteExerciseIndex(exercises)).toBe(1);
  });

  it("returns zero when all exercises are complete", () => {
    const exercises = [{ sets: prescribed(1), logs: [makeLog(1)] }];

    expect(findFirstIncompleteExerciseIndex(exercises)).toBe(0);
  });
});
