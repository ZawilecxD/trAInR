import { PHASE_ORDER, phaseLabel } from "@/lib/guided-workout/phase-labels";
import { getExerciseProgress, getSessionProgressSummary } from "@/lib/guided-workout/exercise-progress";
import { getLoggingSetNumbers } from "@/lib/guided-workout/logging-sets";
import type { SessionExerciseDetail } from "@/lib/workout-sessions/service";
import type { ExercisePhase } from "@/types";
import { cn } from "@/lib/utils";

interface ExerciseNavItem {
  exercise: SessionExerciseDetail;
  globalIndex: number;
}

interface ExerciseNavListProps {
  exercises: SessionExerciseDetail[];
  exerciseIndex: number;
  onSelectExercise: (index: number) => void;
  className?: string;
}

function groupExercisesWithIndex(exercises: SessionExerciseDetail[]): Map<ExercisePhase, ExerciseNavItem[]> {
  const groups = new Map<ExercisePhase, ExerciseNavItem[]>();

  for (const phase of PHASE_ORDER) {
    groups.set(phase, []);
  }

  exercises.forEach((exercise, globalIndex) => {
    const bucket = groups.get(exercise.phase) ?? [];
    bucket.push({ exercise, globalIndex });
    groups.set(exercise.phase, bucket);
  });

  return groups;
}

function StatusDot({ isDone, isActive }: { isDone: boolean; isActive: boolean }) {
  return (
    <span
      className={cn(
        "mt-1.5 size-2.5 shrink-0 rounded-full border",
        isDone && "border-emerald-400 bg-emerald-400",
        isActive && !isDone && "border-blue-400 bg-blue-400",
        !isDone && !isActive && "border-white/25 bg-transparent",
      )}
      aria-hidden="true"
    />
  );
}

export default function ExerciseNavList({
  exercises,
  exerciseIndex,
  onSelectExercise,
  className,
}: ExerciseNavListProps) {
  const groups = groupExercisesWithIndex(exercises);
  const summary = getSessionProgressSummary(exercises, exerciseIndex);

  return (
    <div className={cn("flex flex-col", className)}>
      <header className="border-b border-white/10 pb-4">
        <h2 className="text-lg font-semibold text-white">Exercises</h2>
        <p className="mt-1 text-sm text-blue-100/60">
          {summary.done} done · {summary.active} active · {summary.remaining} remaining
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-1 py-4">
        {PHASE_ORDER.map((phase) => {
          const items = groups.get(phase) ?? [];
          if (items.length === 0) {
            return null;
          }

          return (
            <section key={phase} className="mt-4 first:mt-0">
              <h3 className="px-2 font-mono text-xs tracking-widest text-blue-200/80">{phaseLabel(phase)}</h3>
              <ul className="mt-2 space-y-1">
                {items.map(({ exercise, globalIndex }) => {
                  const progress = getExerciseProgress(
                    getLoggingSetNumbers(exercise.sets, exercise.logs),
                    exercise.logs,
                    globalIndex === exerciseIndex,
                  );

                  return (
                    <li key={exercise.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/5",
                          globalIndex === exerciseIndex && "bg-blue-500/10 ring-1 ring-blue-400/30 ring-inset",
                        )}
                        onClick={() => {
                          onSelectExercise(globalIndex);
                        }}
                      >
                        <StatusDot isDone={progress.isDone} isActive={progress.isActive} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-white">
                            {exercise.exercise_name || "Exercise"}
                          </span>
                          <span className="mt-0.5 block text-xs text-blue-100/60">
                            {progress.completedSets}/{progress.totalSets} sets
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
