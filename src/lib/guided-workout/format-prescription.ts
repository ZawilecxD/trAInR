import type { ExerciseMetric, SessionExerciseSet } from "@/types";

function formatRest(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "1 min" : `${minutes} min`;
}

function uniformValue<T>(values: (T | null | undefined)[]): T | null {
  if (values.length === 0) return null;
  const first = values[0] ?? null;
  if (first === null) return null;
  return values.every((value) => value === first) ? first : null;
}

export function formatPrescription(sets: SessionExerciseSet[], defaultMetric: ExerciseMetric): string {
  if (sets.length === 0) {
    return "No sets prescribed";
  }

  const parts: string[] = [`${sets.length} set${sets.length === 1 ? "" : "s"}`];

  if (defaultMetric === "time") {
    const duration = uniformValue(sets.map((set) => set.prescribed_duration_seconds));
    if (duration !== null) {
      parts.push(`${duration}s`);
    }
  } else {
    const reps = uniformValue(sets.map((set) => set.prescribed_reps));
    if (reps !== null) {
      parts.push(`${reps} rep${reps === 1 ? "" : "s"}`);
    }

    const load = uniformValue(sets.map((set) => set.prescribed_load_kg));
    if (load !== null) {
      parts.push(`${load} kg`);
    }
  }

  const rest = uniformValue(sets.map((set) => set.rest_after_seconds));
  if (rest !== null && rest > 0) {
    parts.push(`Rest ${formatRest(rest)}`);
  }

  return parts.join(" · ");
}
