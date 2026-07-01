import type { ExerciseMetric, SetLog } from "@/types";

interface SetMetricValues {
  reps: number | null;
  duration_seconds: number | null;
  load_kg: number | null;
  is_complete?: boolean;
}

function hasMetricValues(values: SetMetricValues, metric: ExerciseMetric): boolean {
  if (metric === "time") {
    return values.duration_seconds !== null;
  }

  if (metric === "reps_weight") {
    return values.reps !== null;
  }

  return values.reps !== null || values.duration_seconds !== null || values.load_kg !== null;
}

export function isSetValuesLogged(values: SetMetricValues, metric: ExerciseMetric): boolean {
  if (values.is_complete) {
    return true;
  }

  return hasMetricValues(values, metric);
}

export function isSetLogged(log: SetLog | null | undefined, metric: ExerciseMetric): boolean {
  if (!log) {
    return false;
  }

  return isSetValuesLogged(log, metric);
}
