import { describe, expect, it } from "vitest";
import {
  clientSessionsQuerySchema,
  createWorkoutSessionBodySchema,
  listSessionsQuerySchema,
  sessionIdParamSchema,
  updateWorkoutSessionBodySchema,
} from "@/lib/workout-sessions/schemas";

const validExerciseId = "a1000001-0000-4000-8000-000000000001";
const validClientId = "b2000001-0000-4000-8000-000000000099";

const validRound = {
  prescribed_reps: 10,
  prescribed_duration_seconds: null,
  prescribed_load_kg: null,
  rest_after_seconds: 60,
};

const validExercise = {
  exercise_id: validExerciseId,
  phase: "main" as const,
  sort_order: 0,
  sets: [validRound],
  notes: null,
};

describe("createWorkoutSessionBodySchema", () => {
  it("accepts a valid create payload with exercises", () => {
    const parsed = createWorkoutSessionBodySchema.safeParse({
      client_id: validClientId,
      scheduled_date: "2026-06-15",
      name: "Upper Body",
      source_template_id: null,
      exercises: [validExercise],
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts an empty exercises array for blank shell", () => {
    const parsed = createWorkoutSessionBodySchema.safeParse({
      client_id: validClientId,
      scheduled_date: "2026-06-15",
      name: "Blank Session",
      source_template_id: null,
      exercises: [],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects missing required name", () => {
    const parsed = createWorkoutSessionBodySchema.safeParse({
      client_id: validClientId,
      scheduled_date: "2026-06-15",
      source_template_id: null,
      exercises: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects empty name string", () => {
    const parsed = createWorkoutSessionBodySchema.safeParse({
      client_id: validClientId,
      scheduled_date: "2026-06-15",
      name: "   ",
      source_template_id: null,
      exercises: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid scheduled_date format", () => {
    const parsed = createWorkoutSessionBodySchema.safeParse({
      client_id: validClientId,
      scheduled_date: "06/15/2026",
      name: "Test",
      source_template_id: null,
      exercises: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts negative prescribed_load_kg (assisted)", () => {
    const parsed = createWorkoutSessionBodySchema.safeParse({
      client_id: validClientId,
      scheduled_date: "2026-06-15",
      name: "Assisted Pull-ups",
      source_template_id: null,
      exercises: [
        {
          ...validExercise,
          sets: [{ ...validRound, prescribed_load_kg: -10 }],
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects round with both prescribed_reps and prescribed_duration_seconds null", () => {
    const parsed = createWorkoutSessionBodySchema.safeParse({
      client_id: validClientId,
      scheduled_date: "2026-06-15",
      name: "Test",
      source_template_id: null,
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
    const parsed = createWorkoutSessionBodySchema.safeParse({
      client_id: validClientId,
      scheduled_date: "2026-06-15",
      name: "Test",
      source_template_id: null,
      exercises: [
        {
          ...validExercise,
          sets: Array.from({ length: 21 }, () => validRound),
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("updateWorkoutSessionBodySchema", () => {
  it("rejects update with no fields", () => {
    const parsed = updateWorkoutSessionBodySchema.safeParse({});

    expect(parsed.success).toBe(false);
  });

  it("accepts update with only exercises", () => {
    const parsed = updateWorkoutSessionBodySchema.safeParse({
      exercises: [validExercise],
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts update with only scheduled_date", () => {
    const parsed = updateWorkoutSessionBodySchema.safeParse({
      scheduled_date: "2026-06-20",
    });

    expect(parsed.success).toBe(true);
  });
});

describe("listSessionsQuerySchema", () => {
  it("accepts valid query params", () => {
    const parsed = listSessionsQuerySchema.safeParse({
      client_id: validClientId,
      from: "2026-06-01",
      to: "2026-06-30",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid client_id", () => {
    const parsed = listSessionsQuerySchema.safeParse({
      client_id: "not-a-uuid",
      from: "2026-06-01",
      to: "2026-06-30",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("clientSessionsQuerySchema", () => {
  it("accepts valid date range", () => {
    const parsed = clientSessionsQuerySchema.safeParse({
      from: "2026-06-01",
      to: "2026-06-30",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects from after to", () => {
    const parsed = clientSessionsQuerySchema.safeParse({
      from: "2026-06-30",
      to: "2026-06-01",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects range exceeding 366 days", () => {
    const parsed = clientSessionsQuerySchema.safeParse({
      from: "2025-01-01",
      to: "2026-06-01",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects malformed dates", () => {
    const parsed = clientSessionsQuerySchema.safeParse({
      from: "06/01/2026",
      to: "2026-06-30",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("sessionIdParamSchema", () => {
  it("rejects invalid UUIDs", () => {
    const parsed = sessionIdParamSchema.safeParse("not-a-uuid");
    expect(parsed.success).toBe(false);
  });

  it("accepts valid UUIDs", () => {
    const parsed = sessionIdParamSchema.safeParse("b2000001-0000-4000-8000-000000000099");
    expect(parsed.success).toBe(true);
  });
});
