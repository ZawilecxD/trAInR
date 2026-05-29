import { z } from "zod";
import type { ExerciseMetric, ExerciseType, MuscleRole } from "@/types";

const uuidSchema = z.uuid({ error: "Invalid UUID" });

export const exerciseTypeSchema = z.enum(["strength", "cardio", "flexibility", "other"] satisfies [
  ExerciseType,
  ...ExerciseType[],
]);

export const exerciseMetricSchema = z.enum(["reps_weight", "time", "distance"] satisfies [
  ExerciseMetric,
  ...ExerciseMetric[],
]);

export const muscleRoleSchema = z.enum(["primary", "secondary"] satisfies [MuscleRole, ...MuscleRole[]]);

export const exerciseMuscleGroupInputSchema = z.object({
  muscle_group_id: uuidSchema,
  role: muscleRoleSchema,
});

export const createExerciseBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  exercise_type: exerciseTypeSchema,
  default_metric: exerciseMetricSchema,
  muscle_groups: z.array(exerciseMuscleGroupInputSchema).min(1, "At least one muscle group is required"),
  notes: z.string().nullable().optional(),
  video_url: z.url("Invalid video URL").nullable().optional(),
});

export const updateExerciseBodySchema = z
  .object({
    name: z.string().trim().min(1, "Name cannot be empty").optional(),
    exercise_type: exerciseTypeSchema.optional(),
    default_metric: exerciseMetricSchema.optional(),
    muscle_groups: z.array(exerciseMuscleGroupInputSchema).min(1).optional(),
    notes: z.string().nullable().optional(),
    video_url: z.url("Invalid video URL").nullable().optional(),
    is_archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required for update");

export const exerciseIdParamSchema = uuidSchema;

export const listExercisesQuerySchema = z.object({
  type: exerciseTypeSchema.optional(),
  muscleGroupId: z
    .union([uuidSchema, z.array(uuidSchema)])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return Array.isArray(value) ? value : [value];
    }),
  q: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : undefined;
    }),
});

export type CreateExerciseBody = z.infer<typeof createExerciseBodySchema>;
export type UpdateExerciseBody = z.infer<typeof updateExerciseBodySchema>;
export type ListExercisesQuery = z.infer<typeof listExercisesQuerySchema>;

export function parseListExercisesQuery(searchParams: URLSearchParams):
  | {
      success: true;
      data: ListExercisesQuery;
    }
  | {
      success: false;
      issues: z.core.$ZodIssue[];
    } {
  const muscleGroupIds = searchParams.getAll("muscleGroupId");
  const raw = {
    type: searchParams.get("type") ?? undefined,
    muscleGroupId:
      muscleGroupIds.length === 0 ? undefined : muscleGroupIds.length === 1 ? muscleGroupIds[0] : muscleGroupIds,
    q: searchParams.get("q") ?? undefined,
  };

  const parsed = listExercisesQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, issues: parsed.error.issues };
  }

  return { success: true, data: parsed.data };
}

export function formatZodIssues(issues: z.core.$ZodIssue[]): {
  path: string;
  message: string;
}[] {
  return issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
