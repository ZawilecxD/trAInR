import { PHASE_ORDER, phaseLabel, sortByPhaseThenSortOrder } from "@/lib/guided-workout/phase-labels";
import { formatExercisePrescriptionDetail } from "@/lib/guided-workout/format-prescription";
import type { SessionExerciseDetail } from "@/lib/workout-sessions/service";
import type { ExercisePhase } from "@/types";

interface PhaseBreakdownProps {
  exercises: SessionExerciseDetail[];
}

function groupExercisesByPhase(exercises: SessionExerciseDetail[]): Map<ExercisePhase, SessionExerciseDetail[]> {
  const groups = new Map<ExercisePhase, SessionExerciseDetail[]>();

  for (const phase of PHASE_ORDER) {
    groups.set(phase, []);
  }

  for (const exercise of sortByPhaseThenSortOrder(exercises)) {
    const bucket = groups.get(exercise.phase) ?? [];
    bucket.push(exercise);
    groups.set(exercise.phase, bucket);
  }

  return groups;
}

export default function PhaseBreakdown({ exercises }: PhaseBreakdownProps) {
  const groups = groupExercisesByPhase(exercises);

  return (
    <div className="space-y-4">
      {PHASE_ORDER.map((phase) => {
        const phaseExercises = groups.get(phase) ?? [];
        if (phaseExercises.length === 0) {
          return null;
        }

        return (
          <section key={phase} className="border-border bg-card rounded-xl border p-4">
            <h3 className="text-text-soft font-mono text-xs tracking-widest">{phaseLabel(phase)}</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {phaseExercises.length} exercise{phaseExercises.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-3 space-y-3">
              {phaseExercises.map((exercise) => (
                <li key={exercise.id}>
                  <p className="text-foreground text-sm font-medium">{exercise.exercise_name || "Exercise"}</p>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    {formatExercisePrescriptionDetail(exercise.sets, exercise.exercise_default_metric)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
