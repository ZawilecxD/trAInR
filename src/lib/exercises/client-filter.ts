import type { ExerciseWithMuscleGroups } from "@/lib/exercises/service";

export interface ClientExerciseFilterOptions {
  q?: string;
  favouritesOnly?: boolean;
}

export function filterExercises(
  exercises: ExerciseWithMuscleGroups[],
  options: ClientExerciseFilterOptions,
): ExerciseWithMuscleGroups[] {
  let result = exercises;

  if (options.favouritesOnly) {
    result = result.filter((exercise) => exercise.is_favourite);
  }

  const normalized = options.q?.trim().toLowerCase();
  if (normalized) {
    result = result.filter((exercise) => exercise.name.toLowerCase().includes(normalized));
  }

  return result;
}
