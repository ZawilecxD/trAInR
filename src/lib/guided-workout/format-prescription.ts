import type { ExerciseMetric, SessionExerciseSet } from "@/types";

function formatRest(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "1 min" : `${minutes} min`;
}

function formatDurationRange(values: (number | null)[]): string | null {
  const numbers = values.filter((value): value is number => value !== null);
  if (numbers.length === 0) {
    return null;
  }

  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  return min === max ? `${min}s` : `${min}–${max}s`;
}

function formatRestRange(values: number[]): string | null {
  if (values.length === 0) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? formatRest(min) : `${formatRest(min)}–${formatRest(max)}`;
}

function formatRepRange(values: (number | null)[]): string | null {
  const numbers = values.filter((value): value is number => value !== null);
  if (numbers.length === 0) {
    return null;
  }

  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  if (min === max) {
    return min === 1 ? "1 rep" : `${min} reps`;
  }

  return `${min}–${max} reps`;
}

function formatLoadRange(values: (number | null)[]): string | null {
  const numbers = values.filter((value): value is number => value !== null);
  if (numbers.length === 0) {
    return null;
  }

  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  return min === max ? `${min} kg` : `${min}–${max} kg`;
}

export function formatPrescription(sets: SessionExerciseSet[], defaultMetric: ExerciseMetric): string {
  if (sets.length === 0) {
    return "No sets prescribed";
  }

  const parts: string[] = [`${sets.length} set${sets.length === 1 ? "" : "s"}`];

  if (defaultMetric === "time") {
    const duration = formatDurationRange(sets.map((set) => set.prescribed_duration_seconds));
    if (duration !== null) {
      parts.push(duration);
    }
  } else {
    const reps = formatRepRange(sets.map((set) => set.prescribed_reps));
    if (reps !== null) {
      parts.push(reps);
    }

    const load = formatLoadRange(sets.map((set) => set.prescribed_load_kg));
    if (load !== null) {
      parts.push(load);
    }
  }

  const restValues = sets
    .map((set) => set.rest_after_seconds)
    .filter((value): value is number => value !== null && value > 0);
  if (restValues.length > 0) {
    const rest = formatRestRange(restValues);
    if (rest !== null) {
      parts.push(`Rest ${rest}`);
    }
  }

  return parts.join(" · ");
}

export function formatPrescriptionRound(set: SessionExerciseSet, defaultMetric: ExerciseMetric): string {
  const warmupPrefix = set.is_warmup ? "WU · " : "";

  if (defaultMetric === "time") {
    const duration = set.prescribed_duration_seconds !== null ? `${set.prescribed_duration_seconds}s` : "—";
    return `${warmupPrefix}${duration}`;
  }

  const parts: string[] = [];

  if (set.prescribed_reps !== null) {
    parts.push(`${set.prescribed_reps} reps`);
  }

  if (defaultMetric === "reps_weight" && set.prescribed_load_kg !== null) {
    parts.push(`${set.prescribed_load_kg} kg`);
  }

  const detail = parts.length > 0 ? parts.join(" @ ") : "—";
  return `${warmupPrefix}${detail}`;
}

export function formatExercisePrescriptionDetail(sets: SessionExerciseSet[], defaultMetric: ExerciseMetric): string {
  if (sets.length === 0) {
    return "No sets prescribed";
  }

  const sortedSets = [...sets].sort((a, b) => a.set_number - b.set_number);
  return sortedSets.map((set) => formatPrescriptionRound(set, defaultMetric)).join(" · ");
}
