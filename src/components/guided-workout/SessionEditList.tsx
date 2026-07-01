import { ArrowLeft, RotateCcw } from "lucide-react";
import { useState } from "react";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import EditWindowBanner from "@/components/guided-workout/EditWindowBanner";
import ExerciseSetLogTable from "@/components/guided-workout/ExerciseSetLogTable";
import SessionCommentsThread from "@/components/session-comments/SessionCommentsThread";
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
  currentUserId: string;
  readOnly?: boolean;
  onContinueWorkout: (exerciseIndex: number) => void;
  onJumpToExercise: (exerciseIndex: number) => void;
  onLogSaved: (setLog: SetLog) => void;
  onLogDeleted: (sessionExerciseId: string, setNumber: number) => void;
  onRestart: () => Promise<void>;
  onComplete: (status: "finished" | "finished_partially" | "cancelled") => Promise<void>;
  onBackToSummary?: () => void;
}

function ExerciseEditCard({
  exercise,
  exerciseIndex,
  readOnly,
  onJumpToExercise,
  onLogSaved,
  onLogDeleted,
}: {
  exercise: SessionExerciseDetail;
  exerciseIndex: number;
  readOnly: boolean;
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

      <ExerciseSetLogTable
        exercise={exercise}
        readOnly={readOnly}
        onLogSaved={onLogSaved}
        onLogDeleted={onLogDeleted}
      />
    </section>
  );
}

export default function SessionEditList({
  session,
  exercises,
  currentUserId,
  readOnly = false,
  onContinueWorkout,
  onJumpToExercise,
  onLogSaved,
  onLogDeleted,
  onRestart,
  onComplete,
  onBackToSummary,
}: SessionEditListProps) {
  const continueIndex = findFirstIncompleteExerciseIndex(exercises);
  const hasLogs = exercises.some((exercise) => exercise.logs.length > 0);
  const isInProgress = session.status === "not_started";
  const [restartOpen, setRestartOpen] = useState(false);
  const [restartPending, setRestartPending] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completePending, setCompletePending] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

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

  async function handleComplete(status: "finished" | "finished_partially" | "cancelled") {
    setCompletePending(true);
    setCompleteError(null);

    try {
      await onComplete(status);
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : "Failed to save session status");
    } finally {
      setCompletePending(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col">
      <header className="mb-6">
        {isInProgress ? (
          <a
            href="/client/plan"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-blue-100/70 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Calendar
          </a>
        ) : (
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-blue-100/70 transition-colors hover:text-white"
            onClick={onBackToSummary}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Summary
          </button>
        )}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-white">{session.name ?? "Workout"}</h1>
            <p className="mt-1 text-sm text-blue-100/70">{formatSessionOverviewDate(session.scheduled_date)}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-white/20 bg-white/5 text-white hover:bg-white/10"
            disabled={readOnly || !isInProgress}
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
        <EditWindowBanner lockedAt={session.locked_at} hasLogs={hasLogs} />
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
            readOnly={readOnly}
            onJumpToExercise={onJumpToExercise}
            onLogSaved={onLogSaved}
            onLogDeleted={onLogDeleted}
          />
        ))}

        <SessionCommentsThread sessionId={session.id} currentUserId={currentUserId} />
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-slate-950/90 p-4 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl space-y-2">
          {completeError ? (
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-100">
              {completeError}
            </p>
          ) : null}
          {isInProgress ? (
            <>
              <Button
                type="button"
                className="min-h-12 w-full text-base"
                onClick={() => {
                  onContinueWorkout(continueIndex);
                }}
              >
                Continue workout
              </Button>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                  disabled={completePending}
                  onClick={() => {
                    void handleComplete("finished");
                  }}
                >
                  Done
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                  disabled={completePending}
                  onClick={() => {
                    void handleComplete("finished_partially");
                  }}
                >
                  Partial
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 border-slate-500/30 bg-slate-500/10 text-slate-300 hover:bg-slate-500/20"
                  disabled={completePending}
                  onClick={() => {
                    setCancelOpen(true);
                  }}
                >
                  Cancel
                </Button>
              </div>
              <DeleteConfirmDialog
                open={cancelOpen}
                onOpenChange={setCancelOpen}
                title="Cancel this session?"
                description="The session will be marked as cancelled. Any sets you logged will be kept."
                confirmLabel="Cancel session"
                loading={completePending}
                onConfirm={() => {
                  void handleComplete("cancelled");
                }}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
