import { PHASE_ORDER, phaseLabel } from "@/lib/guided-workout/phase-labels";
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

  for (const exercise of exercises) {
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
          <section key={phase} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-mono text-xs tracking-widest text-blue-200/80">{phaseLabel(phase)}</h3>
            <p className="mt-1 text-sm text-blue-100/60">
              {phaseExercises.length} exercise{phaseExercises.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-3 space-y-2">
              {phaseExercises.map((exercise) => (
                <li key={exercise.id} className="text-sm text-white">
                  {exercise.exercise_name || "Exercise"}
                  {exercise.sets.length > 0 ? (
                    <span className="text-blue-100/50"> · {exercise.sets.length} sets</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
