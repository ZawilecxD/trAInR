import { describe, expect, it } from "vitest";
import {
  emptyExerciseFormValues,
  exerciseToFormValues,
  validateCreateForm,
  validateUpdateForm,
} from "@/lib/exercises/form-validation";

const chestId = "a1000001-0000-4000-8000-000000000001";

describe("validateCreateForm", () => {
  it("accepts valid create values", () => {
    const values = {
      ...emptyExerciseFormValues(),
      name: "Bench Press",
      muscle_groups: [{ muscle_group_id: chestId, role: "primary" as const }],
    };

    const result = validateCreateForm(values);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Bench Press");
      expect(result.data.muscle_groups).toHaveLength(1);
    }
  });

  it("rejects invalid create values", () => {
    const result = validateCreateForm(emptyExerciseFormValues());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.name ?? result.errors.muscle_groups).toBeTruthy();
    }
  });
});

describe("validateUpdateForm", () => {
  it("builds a partial update payload for changed fields", () => {
    const initial = {
      ...emptyExerciseFormValues(),
      name: "Bench Press",
      muscle_groups: [{ muscle_group_id: chestId, role: "primary" as const }],
    };
    const updated = { ...initial, name: "Incline Bench Press" };

    const result = validateUpdateForm(updated, initial);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Incline Bench Press" });
    }
  });

  it("rejects updates with no changes", () => {
    const initial = {
      ...emptyExerciseFormValues(),
      name: "Bench Press",
      muscle_groups: [{ muscle_group_id: chestId, role: "primary" as const }],
    };

    const result = validateUpdateForm(initial, initial);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.form).toBe("No changes to save");
    }
  });
});

describe("exerciseToFormValues", () => {
  it("maps nullable exercise fields to form strings", () => {
    const values = exerciseToFormValues({
      name: "Row",
      exercise_type: "strength",
      default_metric: "reps_weight",
      notes: null,
      video_url: "https://example.com/video",
      muscle_groups: [{ muscle_group_id: chestId, role: "secondary" }],
    });

    expect(values.notes).toBe("");
    expect(values.video_url).toBe("https://example.com/video");
    expect(values.muscle_groups[0]?.role).toBe("secondary");
  });
});
