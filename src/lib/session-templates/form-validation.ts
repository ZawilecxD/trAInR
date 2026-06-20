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

export interface TemplateExerciseSetFormEntry {
  prescribedReps: number | null;
  prescribedDuration: number | null;
  prescribedLoadKg: number | null;
  restAfterSeconds: number | null;
  isWarmup: boolean;
}

export interface TemplateExerciseFormEntry {
  exerciseId: string;
  exerciseName: string;
  exerciseDefaultMetric: ExerciseMetric;
  phase: ExercisePhase;
  metricMode: MetricMode;
  rounds: TemplateExerciseSetFormEntry[];
  notes: string;
}

export type PhaseEntries = Record<ExercisePhase, TemplateExerciseFormEntry[]>;

export type TemplateFormFieldErrors = Partial<Record<"name" | "description" | "form", string>>;

const PHASES: ExercisePhase[] = ["warm_up", "main", "cool_down"];

export function showsWarmupWorkingToggle(phase: ExercisePhase): boolean {
  return phase === "main";
}

export function resolveRoundIsWarmup(phase: ExercisePhase, isWarmup: boolean): boolean {
  if (phase === "warm_up") {
    return true;
  }
  if (phase === "cool_down") {
    return false;
  }
  return isWarmup;
}

function defaultRound(metricMode: MetricMode, phase: ExercisePhase): TemplateExerciseSetFormEntry {
  return {
    prescribedReps: metricMode === "reps" ? 10 : null,
    prescribedDuration: metricMode === "duration" ? 30 : null,
    prescribedLoadKg: null,
    restAfterSeconds: null,
    isWarmup: resolveRoundIsWarmup(phase, false),
  };
}

function setToRound(set: TemplateExerciseWithName["sets"][number], phase: ExercisePhase): TemplateExerciseSetFormEntry {
  return {
    prescribedReps: set.prescribed_reps,
    prescribedDuration: set.prescribed_duration_seconds,
    prescribedLoadKg: set.prescribed_load_kg,
    restAfterSeconds: set.rest_after_seconds,
    isWarmup: resolveRoundIsWarmup(phase, set.is_warmup),
  };
}

function roundToPayload(round: TemplateExerciseSetFormEntry, metricMode: MetricMode, phase: ExercisePhase) {
  return {
    prescribed_reps: metricMode === "reps" ? round.prescribedReps : null,
    prescribed_duration_seconds: metricMode === "duration" ? round.prescribedDuration : null,
    prescribed_load_kg: round.prescribedLoadKg,
    rest_after_seconds: round.restAfterSeconds,
    is_warmup: resolveRoundIsWarmup(phase, round.isWarmup),
  };
}

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
    metricMode,
    rounds: [defaultRound(metricMode, phase)],
    notes: "",
  };
}

export function templateExerciseToFormEntry(row: TemplateExerciseWithName): TemplateExerciseFormEntry {
  const sortedSets = [...row.sets].sort((a, b) => a.set_number - b.set_number);
  const firstSet = sortedSets.at(0);
  const hasReps = sortedSets.some((set) => set.prescribed_reps !== null);
  const hasDuration = sortedSets.some((set) => set.prescribed_duration_seconds !== null);
  const metricMode: MetricMode =
    hasDuration && !hasReps
      ? "duration"
      : hasReps && !hasDuration
        ? "reps"
        : firstSet
          ? firstSet.prescribed_reps !== null
            ? "reps"
            : firstSet.prescribed_duration_seconds !== null
              ? "duration"
              : defaultMetricMode({ default_metric: row.exercise_default_metric })
          : defaultMetricMode({ default_metric: row.exercise_default_metric });

  const rounds =
    sortedSets.length > 0 ? sortedSets.map((set) => setToRound(set, row.phase)) : [defaultRound(metricMode, row.phase)];

  return {
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    exerciseDefaultMetric: row.exercise_default_metric,
    phase: row.phase,
    metricMode,
    rounds,
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

export function addRound(entry: TemplateExerciseFormEntry): TemplateExerciseFormEntry {
  const lastRound = entry.rounds.at(-1);
  const baseRound = lastRound ? { ...lastRound } : defaultRound(entry.metricMode, entry.phase);
  const nextRound = {
    ...baseRound,
    isWarmup: resolveRoundIsWarmup(entry.phase, baseRound.isWarmup),
  };

  return {
    ...entry,
    rounds: [...entry.rounds, nextRound],
  };
}

export function removeRound(entry: TemplateExerciseFormEntry, roundIndex: number): TemplateExerciseFormEntry {
  if (entry.rounds.length <= 1) {
    return entry;
  }

  return {
    ...entry,
    rounds: entry.rounds.filter((_, index) => index !== roundIndex),
  };
}

export function updateRound(
  entry: TemplateExerciseFormEntry,
  roundIndex: number,
  patch: Partial<TemplateExerciseSetFormEntry>,
): TemplateExerciseFormEntry {
  return {
    ...entry,
    rounds: entry.rounds.map((round, index) => {
      if (index !== roundIndex) {
        return round;
      }

      const merged = { ...round, ...patch };
      return {
        ...merged,
        isWarmup: resolveRoundIsWarmup(entry.phase, merged.isWarmup),
      };
    }),
  };
}

export function exerciseEntryToPayload(entry: TemplateExerciseFormEntry, sortOrder: number): TemplateExerciseInput {
  return {
    exercise_id: entry.exerciseId,
    phase: entry.phase,
    sort_order: sortOrder,
    sets: entry.rounds.map((round) => roundToPayload(round, entry.metricMode, entry.phase)),
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
