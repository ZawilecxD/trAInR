import { describe, expect, it } from "vitest";
import {
  createExerciseBodySchema,
  exerciseIdParamSchema,
  listExercisesQuerySchema,
  parseListExercisesQuery,
} from "@/lib/exercises/schemas";

const validMuscleGroupId = "a1000001-0000-4000-8000-000000000001";

describe("createExerciseBodySchema", () => {
  it("accepts a valid create payload", () => {
    const parsed = createExerciseBodySchema.safeParse({
      name: "Bench Press",
      exercise_type: "strength",
      default_metric: "reps_weight",
      muscle_groups: [{ muscle_group_id: validMuscleGroupId, role: "primary" }],
      notes: "Flat bench",
      video_url: "https://example.com/video",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid payloads", () => {
    const parsed = createExerciseBodySchema.safeParse({
      name: "",
      exercise_type: "invalid",
      default_metric: "reps_weight",
      muscle_groups: [],
      video_url: "not-a-url",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("listExercisesQuerySchema", () => {
  it("parses filter query combinations", () => {
    const parsed = listExercisesQuerySchema.safeParse({
      type: "strength",
      muscleGroupId: [validMuscleGroupId, "a1000001-0000-4000-8000-000000000002"],
      q: "  bench  ",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.type).toBe("strength");
      expect(parsed.data.muscleGroupId).toHaveLength(2);
      expect(parsed.data.q).toBe("bench");
    }
  });

  it("parses repeated muscleGroupId params from URLSearchParams", () => {
    const params = new URLSearchParams();
    params.append("muscleGroupId", validMuscleGroupId);
    params.append("muscleGroupId", "a1000001-0000-4000-8000-000000000002");
    params.set("type", "cardio");
    params.set("q", "run");

    const parsed = parseListExercisesQuery(params);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.muscleGroupId).toEqual([validMuscleGroupId, "a1000001-0000-4000-8000-000000000002"]);
      expect(parsed.data.type).toBe("cardio");
      expect(parsed.data.q).toBe("run");
    }
  });
});

describe("exerciseIdParamSchema", () => {
  it("rejects invalid UUIDs", () => {
    const parsed = exerciseIdParamSchema.safeParse("not-a-uuid");
    expect(parsed.success).toBe(false);
  });

  it("accepts valid UUIDs", () => {
    const parsed = exerciseIdParamSchema.safeParse("b2000001-0000-4000-8000-000000000099");
    expect(parsed.success).toBe(true);
  });
});
