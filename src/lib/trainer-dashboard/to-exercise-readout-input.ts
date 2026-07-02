import type { ExerciseReadoutInput } from "@/lib/trainer-dashboard/readout";
import type { SessionExerciseDetail } from "@/lib/workout-sessions/service";

export function toExerciseReadoutInputs(exercises: SessionExerciseDetail[]): ExerciseReadoutInput[] {
  return exercises.map((exercise) => ({
    id: exercise.id,
    exercise_id: exercise.exercise_id,
    phase: exercise.phase,
    sort_order: exercise.sort_order,
    exercise_name: exercise.exercise_name,
    exercise_default_metric: exercise.exercise_default_metric,
    sets: exercise.sets,
    logs: exercise.logs,
  }));
}
