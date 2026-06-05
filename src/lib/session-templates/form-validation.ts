import {
  createTemplateBodySchema,
  type CreateTemplateBody,
  type TemplateExerciseInput,
  type UpdateTemplateBody,
} from "@/lib/session-templates/schemas";
import type { TemplateExerciseWithName } from "@/lib/session-templates/service";
import type { ExerciseWithMuscleGroups } from "@/lib/exercises/service";
import type { ExerciseMetric, ExercisePhase } from "@/types";

export type MetricMode = "reps" | "duration";

export interface TemplateExerciseFormEntry {
  exerciseId: string;
  exerciseName: string;
  exerciseDefaultMetric: ExerciseMetric;
  phase: ExercisePhase;
  prescribedSets: number;
  metricMode: MetricMode;
  prescribedReps: number | null;
  prescribedDuration: number | null;
  prescribedLoadKg: number | null;
  restAfterSeconds: number | null;
  notes: string;
}

export type PhaseEntries = Record<ExercisePhase, TemplateExerciseFormEntry[]>;

export type TemplateFormFieldErrors = Partial<Record<"name" | "description" | "form", string>>;

const PHASES: ExercisePhase[] = ["warm_up", "main", "cool_down"];

export function emptyPhaseEntries(): PhaseEntries {
  return {
    warm_up: [],
    main: [],
    cool_down: [],
  };
}

export function defaultMetricMode(exercise: Pick<ExerciseWithMuscleGroups, "default_metric">): MetricMode {
  if (exercise.default_metric === "reps_weight") {
    return "reps";
  }
  return "duration";
}

export function exerciseToFormEntry(
  exercise: ExerciseWithMuscleGroups,
  phase: ExercisePhase,
): TemplateExerciseFormEntry {
  const metricMode = defaultMetricMode(exercise);
  return {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    exerciseDefaultMetric: exercise.default_metric,
    phase,
    prescribedSets: 3,
    metricMode,
    prescribedReps: metricMode === "reps" ? 10 : null,
    prescribedDuration: metricMode === "duration" ? 30 : null,
    prescribedLoadKg: null,
    restAfterSeconds: null,
    notes: "",
  };
}

export function templateExerciseToFormEntry(row: TemplateExerciseWithName): TemplateExerciseFormEntry {
  const hasReps = row.prescribed_reps !== null;
  const hasDuration = row.prescribed_duration_seconds !== null;
  const metricMode: MetricMode =
    hasDuration && !hasReps
      ? "duration"
      : hasReps && !hasDuration
        ? "reps"
        : defaultMetricMode({ default_metric: row.exercise_default_metric });

  return {
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    exerciseDefaultMetric: row.exercise_default_metric,
    phase: row.phase,
    prescribedSets: row.prescribed_sets,
    metricMode,
    prescribedReps: row.prescribed_reps,
    prescribedDuration: row.prescribed_duration_seconds,
    prescribedLoadKg: row.prescribed_load_kg,
    restAfterSeconds: row.rest_after_seconds,
    notes: row.notes ?? "",
  };
}

export function templateExercisesToPhaseEntries(exercises: TemplateExerciseWithName[]): PhaseEntries {
  const entries = emptyPhaseEntries();

  for (const phase of PHASES) {
    const phaseRows = exercises.filter((row) => row.phase === phase).sort((a, b) => a.sort_order - b.sort_order);
    entries[phase] = phaseRows.map(templateExerciseToFormEntry);
  }

  return entries;
}

export function exerciseEntryToPayload(entry: TemplateExerciseFormEntry, sortOrder: number): TemplateExerciseInput {
  return {
    exercise_id: entry.exerciseId,
    phase: entry.phase,
    sort_order: sortOrder,
    prescribed_sets: entry.prescribedSets,
    prescribed_reps: entry.metricMode === "reps" ? entry.prescribedReps : null,
    prescribed_duration_seconds: entry.metricMode === "duration" ? entry.prescribedDuration : null,
    prescribed_load_kg: entry.prescribedLoadKg,
    rest_after_seconds: entry.restAfterSeconds,
    notes: entry.notes.trim().length > 0 ? entry.notes.trim() : null,
  };
}

export function assembleTemplatePayload(
  name: string,
  description: string,
  phaseEntries: PhaseEntries,
): CreateTemplateBody {
  const exercises: TemplateExerciseInput[] = [];

  for (const phase of PHASES) {
    phaseEntries[phase].forEach((entry, index) => {
      exercises.push(exerciseEntryToPayload({ ...entry, phase }, index));
    });
  }

  return {
    name,
    description: description.trim().length > 0 ? description : null,
    exercises,
  };
}

function issuesToFieldErrors(issues: { path: string; message: string }[]): TemplateFormFieldErrors {
  const errors: TemplateFormFieldErrors = {};

  for (const issue of issues) {
    const field = issue.path.split(".")[0];
    if (field === "name" || field === "description") {
      errors[field] = issue.message;
    } else {
      errors.form ??= issue.message;
    }
  }

  return errors;
}

export function validateCreateTemplateForm(
  name: string,
  description: string,
  phaseEntries: PhaseEntries,
): { success: true; data: CreateTemplateBody } | { success: false; errors: TemplateFormFieldErrors } {
  const payload = assembleTemplatePayload(name, description, phaseEntries);
  const parsed = createTemplateBodySchema.safeParse(payload);

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

export function validateUpdateTemplateForm(
  name: string,
  description: string,
  phaseEntries: PhaseEntries,
): { success: true; data: UpdateTemplateBody } | { success: false; errors: TemplateFormFieldErrors } {
  const payload = assembleTemplatePayload(name, description, phaseEntries);
  const parsed = createTemplateBodySchema.safeParse(payload);

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
