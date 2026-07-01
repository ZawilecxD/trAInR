import type { ExerciseMetric, SessionExerciseSet } from "@/types";

export interface LoggedValueFields {
  reps: number | null;
  duration_seconds: number | null;
  load_kg: number | null;
}

export interface PrescriptionFillValues extends LoggedValueFields {
  is_complete: false;
  is_warmup: boolean;
}

export function hasLoggedValues(log: LoggedValueFields | null | undefined): log is LoggedValueFields {
  return log != null && (log.reps !== null || log.duration_seconds !== null || log.load_kg !== null);
}

export function fillValuesFromPrescription(
  prescribedSet: SessionExerciseSet,
  defaultMetric: ExerciseMetric,
): PrescriptionFillValues {
  return {
    reps: defaultMetric === "time" ? null : prescribedSet.prescribed_reps,
    duration_seconds: defaultMetric === "time" ? prescribedSet.prescribed_duration_seconds : null,
    load_kg: defaultMetric === "reps_weight" ? prescribedSet.prescribed_load_kg : null,
    is_complete: false,
    is_warmup: prescribedSet.is_warmup,
  };
}
