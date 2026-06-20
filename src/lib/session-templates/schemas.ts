import { z } from "zod";
import type { ExerciseMetric, ExercisePhase } from "@/types";

const uuidSchema = z.uuid({ error: "Invalid UUID" });

export const exercisePhaseSchema = z.enum(["warm_up", "main", "cool_down"] satisfies [
  ExercisePhase,
  ...ExercisePhase[],
]);

export const exerciseMetricSchema = z.enum(["reps_weight", "time", "distance"] satisfies [
  ExerciseMetric,
  ...ExerciseMetric[],
]);

export const templateExerciseSetInputSchema = z
  .object({
    prescribed_reps: z.number().int().min(1, "prescribed_reps must be ≥ 1").nullable(),
    prescribed_duration_seconds: z.number().int().min(1, "prescribed_duration_seconds must be ≥ 1").nullable(),
    prescribed_load_kg: z.number().min(0, "prescribed_load_kg must be ≥ 0").nullable(),
    rest_after_seconds: z.number().int().min(0, "rest_after_seconds must be ≥ 0").nullable(),
    is_warmup: z.boolean().optional().default(false),
  })
  .refine((set) => set.prescribed_reps !== null || set.prescribed_duration_seconds !== null, {
    message: "each round needs reps or duration",
  });

export const templateExerciseInputSchema = z.object({
  exercise_id: uuidSchema,
  phase: exercisePhaseSchema,
  sort_order: z.number().int().min(0, "sort_order must be ≥ 0"),
  sets: z.array(templateExerciseSetInputSchema).min(1, "at least one round").max(20, "too many rounds"),
  notes: z.string().nullable(),
});

export const createTemplateBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  exercises: z.array(templateExerciseInputSchema),
});

export const updateTemplateBodySchema = z
  .object({
    name: z.string().trim().min(1, "Name cannot be empty").optional(),
    description: z.string().nullable().optional(),
    exercises: z.array(templateExerciseInputSchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required for update");

export const templateIdParamSchema = uuidSchema;

export type CreateTemplateBody = z.infer<typeof createTemplateBodySchema>;
export type UpdateTemplateBody = z.infer<typeof updateTemplateBodySchema>;
export type TemplateExerciseInput = z.infer<typeof templateExerciseInputSchema>;
export type TemplateExerciseSetInput = z.infer<typeof templateExerciseSetInputSchema>;

export function formatZodIssues(issues: z.core.$ZodIssue[]): {
  path: string;
  message: string;
}[] {
  return issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
