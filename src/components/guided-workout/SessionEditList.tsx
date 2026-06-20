import { ArrowLeft, RotateCcw } from "lucide-react";
import { useState } from "react";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import ExerciseSetLogTable from "@/components/guided-workout/ExerciseSetLogTable";
import { Button } from "@/components/ui/button";
import { findFirstIncompleteExerciseIndex } from "@/lib/guided-workout/exercise-progress";
import { formatExercisePrescriptionDetail } from "@/lib/guided-workout/format-prescription";
import { formatSessionOverviewDate } from "@/lib/guided-workout/format-session-date";
import { phaseLabel } from "@/lib/guided-workout/phase-labels";
import type { ClientSessionDetail, SessionExerciseDetail } from "@/lib/workout-sessions/service";
import type { SetLog } from "@/types";

interface SessionEditListProps {
  session: ClientSessionDetail;
  exercises: SessionExerciseDetail[];
  onContinueWorkout: (exerciseIndex: number) => void;
  onJumpToExercise: (exerciseIndex: number) => void;
  onLogSaved: (setLog: SetLog) => void;
  onLogDeleted: (sessionExerciseId: string, setNumber: number) => void;
  onRestart: () => Promise<void>;
}

function ExerciseEditCard({
  exercise,
  exerciseIndex,
  onJumpToExercise,
  onLogSaved,
  onLogDeleted,
}: {
  exercise: SessionExerciseDetail;
  exerciseIndex: number;
  onJumpToExercise: (index: number) => void;
  onLogSaved: (setLog: SetLog) => void;
  onLogDeleted: (sessionExerciseId: string, setNumber: number) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-xl">
        <p className="font-mono text-xs tracking-widest text-blue-200/80">{phaseLabel(exercise.phase)}</p>
        <button
          type="button"
          className="mt-2 text-left text-lg font-semibold text-white hover:text-blue-100"
          onClick={() => {
            onJumpToExercise(exerciseIndex);
          }}
        >
          {exercise.exercise_name || "Exercise"}
        </button>
        {exercise.notes ? <p className="mt-1 text-sm text-blue-100/70">{exercise.notes}</p> : null}
        <p className="mt-3 text-sm text-blue-100/90">
          {formatExercisePrescriptionDetail(exercise.sets, exercise.exercise_default_metric)}
        </p>
      </div>

      <ExerciseSetLogTable exercise={exercise} onLogSaved={onLogSaved} onLogDeleted={onLogDeleted} />
    </section>
  );
}

export default function SessionEditList({
  session,
  exercises,
  onContinueWorkout,
  onJumpToExercise,
  onLogSaved,
  onLogDeleted,
  onRestart,
}: SessionEditListProps) {
  const continueIndex = findFirstIncompleteExerciseIndex(exercises);
  const [restartOpen, setRestartOpen] = useState(false);
  const [restartPending, setRestartPending] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);

  async function handleRestartConfirm() {
    setRestartPending(true);
    setRestartError(null);

    try {
      await onRestart();
      setRestartOpen(false);
    } catch (err) {
      setRestartError(err instanceof Error ? err.message : "Failed to restart session");
    } finally {
      setRestartPending(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col">
      <header className="mb-6">
        <a
          href="/client/plan"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-blue-100/70 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Calendar
        </a>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-white">{session.name ?? "Workout"}</h1>
            <p className="mt-1 text-sm text-blue-100/70">{formatSessionOverviewDate(session.scheduled_date)}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-white/20 bg-white/5 text-white hover:bg-white/10"
            onClick={() => {
              setRestartOpen(true);
            }}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Restart
          </Button>
          <DeleteConfirmDialog
            open={restartOpen}
            onOpenChange={setRestartOpen}
            title="Restart workout?"
            description="This clears all logged sets and returns you to the session overview with the trainer's original plan."
            confirmLabel="Restart"
            loading={restartPending}
            onConfirm={handleRestartConfirm}
          />
        </div>
        {restartError ? (
          <p className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {restartError}
          </p>
        ) : null}
      </header>

      <div className="space-y-4 pb-28">
        {exercises.map((exercise, index) => (
          <ExerciseEditCard
            key={exercise.id}
            exercise={exercise}
            exerciseIndex={index}
            onJumpToExercise={onJumpToExercise}
            onLogSaved={onLogSaved}
            onLogDeleted={onLogDeleted}
          />
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-slate-950/90 p-4 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl">
          <Button
            type="button"
            className="min-h-12 w-full text-base"
            onClick={() => {
              onContinueWorkout(continueIndex);
            }}
          >
            Continue workout
          </Button>
        </div>
      </div>
    </div>
  );
}
