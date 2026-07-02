import { describe, expect, it } from "vitest";
import {
  deriveExerciseReadout,
  deriveReadoutStatus,
  deriveSessionReadout,
  deriveSetReadouts,
  getLatestLogTimestamp,
  readoutStatusLabel,
  resolveLastActivityAt,
  type ExerciseReadoutInput,
} from "@/lib/trainer-dashboard/readout";
import type { SessionExerciseSet, SetLog } from "@/types";

function makePrescribedSet(
  overrides: Partial<SessionExerciseSet> & Pick<SessionExerciseSet, "set_number">,
): SessionExerciseSet {
  return {
    id: `prescribed-${overrides.set_number}`,
    session_exercise_id: "session-exercise-1",
    prescribed_reps: 8,
    prescribed_duration_seconds: null,
    prescribed_load_kg: 80,
    rest_after_seconds: 120,
    is_warmup: false,
    ...overrides,
  };
}

function makeLog(overrides: Partial<SetLog> & Pick<SetLog, "set_number">): SetLog {
  return {
    id: `log-${overrides.set_number}`,
    session_exercise_id: "session-exercise-1",
    is_warmup: false,
    is_complete: true,
    reps: 8,
    duration_seconds: null,
    load_kg: 80,
    rpe: null,
    logged_at: "2026-06-20T10:00:00.000Z",
    ...overrides,
  };
}

function makeExercise(overrides: Partial<ExerciseReadoutInput> = {}): ExerciseReadoutInput {
  return {
    id: "session-exercise-1",
    exercise_id: "exercise-1",
    phase: "main",
    sort_order: 0,
    exercise_name: "Back Squat",
    exercise_default_metric: "reps_weight",
    sets: [makePrescribedSet({ set_number: 1 }), makePrescribedSet({ set_number: 2 })],
    logs: [],
    ...overrides,
  };
}

describe("deriveReadoutStatus", () => {
  it("returns not_logged when no prescribed sets or no completed sets", () => {
    expect(deriveReadoutStatus(0, 0)).toBe("not_logged");
    expect(deriveReadoutStatus(0, 3)).toBe("not_logged");
  });

  it("returns in_progress when some but not all sets are complete", () => {
    expect(deriveReadoutStatus(1, 3)).toBe("in_progress");
  });

  it("returns fully_logged when all prescribed sets are complete", () => {
    expect(deriveReadoutStatus(3, 3)).toBe("fully_logged");
  });
});

describe("deriveSetReadouts", () => {
  it("returns not_logged sets when no logs exist", () => {
    const prescribed = [makePrescribedSet({ set_number: 1 }), makePrescribedSet({ set_number: 2 })];
    const readouts = deriveSetReadouts(prescribed, [], "reps_weight");

    expect(readouts).toHaveLength(2);
    expect(readouts[0]).toMatchObject({ setNumber: 1, isComplete: false, log: null });
    expect(readouts[1]).toMatchObject({ setNumber: 2, isComplete: false, log: null });
  });

  it("marks complete logs and keeps missing prescribed sets incomplete", () => {
    const prescribed = [makePrescribedSet({ set_number: 1 }), makePrescribedSet({ set_number: 2 })];
    const logs = [makeLog({ set_number: 1, is_complete: true })];
    const readouts = deriveSetReadouts(prescribed, logs, "reps_weight");

    expect(readouts[0].isComplete).toBe(true);
    expect(readouts[1].isComplete).toBe(false);
  });

  it("includes extra logged sets beyond prescription", () => {
    const prescribed = [makePrescribedSet({ set_number: 1 })];
    const logs = [makeLog({ set_number: 1 }), makeLog({ set_number: 2, reps: 6 })];
    const readouts = deriveSetReadouts(prescribed, logs, "reps_weight");

    expect(readouts).toHaveLength(2);
    expect(readouts[1]).toMatchObject({ setNumber: 2, prescribed: null, isComplete: true });
  });
});

describe("deriveExerciseReadout", () => {
  it("returns not_logged when no logs exist", () => {
    const readout = deriveExerciseReadout(makeExercise());

    expect(readout.status).toBe("not_logged");
    expect(readout.completedSets).toBe(0);
    expect(readout.totalSets).toBe(2);
  });

  it("returns in_progress for partial logs", () => {
    const readout = deriveExerciseReadout(
      makeExercise({
        logs: [
          makeLog({ set_number: 1, is_complete: true }),
          makeLog({ set_number: 2, is_complete: false, reps: null, load_kg: null }),
        ],
      }),
    );

    expect(readout.status).toBe("in_progress");
    expect(readout.completedSets).toBe(1);
  });

  it("returns fully_logged when all prescribed sets are complete", () => {
    const readout = deriveExerciseReadout(
      makeExercise({
        logs: [makeLog({ set_number: 1 }), makeLog({ set_number: 2 })],
      }),
    );

    expect(readout.status).toBe("fully_logged");
    expect(readout.completedSets).toBe(2);
  });

  it("treats extra logged sets as complete without blocking full completion", () => {
    const readout = deriveExerciseReadout(
      makeExercise({
        sets: [makePrescribedSet({ set_number: 1 })],
        logs: [makeLog({ set_number: 1 }), makeLog({ set_number: 2, reps: 6 })],
      }),
    );

    expect(readout.status).toBe("fully_logged");
    expect(readout.totalSets).toBe(2);
    expect(readout.completedSets).toBe(2);
  });
});

describe("deriveSessionReadout", () => {
  it("aggregates across exercises and sorts by phase then sort order", () => {
    const summary = deriveSessionReadout([
      makeExercise({
        id: "main-1",
        phase: "main",
        sort_order: 1,
        exercise_name: "Bench Press",
        logs: [makeLog({ set_number: 1 }), makeLog({ set_number: 2 })],
      }),
      makeExercise({
        id: "warmup-1",
        phase: "warm_up",
        sort_order: 0,
        exercise_name: "Band Pull-apart",
        sets: [makePrescribedSet({ set_number: 1 })],
        logs: [],
      }),
    ]);

    expect(summary.status).toBe("in_progress");
    expect(summary.completedSets).toBe(2);
    expect(summary.totalSets).toBe(3);
    expect(summary.exercises[0].exerciseName).toBe("Band Pull-apart");
    expect(summary.exercises[1].exerciseName).toBe("Bench Press");
  });

  it("returns fully_logged when every prescribed set is complete", () => {
    const summary = deriveSessionReadout([
      makeExercise({
        logs: [makeLog({ set_number: 1 }), makeLog({ set_number: 2 })],
      }),
    ]);

    expect(summary.status).toBe("fully_logged");
    expect(summary.statusLabel).toBe(readoutStatusLabel("fully_logged"));
  });
});

describe("activity timestamps", () => {
  it("returns the latest logged_at timestamp", () => {
    const latest = getLatestLogTimestamp([
      makeLog({ set_number: 1, logged_at: "2026-06-20T09:00:00.000Z" }),
      makeLog({ set_number: 2, logged_at: "2026-06-20T11:00:00.000Z" }),
    ]);

    expect(latest).toBe("2026-06-20T11:00:00.000Z");
  });

  it("prefers the later of started_at and latest log timestamp", () => {
    expect(resolveLastActivityAt("2026-06-20T12:00:00.000Z", [makeLog({ set_number: 1 })])).toBe(
      "2026-06-20T12:00:00.000Z",
    );
    expect(resolveLastActivityAt("2026-06-20T08:00:00.000Z", [makeLog({ set_number: 1 })])).toBe(
      "2026-06-20T10:00:00.000Z",
    );
  });
});
