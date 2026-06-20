import { z } from "zod";
import { exercisePhaseSchema, formatZodIssues } from "@/lib/session-templates/schemas";

export { formatZodIssues };

const uuidSchema = z.uuid({ error: "Invalid UUID" });

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date (expected YYYY-MM-DD)");

export const sessionExerciseSetInputSchema = z
  .object({
    prescribed_reps: z.number().int().min(1, "prescribed_reps must be ≥ 1").nullable(),
    prescribed_duration_seconds: z.number().int().min(1, "prescribed_duration_seconds must be ≥ 1").nullable(),
    prescribed_load_kg: z.number().nullable(),
    rest_after_seconds: z.number().int().min(0, "rest_after_seconds must be ≥ 0").nullable(),
    is_warmup: z.boolean().optional().default(false),
  })
  .refine((set) => set.prescribed_reps !== null || set.prescribed_duration_seconds !== null, {
    message: "each round needs reps or duration",
  });

export const sessionExerciseInputSchema = z.object({
  exercise_id: uuidSchema,
  phase: exercisePhaseSchema,
  sort_order: z.number().int().min(0, "sort_order must be ≥ 0"),
  sets: z.array(sessionExerciseSetInputSchema).min(1, "at least one round").max(20, "too many rounds"),
  notes: z.string().nullable(),
});

export const createWorkoutSessionBodySchema = z.object({
  client_id: uuidSchema,
  scheduled_date: isoDateSchema,
  name: z.string().trim().min(1, "Name is required"),
  source_template_id: uuidSchema.nullable(),
  exercises: z.array(sessionExerciseInputSchema).max(50, "too many exercises"),
});

export const updateWorkoutSessionBodySchema = z
  .object({
    scheduled_date: isoDateSchema.optional(),
    name: z.string().trim().min(1, "Name cannot be empty").optional(),
    exercises: z.array(sessionExerciseInputSchema).max(50, "too many exercises").optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required for update");

export const listSessionsQuerySchema = z
  .object({
    client_id: uuidSchema,
    from: isoDateSchema,
    to: isoDateSchema,
  })
  .refine((q) => q.from <= q.to, { message: "from must be on or before to" })
  .refine((q) => new Date(q.to).getTime() - new Date(q.from).getTime() <= 366 * 24 * 60 * 60 * 1000, {
    message: "date range cannot exceed 366 days",
  });

export const clientSessionsQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
  })
  .refine((q) => q.from <= q.to, { message: "from must be on or before to" })
  .refine((q) => new Date(q.to).getTime() - new Date(q.from).getTime() <= 366 * 24 * 60 * 60 * 1000, {
    message: "date range cannot exceed 366 days",
  });

export const sessionIdParamSchema = uuidSchema;

export type CreateWorkoutSessionBody = z.infer<typeof createWorkoutSessionBodySchema>;
export type UpdateWorkoutSessionBody = z.infer<typeof updateWorkoutSessionBodySchema>;
export type SessionExerciseInput = z.infer<typeof sessionExerciseInputSchema>;
export type SessionExerciseSetInput = z.infer<typeof sessionExerciseSetInputSchema>;
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;
export type ClientSessionsQuery = z.infer<typeof clientSessionsQuerySchema>;
