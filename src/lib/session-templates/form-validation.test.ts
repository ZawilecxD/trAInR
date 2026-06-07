import { describe, expect, it } from "vitest";
import {
  addRound,
  assembleTemplatePayload,
  defaultMetricMode,
  emptyPhaseEntries,
  exerciseEntryToPayload,
  exerciseToFormEntry,
  removeRound,
  templateExerciseToFormEntry,
  updateRound,
  type TemplateExerciseFormEntry,
} from "@/lib/session-templates/form-validation";
import type { TemplateExerciseWithName } from "@/lib/session-templates/service";

const exerciseId = "e2000001-0000-4000-8000-000000000001";

function makeEntry(overrides: Partial<TemplateExerciseFormEntry> = {}): TemplateExerciseFormEntry {
  return {
    exerciseId,
    exerciseName: "Bench Press",
    exerciseDefaultMetric: "reps_weight",
    phase: "main",
    metricMode: "reps",
    rounds: [
      {
        prescribedReps: 10,
        prescribedDuration: null,
        prescribedLoadKg: null,
        restAfterSeconds: null,
      },
    ],
    notes: "",
    ...overrides,
  };
}

function makeTemplateExercise(overrides: Partial<TemplateExerciseWithName> = {}): TemplateExerciseWithName {
  return {
    id: "a4000001-0000-4000-8000-000000000001",
    template_id: "a3000001-0000-4000-8000-000000000001",
    exercise_id: exerciseId,
    phase: "main",
    sort_order: 0,
    notes: null,
    exercise_name: "Bench Press",
    exercise_default_metric: "reps_weight",
    sets: [
      {
        id: "a5000001-0000-4000-8000-000000000001",
        template_exercise_id: "a4000001-0000-4000-8000-000000000001",
        set_number: 1,
        prescribed_reps: 10,
        prescribed_duration_seconds: null,
        prescribed_load_kg: 50,
        rest_after_seconds: 120,
      },
      {
        id: "a5000001-0000-4000-8000-000000000002",
        template_exercise_id: "a4000001-0000-4000-8000-000000000001",
        set_number: 2,
        prescribed_reps: 8,
        prescribed_duration_seconds: null,
        prescribed_load_kg: 60,
        rest_after_seconds: 120,
      },
    ],
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
});

describe("exerciseToFormEntry", () => {
  it("seeds one default round", () => {
    const entry = exerciseToFormEntry(
      {
        id: exerciseId,
        name: "Bench Press",
        default_metric: "reps_weight",
      } as never,
      "main",
    );

    expect(entry.rounds).toHaveLength(1);
    expect(entry.rounds[0]?.prescribedReps).toBe(10);
    expect(entry.rounds[0]?.prescribedDuration).toBeNull();
  });
});

describe("templateExerciseToFormEntry", () => {
  it("rebuilds rounds and infers reps metricMode", () => {
    const entry = templateExerciseToFormEntry(makeTemplateExercise());

    expect(entry.rounds).toHaveLength(2);
    expect(entry.rounds[0]?.prescribedReps).toBe(10);
    expect(entry.rounds[1]?.prescribedLoadKg).toBe(60);
    expect(entry.metricMode).toBe("reps");
  });

  it("infers duration metricMode from timed rounds", () => {
    const entry = templateExerciseToFormEntry(
      makeTemplateExercise({
        exercise_default_metric: "time",
        sets: [
          {
            id: "a5000001-0000-4000-8000-000000000003",
            template_exercise_id: "a4000001-0000-4000-8000-000000000001",
            set_number: 1,
            prescribed_reps: null,
            prescribed_duration_seconds: 45,
            prescribed_load_kg: null,
            rest_after_seconds: 30,
          },
        ],
      }),
    );

    expect(entry.metricMode).toBe("duration");
    expect(entry.rounds[0]?.prescribedDuration).toBe(45);
  });
});

describe("exerciseEntryToPayload", () => {
  it("emits per-round sets with reps nulling in duration mode", () => {
    const payload = exerciseEntryToPayload(
      makeEntry({
        metricMode: "duration",
        rounds: [
          {
            prescribedReps: null,
            prescribedDuration: 45,
            prescribedLoadKg: 20,
            restAfterSeconds: 60,
          },
          {
            prescribedReps: null,
            prescribedDuration: 30,
            prescribedLoadKg: null,
            restAfterSeconds: 45,
          },
        ],
        notes: "  hold steady  ",
      }),
      0,
    );

    expect(payload.sets).toHaveLength(2);
    expect(payload.sets[0]?.prescribed_reps).toBeNull();
    expect(payload.sets[0]?.prescribed_duration_seconds).toBe(45);
    expect(payload.sets[1]?.prescribed_duration_seconds).toBe(30);
    expect(payload.notes).toBe("hold steady");
  });
});

describe("round helpers", () => {
  it("addRound duplicates the last round", () => {
    const entry = makeEntry({
      rounds: [
        {
          prescribedReps: 10,
          prescribedDuration: null,
          prescribedLoadKg: 50,
          restAfterSeconds: 120,
        },
      ],
    });

    const next = addRound(entry);

    expect(next.rounds).toHaveLength(2);
    expect(next.rounds[1]).toEqual(entry.rounds[0]);
  });

  it("removeRound keeps at least one round", () => {
    const single = removeRound(makeEntry(), 0);
    expect(single.rounds).toHaveLength(1);

    const entry = makeEntry({
      rounds: [
        {
          prescribedReps: 10,
          prescribedDuration: null,
          prescribedLoadKg: null,
          restAfterSeconds: null,
        },
        {
          prescribedReps: 8,
          prescribedDuration: null,
          prescribedLoadKg: null,
          restAfterSeconds: null,
        },
      ],
    });

    const next = removeRound(entry, 1);
    expect(next.rounds).toHaveLength(1);
    expect(next.rounds[0]?.prescribedReps).toBe(10);
  });

  it("updateRound patches a single round", () => {
    const entry = updateRound(makeEntry(), 0, { prescribedReps: 12, prescribedLoadKg: 40 });
    expect(entry.rounds[0]?.prescribedReps).toBe(12);
    expect(entry.rounds[0]?.prescribedLoadKg).toBe(40);
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
});
