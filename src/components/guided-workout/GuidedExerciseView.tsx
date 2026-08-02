import { ArrowLeft, Loader2, Menu } from "lucide-react";
import ExerciseSetLogTable from "@/components/guided-workout/ExerciseSetLogTable";
import { Button } from "@/components/ui/button";
import { formatExercisePrescriptionDetail } from "@/lib/guided-workout/format-prescription";
import { phaseLabel } from "@/lib/guided-workout/phase-labels";
import type { SessionExerciseDetail } from "@/lib/workout-sessions/service";
import type { SetLog } from "@/types";

interface GuidedExerciseViewProps {
  exercise: SessionExerciseDetail;
  exerciseIndex: number;
  totalExercises: number;
  startedAt: string | null;
  readOnly?: boolean;
  isNavigating?: boolean;
  onBackToOverview: () => void;
  onBackToEditList: () => void;
  onOpenMenu?: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLogSaved: (setLog: SetLog) => void;
  onLogDeleted: (sessionExerciseId: string, setNumber: number) => void;
}

export default function GuidedExerciseView({
  exercise,
  exerciseIndex,
  totalExercises,
  startedAt,
  readOnly = false,
  isNavigating = false,
  onBackToOverview,
  onBackToEditList,
  onOpenMenu,
  onPrev,
  onNext,
  onLogSaved,
  onLogDeleted,
}: GuidedExerciseViewProps) {
  const isFirstExercise = exerciseIndex === 0;
  const isLastExercise = exerciseIndex >= totalExercises - 1;

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col">
      <header className="mb-4 grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-3 lg:grid-cols-[auto_1fr] lg:gap-4">
        {startedAt ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex min-h-11 min-w-11 items-center justify-center text-sm"
            onClick={onBackToEditList}
            aria-label="All exercises"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm lg:col-span-1"
            onClick={onBackToOverview}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Overview
          </button>
        )}

        <span className="text-foreground text-center text-sm font-medium lg:text-left">
          {exerciseIndex + 1} of {totalExercises}
        </span>

        <button
          type="button"
          className="border-border text-muted-foreground hover:text-foreground inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border disabled:opacity-40 lg:hidden"
          onClick={onOpenMenu}
          disabled={!onOpenMenu}
          aria-label="Exercise menu"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </header>

      <div className="space-y-4 pb-28 lg:pb-4">
        <section>
          <p className="text-text-soft font-mono text-xs tracking-widest">{phaseLabel(exercise.phase)}</p>
          <h1 className="text-foreground mt-2 text-3xl font-bold">{exercise.exercise_name || "Exercise"}</h1>
          {exercise.notes ? <p className="text-muted-foreground mt-2 text-sm">{exercise.notes}</p> : null}
        </section>

        <section className="border-border bg-card text-foreground/90 rounded-xl border px-4 py-3 text-sm">
          {formatExercisePrescriptionDetail(exercise.sets, exercise.exercise_default_metric)}
        </section>

        <ExerciseSetLogTable
          exercise={exercise}
          readOnly={readOnly}
          onLogSaved={onLogSaved}
          onLogDeleted={onLogDeleted}
        />
      </div>

      <div className="bg-background/90 fixed inset-x-0 bottom-0 p-4 backdrop-blur-xl lg:static lg:mt-6 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-2xl gap-3 lg:max-w-none">
          <Button
            type="button"
            variant="outline"
            className="border-border bg-card hover:bg-accent text-foreground min-h-12 flex-1 text-base"
            disabled={isFirstExercise || isNavigating}
            onClick={onPrev}
          >
            Prev
          </Button>
          <Button
            type="button"
            className="min-h-12 flex-1 text-base"
            disabled={isNavigating}
            onClick={isLastExercise ? onBackToEditList : onNext}
          >
            {isNavigating ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : isLastExercise ? (
              "Finish"
            ) : (
              "Next"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
