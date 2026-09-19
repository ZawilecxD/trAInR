import { describe, expect, it } from "vitest";

import { parseSessionTemplateTransfer, sessionTemplateTransferSchema } from "@/lib/session-templates/transfer-schema";

const validSet = {
  prescribed_reps: 10,
  prescribed_duration_seconds: null,
  prescribed_load_kg: 50,
  rest_after_seconds: 60,
  is_warmup: false,
};

const validExercise = {
  name: "Bench Press",
  default_metric: "reps_weight" as const,
  phase: "main" as const,
  sort_order: 0,
  notes: null,
  sets: [validSet],
};

const validTransfer = {
  schema_version: 1 as const,
  kind: "session_template" as const,
  name: "Upper A",
  description: null,
  exercises: [validExercise],
};

describe("sessionTemplateTransferSchema", () => {
  it("accepts a valid transfer document", () => {
    const parsed = sessionTemplateTransferSchema.safeParse(validTransfer);
    expect(parsed.success).toBe(true);
  });

  it("rejects exercise_id UUID fields on exercises", () => {
    const parsed = sessionTemplateTransferSchema.safeParse({
      ...validTransfer,
      exercises: [
        {
          ...validExercise,
          exercise_id: "a1000001-0000-4000-8000-000000000001",
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects more than 50 exercises", () => {
    const parsed = sessionTemplateTransferSchema.safeParse({
      ...validTransfer,
      exercises: Array.from({ length: 51 }, (_, sort_order) => ({
        ...validExercise,
        name: `Exercise ${sort_order}`,
        sort_order,
      })),
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects more than 20 sets on an exercise", () => {
    const parsed = sessionTemplateTransferSchema.safeParse({
      ...validTransfer,
      exercises: [
        {
          ...validExercise,
          sets: Array.from({ length: 21 }, () => validSet),
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a set missing both reps and duration", () => {
    const parsed = sessionTemplateTransferSchema.safeParse({
      ...validTransfer,
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

  it("rejects wrong schema_version and unknown envelope keys", () => {
    expect(
      sessionTemplateTransferSchema.safeParse({
        ...validTransfer,
        schema_version: 2,
      }).success,
    ).toBe(false);

    expect(
      sessionTemplateTransferSchema.safeParse({
        ...validTransfer,
        extra: true,
      }).success,
    ).toBe(false);
  });
});

describe("parseSessionTemplateTransfer", () => {
  it("returns typed issues for invalid input", () => {
    const result = parseSessionTemplateTransfer({ kind: "session_template" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
      const first = result.issues[0];
      expect(typeof first.path).toBe("string");
      expect(typeof first.message).toBe("string");
    }
  });
});
