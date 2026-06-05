import { describe, expect, it } from "vitest";
import {
  assembleTemplatePayload,
  defaultMetricMode,
  emptyPhaseEntries,
  exerciseEntryToPayload,
  type TemplateExerciseFormEntry,
} from "@/lib/session-templates/form-validation";

const exerciseId = "e2000001-0000-4000-8000-000000000001";

function makeEntry(overrides: Partial<TemplateExerciseFormEntry> = {}): TemplateExerciseFormEntry {
  return {
    exerciseId,
    exerciseName: "Bench Press",
    exerciseDefaultMetric: "reps_weight",
    phase: "main",
    prescribedSets: 3,
    metricMode: "reps",
    prescribedReps: 10,
    prescribedDuration: null,
    prescribedLoadKg: null,
    restAfterSeconds: null,
    notes: "",
    ...overrides,
  };
}

describe("defaultMetricMode", () => {
  it('returns "reps" for reps_weight', () => {
    expect(defaultMetricMode({ default_metric: "reps_weight" })).toBe("reps");
  });

  it('returns "duration" for time', () => {
    expect(defaultMetricMode({ default_metric: "time" })).toBe("duration");
  });

  it('returns "duration" for distance', () => {
    expect(defaultMetricMode({ default_metric: "distance" })).toBe("duration");
  });
});

describe("exerciseEntryToPayload", () => {
  it("maps reps mode with null duration", () => {
    const payload = exerciseEntryToPayload(makeEntry({ metricMode: "reps", prescribedReps: 12 }), 2);

    expect(payload).toEqual({
      exercise_id: exerciseId,
      phase: "main",
      sort_order: 2,
      prescribed_sets: 3,
      prescribed_reps: 12,
      prescribed_duration_seconds: null,
      prescribed_load_kg: null,
      rest_after_seconds: null,
      notes: null,
    });
  });

  it("maps duration mode with null reps", () => {
    const payload = exerciseEntryToPayload(
      makeEntry({
        metricMode: "duration",
        prescribedReps: null,
        prescribedDuration: 45,
        prescribedLoadKg: 20,
        restAfterSeconds: 60,
        notes: "  hold steady  ",
      }),
      0,
    );

    expect(payload.prescribed_reps).toBeNull();
    expect(payload.prescribed_duration_seconds).toBe(45);
    expect(payload.prescribed_load_kg).toBe(20);
    expect(payload.rest_after_seconds).toBe(60);
    expect(payload.notes).toBe("hold steady");
  });
});

describe("assembleTemplatePayload", () => {
  it("assigns sort_order independently per phase starting at 0", () => {
    const phaseEntries = emptyPhaseEntries();
    phaseEntries.warm_up.push(makeEntry({ phase: "warm_up", exerciseName: "Jump Rope" }));
    phaseEntries.main.push(
      makeEntry({ phase: "main", exerciseName: "Squat" }),
      makeEntry({ phase: "main", exerciseId: "e2000001-0000-4000-8000-000000000002", exerciseName: "Lunge" }),
    );
    phaseEntries.cool_down.push(makeEntry({ phase: "cool_down", exerciseName: "Stretch" }));

    const payload = assembleTemplatePayload("Leg day", "", phaseEntries);

    expect(payload.exercises).toHaveLength(4);
    expect(payload.exercises.map((row) => ({ phase: row.phase, sort_order: row.sort_order }))).toEqual([
      { phase: "warm_up", sort_order: 0 },
      { phase: "main", sort_order: 0 },
      { phase: "main", sort_order: 1 },
      { phase: "cool_down", sort_order: 0 },
    ]);
  });

  it("allows empty exercises array", () => {
    const payload = assembleTemplatePayload("Empty shell", "No exercises yet", emptyPhaseEntries());

    expect(payload.exercises).toEqual([]);
    expect(payload.name).toBe("Empty shell");
    expect(payload.description).toBe("No exercises yet");
  });
});
