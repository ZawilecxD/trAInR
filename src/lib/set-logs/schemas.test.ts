import { describe, expect, it } from "vitest";
import { deleteSetLogQuerySchema, upsertSetLogBodySchema } from "@/lib/set-logs/schemas";

const validSessionExerciseId = "a1000001-0000-4000-8000-000000000001";

describe("upsertSetLogBodySchema", () => {
  it("accepts a valid reps_weight upsert payload", () => {
    const parsed = upsertSetLogBodySchema.safeParse({
      session_exercise_id: validSessionExerciseId,
      set_number: 1,
      reps: 10,
      duration_seconds: null,
      load_kg: 80,
      is_complete: true,
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts negative load_kg for assisted exercises", () => {
    const parsed = upsertSetLogBodySchema.safeParse({
      session_exercise_id: validSessionExerciseId,
      set_number: 2,
      reps: 8,
      duration_seconds: null,
      load_kg: -20,
      is_complete: false,
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts timed exercise duration when complete", () => {
    const parsed = upsertSetLogBodySchema.safeParse({
      session_exercise_id: validSessionExerciseId,
      set_number: 1,
      reps: null,
      duration_seconds: 60,
      load_kg: null,
      is_complete: true,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects completed sets without reps or duration", () => {
    const parsed = upsertSetLogBodySchema.safeParse({
      session_exercise_id: validSessionExerciseId,
      set_number: 1,
      reps: null,
      duration_seconds: null,
      load_kg: 50,
      is_complete: true,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid session_exercise_id", () => {
    const parsed = upsertSetLogBodySchema.safeParse({
      session_exercise_id: "not-a-uuid",
      set_number: 1,
      reps: 10,
      duration_seconds: null,
      load_kg: null,
      is_complete: false,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects set_number below 1", () => {
    const parsed = upsertSetLogBodySchema.safeParse({
      session_exercise_id: validSessionExerciseId,
      set_number: 0,
      reps: 10,
      duration_seconds: null,
      load_kg: null,
      is_complete: false,
    });

    expect(parsed.success).toBe(false);
  });
});

describe("deleteSetLogQuerySchema", () => {
  it("accepts valid query params", () => {
    const parsed = deleteSetLogQuerySchema.safeParse({
      session_exercise_id: validSessionExerciseId,
      set_number: "2",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.set_number).toBe(2);
    }
  });

  it("rejects invalid session_exercise_id", () => {
    const parsed = deleteSetLogQuerySchema.safeParse({
      session_exercise_id: "bad-id",
      set_number: "1",
    });

    expect(parsed.success).toBe(false);
  });
});
