import { z } from "zod";

const uuidSchema = z.uuid({ error: "Invalid UUID" });

export const upsertSetLogBodySchema = z.object({
  session_exercise_id: uuidSchema,
  set_number: z.number().int().min(1, "set_number must be ≥ 1"),
  reps: z.number().int().nullable(),
  duration_seconds: z.number().int().nullable(),
  load_kg: z.number().nullable(),
  rpe: z.number().int().min(1).max(10).nullable().default(null),
  is_complete: z.boolean(),
  is_warmup: z.boolean(),
});

export type UpsertSetLogBody = z.infer<typeof upsertSetLogBodySchema>;

export const deleteSetLogQuerySchema = z.object({
  session_exercise_id: uuidSchema,
  set_number: z.coerce.number().int().min(1, "set_number must be ≥ 1"),
});

export type DeleteSetLogQuery = z.infer<typeof deleteSetLogQuerySchema>;
