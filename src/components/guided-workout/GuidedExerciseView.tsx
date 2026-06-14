import { ArrowLeft, Menu } from "lucide-react";
import { useMemo, useState } from "react";
import SetLogRow from "@/components/guided-workout/SetLogRow";
import { Button } from "@/components/ui/button";
import { formatPrescription } from "@/lib/guided-workout/format-prescription";
import { phaseLabel } from "@/lib/guided-workout/phase-labels";
import type { SessionExerciseDetail } from "@/lib/workout-sessions/service";
import type { SetLog } from "@/types";

interface GuidedExerciseViewProps {
  exercise: SessionExerciseDetail;
  exerciseIndex: number;
  totalExercises: number;
  startedAt: string | null;
  onBackToOverview: () => void;
  onBackToEditList: () => void;
  onOpenMenu?: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLogSaved: (setLog: SetLog) => void;
}

function findFirstIncompleteSet(exercise: SessionExerciseDetail): number {
  for (const prescribedSet of exercise.sets) {
    const log = exercise.logs.find((entry) => entry.set_number === prescribedSet.set_number);
    if (!log?.is_complete) {
      return prescribedSet.set_number;
    }
  }

  return exercise.sets[0]?.set_number ?? 1;
}

export default function GuidedExerciseView({
  exercise,
  exerciseIndex,
  totalExercises,
  startedAt,
  onBackToOverview,
  onBackToEditList,
  onOpenMenu,
  onPrev,
  onNext,
  onLogSaved,
}: GuidedExerciseViewProps) {
  const [activeSetNumber, setActiveSetNumber] = useState(() => findFirstIncompleteSet(exercise));

  const logsBySetNumber = useMemo(() => {
    const map = new Map<number, SetLog>();
    for (const log of exercise.logs) {
      map.set(log.set_number, log);
    }
    return map;
  }, [exercise.logs]);

  const isFirstExercise = exerciseIndex === 0;
  const isLastExercise = exerciseIndex >= totalExercises - 1;
  const showReps = exercise.exercise_default_metric !== "time";
  const showDuration = exercise.exercise_default_metric === "time";
  const showLoad = exercise.exercise_default_metric === "reps_weight";

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col">
      <header className="mb-4 flex items-center justify-between gap-3">
        {startedAt ? (
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-sm text-blue-100/70 hover:text-white"
            onClick={onBackToEditList}
            aria-label="All exercises"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-blue-100/70 hover:text-white"
            onClick={onBackToOverview}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Overview
          </button>
        )}

        <span className="text-sm font-medium text-white">
          {exerciseIndex + 1} of {totalExercises}
        </span>

        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/15 text-blue-100/70 hover:text-white disabled:opacity-40"
          onClick={onOpenMenu}
          disabled={!onOpenMenu}
          aria-label="Exercise menu"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 space-y-4 pb-28">
        <section>
          <p className="font-mono text-xs tracking-widest text-blue-200/80">{phaseLabel(exercise.phase)}</p>
          <h1 className="mt-2 text-3xl font-bold text-white">{exercise.exercise_name || "Exercise"}</h1>
          {exercise.notes ? <p className="mt-2 text-sm text-blue-100/70">{exercise.notes}</p> : null}
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-blue-100/90">
          {formatPrescription(exercise.sets, exercise.exercise_default_metric)}
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs tracking-wide text-blue-100/60 uppercase">
                <th className="px-3 py-3 font-medium">Set</th>
                {showReps ? <th className="px-2 py-3 font-medium">Reps</th> : null}
                {showDuration ? <th className="px-2 py-3 font-medium">Duration</th> : null}
                {showLoad ? <th className="px-2 py-3 font-medium">kg</th> : null}
                <th className="px-2 py-3 font-medium">OK</th>
                <th className="px-2 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {exercise.sets.map((prescribedSet) => (
                <SetLogRow
                  key={prescribedSet.id}
                  sessionExerciseId={exercise.id}
                  prescribedSet={prescribedSet}
                  existingLog={logsBySetNumber.get(prescribedSet.set_number)}
                  defaultMetric={exercise.exercise_default_metric}
                  isActive={activeSetNumber === prescribedSet.set_number}
                  onFocus={() => {
                    setActiveSetNumber(prescribedSet.set_number);
                  }}
                  onSaved={onLogSaved}
                />
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-slate-950/90 p-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl gap-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-12 flex-1 border-white/20 bg-white/5 text-base text-white hover:bg-white/10"
            disabled={isFirstExercise}
            onClick={onPrev}
          >
            Prev
          </Button>
          <Button type="button" className="min-h-12 flex-1 text-base" onClick={onNext}>
            {isLastExercise ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
