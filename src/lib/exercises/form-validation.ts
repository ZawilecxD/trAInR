import {
  createExerciseBodySchema,
  updateExerciseBodySchema,
  type CreateExerciseBody,
  type UpdateExerciseBody,
} from "@/lib/exercises/schemas";
import type { ExerciseMetric, ExerciseType, MuscleRole } from "@/types";

export interface ExerciseFormValues {
  name: string;
  exercise_type: ExerciseType;
  default_metric: ExerciseMetric;
  muscle_groups: { muscle_group_id: string; role: MuscleRole }[];
  notes: string;
  video_url: string;
  is_favourite: boolean;
}

export type FormFieldErrors = Partial<Record<keyof ExerciseFormValues | "form", string>>;

export function emptyExerciseFormValues(): ExerciseFormValues {
  return {
    name: "",
    exercise_type: "strength",
    default_metric: "reps_weight",
    muscle_groups: [],
    notes: "",
    video_url: "",
    is_favourite: false,
  };
}

function toCreatePayload(values: ExerciseFormValues): CreateExerciseBody {
  return {
    name: values.name,
    exercise_type: values.exercise_type,
    default_metric: values.default_metric,
    muscle_groups: values.muscle_groups,
    notes: values.notes.trim().length > 0 ? values.notes : null,
    video_url: values.video_url.trim().length > 0 ? values.video_url : null,
  };
}

function serializeMuscleGroups(groups: ExerciseFormValues["muscle_groups"]): string {
  return groups
    .map((group) => `${group.muscle_group_id}:${group.role}`)
    .sort()
    .join("|");
}

function toUpdatePayload(values: ExerciseFormValues, initial: ExerciseFormValues): UpdateExerciseBody {
  const payload: UpdateExerciseBody = {};

  if (values.name !== initial.name) payload.name = values.name;
  if (values.exercise_type !== initial.exercise_type) payload.exercise_type = values.exercise_type;
  if (values.default_metric !== initial.default_metric) payload.default_metric = values.default_metric;
  if (values.notes !== initial.notes) payload.notes = values.notes.trim().length > 0 ? values.notes : null;
  if (values.video_url !== initial.video_url) {
    payload.video_url = values.video_url.trim().length > 0 ? values.video_url : null;
  }

  if (serializeMuscleGroups(values.muscle_groups) !== serializeMuscleGroups(initial.muscle_groups)) {
    payload.muscle_groups = values.muscle_groups;
  }

  if (values.is_favourite !== initial.is_favourite) {
    payload.is_favourite = values.is_favourite;
  }

  return payload;
}

function issuesToFieldErrors(issues: { path: string; message: string }[]): FormFieldErrors {
  const errors: FormFieldErrors = {};

  for (const issue of issues) {
    const field = issue.path.split(".")[0];
    if (
      field === "name" ||
      field === "exercise_type" ||
      field === "default_metric" ||
      field === "notes" ||
      field === "video_url"
    ) {
      errors[field] = issue.message;
    } else if (field === "muscle_groups") {
      errors.muscle_groups = issue.message;
    } else {
      errors.form ??= issue.message;
    }
  }

  return errors;
}

export function validateCreateForm(
  values: ExerciseFormValues,
): { success: true; data: CreateExerciseBody } | { success: false; errors: FormFieldErrors } {
  const parsed = createExerciseBodySchema.safeParse(toCreatePayload(values));
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  return {
    success: false,
    errors: issuesToFieldErrors(
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    ),
  };
}

export function validateUpdateForm(
  values: ExerciseFormValues,
  initial: ExerciseFormValues,
): { success: true; data: UpdateExerciseBody } | { success: false; errors: FormFieldErrors } {
  const payload = toUpdatePayload(values, initial);

  if (Object.keys(payload).length === 0) {
    return { success: false, errors: { form: "No changes to save" } };
  }

  const parsed = updateExerciseBodySchema.safeParse(payload);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  return {
    success: false,
    errors: issuesToFieldErrors(
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    ),
  };
}

export function exerciseToFormValues(exercise: {
  name: string;
  exercise_type: ExerciseType;
  default_metric: ExerciseMetric;
  notes: string | null;
  video_url: string | null;
  is_favourite?: boolean;
  muscle_groups: { muscle_group_id: string; role: MuscleRole }[];
}): ExerciseFormValues {
  return {
    name: exercise.name,
    exercise_type: exercise.exercise_type,
    default_metric: exercise.default_metric,
    muscle_groups: exercise.muscle_groups.map((group) => ({
      muscle_group_id: group.muscle_group_id,
      role: group.role,
    })),
    notes: exercise.notes ?? "",
    video_url: exercise.video_url ?? "",
    is_favourite: exercise.is_favourite ?? false,
  };
}
