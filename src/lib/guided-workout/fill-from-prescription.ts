import type { SetLogValues } from "@/components/hooks/useDebouncedSetLogSave";
import { resolveLogIsWarmup } from "@/lib/guided-workout/warmup-default";
import type { ExerciseMetric, SessionExerciseSet, SetLog } from "@/types";

interface FillFromPrescriptionInput {
  prescribedSet: SessionExerciseSet | undefined;
  defaultMetric: ExerciseMetric;
  existingLog: SetLog | undefined;
  isPrescribed: boolean;
}

export function fillValuesFromPrescription({
  prescribedSet,
  defaultMetric,
  existingLog,
  isPrescribed,
}: FillFromPrescriptionInput): SetLogValues {
  if (!prescribedSet) {
    return {
      reps: existingLog?.reps ?? null,
      duration_seconds: existingLog?.duration_seconds ?? null,
      load_kg: existingLog?.load_kg ?? null,
      is_complete: false,
      is_warmup: resolveLogIsWarmup({ existingLog, prescribedSet, isPrescribed }),
    };
  }

  return {
    reps: defaultMetric === "time" ? null : prescribedSet.prescribed_reps,
    duration_seconds: defaultMetric === "time" ? prescribedSet.prescribed_duration_seconds : null,
    load_kg: defaultMetric === "reps_weight" ? prescribedSet.prescribed_load_kg : null,
    is_complete: false,
    is_warmup: resolveLogIsWarmup({ existingLog, prescribedSet, isPrescribed }),
  };
}
