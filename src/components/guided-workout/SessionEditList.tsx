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
import { errorBannerClass, mobileStickyActionBarClass, surfaceCardClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
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
      <div className={cn(surfaceCardClass, "px-4 py-4")}>
        <p className="text-primary label-caps">{phaseLabel(exercise.phase)}</p>
        <button
          type="button"
          className="hover:text-foreground text-foreground mt-2 min-h-11 text-left text-lg font-semibold"
          onClick={() => {
            onJumpToExercise(exerciseIndex);
          }}
        >
          {exercise.exercise_name || "Exercise"}
        </button>
        {exercise.notes ? <p className="text-muted-foreground mt-1 text-sm">{exercise.notes}</p> : null}
        <p className="text-foreground/90 mt-3 text-sm">
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
            className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Calendar
          </a>
        ) : (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm transition-colors"
            onClick={onBackToSummary}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Summary
          </button>
        )}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-foreground text-3xl font-bold">{session.name ?? "Workout"}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{formatSessionOverviewDate(session.scheduled_date)}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-border bg-card hover:bg-accent text-foreground min-h-11"
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
        {restartError ? <p className={cn(errorBannerClass, "mt-3")}>{restartError}</p> : null}
      </header>

      <div className="space-y-4 pb-40 md:pb-32">
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

      <div className={mobileStickyActionBarClass}>
        <div className="mx-auto max-w-2xl space-y-2">
          {completeError ? <p className={errorBannerClass}>{completeError}</p> : null}
          {isInProgress ? (
            <>
              <Button
                type="button"
                className="min-h-12 w-full text-base font-semibold"
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
                  className="border-success/30 bg-success/10 text-success hover:bg-success/20 min-h-11"
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
                  className="border-warning/30 bg-warning/10 text-warning hover:bg-warning/20 min-h-11"
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
                  className="border-muted-foreground/30 bg-muted text-muted-foreground hover:bg-accent min-h-11"
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
