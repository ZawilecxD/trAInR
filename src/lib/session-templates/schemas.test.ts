import { describe, expect, it } from "vitest";
import {
  createTemplateBodySchema,
  templateIdParamSchema,
  updateTemplateBodySchema,
} from "@/lib/session-templates/schemas";

const validExerciseId = "a1000001-0000-4000-8000-000000000001";

const validRound = {
  prescribed_reps: 10,
  prescribed_duration_seconds: null,
  prescribed_load_kg: null,
  rest_after_seconds: 60,
};

const validExercise = {
  exercise_id: validExerciseId,
  phase: "warm_up" as const,
  sort_order: 0,
  sets: [validRound],
  notes: null,
};

describe("createTemplateBodySchema", () => {
  it("accepts a valid create payload with multi-round exercise", () => {
    const parsed = createTemplateBodySchema.safeParse({
      name: "Full Body Workout",
      description: "A comprehensive full body session",
      exercises: [
        {
          ...validExercise,
          sets: [
            { ...validRound, prescribed_reps: 10, prescribed_load_kg: 50, rest_after_seconds: 120 },
            { ...validRound, prescribed_reps: 8, prescribed_load_kg: 60, rest_after_seconds: 120 },
            { ...validRound, prescribed_reps: 6, prescribed_load_kg: 70, rest_after_seconds: 180 },
          ],
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts an empty exercises array", () => {
    const parsed = createTemplateBodySchema.safeParse({
      name: "Empty Template",
      exercises: [],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects missing required name", () => {
    const parsed = createTemplateBodySchema.safeParse({
      exercises: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects empty name string", () => {
    const parsed = createTemplateBodySchema.safeParse({
      name: "   ",
      exercises: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid phase enum value", () => {
    const parsed = createTemplateBodySchema.safeParse({
      name: "Test",
      exercises: [{ ...validExercise, phase: "invalid_phase" }],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects sort_order < 0", () => {
    const parsed = createTemplateBodySchema.safeParse({
      name: "Test",
      exercises: [{ ...validExercise, sort_order: -1 }],
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts sort_order = 0", () => {
    const parsed = createTemplateBodySchema.safeParse({
      name: "Test",
      exercises: [{ ...validExercise, sort_order: 0 }],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects empty sets array", () => {
    const parsed = createTemplateBodySchema.safeParse({
      name: "Test",
      exercises: [{ ...validExercise, sets: [] }],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects round with both prescribed_reps and prescribed_duration_seconds null", () => {
    const parsed = createTemplateBodySchema.safeParse({
      name: "Test",
      exercises: [
        {
          ...validExercise,
          sets: [
            {
              prescribed_reps: null,
              prescribed_duration_seconds: null,
              prescribed_load_kg: null,
              rest_after_seconds: null,
            },
          ],
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects more than 20 rounds", () => {
    const parsed = createTemplateBodySchema.safeParse({
      name: "Test",
      exercises: [
        {
          ...validExercise,
          sets: Array.from({ length: 21 }, () => validRound),
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects prescribed_load_kg = 0", () => {
    const parsed = createTemplateBodySchema.safeParse({
      name: "Test",
      exercises: [
        {
          ...validExercise,
          sets: [{ ...validRound, prescribed_load_kg: 0 }],
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts prescribed_load_kg > 0", () => {
    const parsed = createTemplateBodySchema.safeParse({
      name: "Test",
      exercises: [
        {
          ...validExercise,
          sets: [{ ...validRound, prescribed_load_kg: 20.5 }],
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });
});

describe("updateTemplateBodySchema", () => {
  it("rejects update with no fields", () => {
    const parsed = updateTemplateBodySchema.safeParse({});

    expect(parsed.success).toBe(false);
  });

  it("accepts update with only exercises", () => {
    const parsed = updateTemplateBodySchema.safeParse({
      exercises: [validExercise],
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts update with only name", () => {
    const parsed = updateTemplateBodySchema.safeParse({
      name: "New Name",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts update with only description", () => {
    const parsed = updateTemplateBodySchema.safeParse({
      description: "Updated description",
    });

    expect(parsed.success).toBe(true);
  });
});

describe("templateIdParamSchema", () => {
  it("rejects invalid UUIDs", () => {
    const parsed = templateIdParamSchema.safeParse("not-a-uuid");
    expect(parsed.success).toBe(false);
  });

  it("accepts valid UUIDs", () => {
    const parsed = templateIdParamSchema.safeParse("b2000001-0000-4000-8000-000000000099");
    expect(parsed.success).toBe(true);
  });
});
