import { describe, expect, it } from "vitest";

import { resolveTransferExercises } from "@/lib/session-templates/transfer-resolve";
import type { SessionTemplateTransfer } from "@/lib/session-templates/transfer-schema";

const benchSets = [
  {
    prescribed_reps: 10,
    prescribed_duration_seconds: null,
    prescribed_load_kg: 50,
    rest_after_seconds: 60,
    is_warmup: false,
  },
];

const benchExercise = {
  name: "Bench Press",
  default_metric: "reps_weight" as const,
  phase: "main" as const,
  sort_order: 0,
  notes: null,
  sets: benchSets,
};

const transferBase: SessionTemplateTransfer = {
  schema_version: 1,
  kind: "session_template",
  name: "Upper A",
  description: null,
  exercises: [benchExercise],
};

const libraryExercise = {
  id: "a1000001-0000-4000-8000-000000000001",
  name: "Bench Press",
  default_metric: "reps_weight" as const,
  is_archived: false,
};

describe("resolveTransferExercises", () => {
  it("binds a matching active exercise by name", () => {
    const result = resolveTransferExercises(transferBase, [libraryExercise]);
    expect(result).toEqual({
      ok: true,
      body: {
        name: "Upper A",
        description: null,
        exercises: [
          {
            exercise_id: libraryExercise.id,
            phase: "main",
            sort_order: 0,
            notes: null,
            sets: benchSets,
          },
        ],
      },
    });
  });

  it("matches names case-insensitively with trim", () => {
    const result = resolveTransferExercises(
      {
        ...transferBase,
        exercises: [{ ...benchExercise, name: "  bench press  " }],
      },
      [libraryExercise],
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.exercises[0]?.exercise_id).toBe(libraryExercise.id);
    }
  });

  it("reports missing names", () => {
    const result = resolveTransferExercises(transferBase, []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        {
          path: "exercises.0.name",
          message: "Exercise Bench Press was not found in your library",
        },
      ]);
    }
  });

  it("reports archived matches without binding the id", () => {
    const result = resolveTransferExercises(transferBase, [{ ...libraryExercise, is_archived: true }]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        {
          path: "exercises.0.name",
          message: "Exercise Bench Press is archived and cannot be used for import",
        },
      ]);
    }
  });

  it("reports default_metric mismatches", () => {
    const result = resolveTransferExercises(transferBase, [{ ...libraryExercise, default_metric: "time" }]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain("default_metric does not match");
      expect(result.issues[0]?.path).toBe("exercises.0.default_metric");
    }
  });

  it("fails every exercise when the library is empty", () => {
    const result = resolveTransferExercises(
      {
        ...transferBase,
        exercises: [benchExercise, { ...benchExercise, name: "Squat", sort_order: 1 }],
      },
      [],
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(2);
    }
  });
});
