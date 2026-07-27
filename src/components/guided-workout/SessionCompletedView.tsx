import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import EditWindowBanner from "@/components/guided-workout/EditWindowBanner";
import SessionCommentsThread from "@/components/session-comments/SessionCommentsThread";
import SessionExerciseSummary, { readoutBadgeClass } from "@/components/workout-sessions/SessionExerciseSummary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isEditWindowOpen } from "@/lib/guided-workout/edit-window";
import { formatSessionOverviewDate } from "@/lib/guided-workout/format-session-date";
import { sessionStatusBadgeClass, sessionStatusLabel } from "@/lib/session-status";
import { deriveSessionReadout } from "@/lib/trainer-dashboard/readout";
import { toExerciseReadoutInputs } from "@/lib/trainer-dashboard/to-exercise-readout-input";
import type { ClientSessionDetail } from "@/lib/workout-sessions/service";
import { cn } from "@/lib/utils";

interface SessionCompletedViewProps {
  session: ClientSessionDetail;
  currentUserId: string;
  onEdit?: () => void;
}

export default function SessionCompletedView({ session, currentUserId, onEdit }: SessionCompletedViewProps) {
  const hasLogs = session.exercises.some((exercise) => exercise.logs.length > 0);
  const canEdit = isEditWindowOpen(session.status, session.locked_at);
  const readout = useMemo(() => deriveSessionReadout(toExerciseReadoutInputs(session.exercises)), [session.exercises]);
  const notesByExerciseId = useMemo(
    () => new Map(session.exercises.map((exercise) => [exercise.id, exercise.notes])),
    [session.exercises],
  );

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col">
      <header className="mb-6">
        <a
          href="/client/plan"
          className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Calendar
        </a>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-white">{session.name ?? "Workout"}</h1>
          <Badge variant="outline" className={cn("text-xs", sessionStatusBadgeClass(session.status))}>
            {sessionStatusLabel(session.status)}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">{formatSessionOverviewDate(session.scheduled_date)}</p>
        <EditWindowBanner lockedAt={session.locked_at} hasLogs={hasLogs} />
      </header>

      <div className="space-y-4 pb-28">
        <section className="border-border bg-card rounded-2xl border p-5 backdrop-blur-xl">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Trainer</dt>
              <dd className="mt-0.5 font-medium text-white">{session.trainer_display_name || "Your trainer"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-0.5 font-medium text-white">{sessionStatusLabel(session.status)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Logging status</dt>
              <dd className="mt-0.5">
                <span
                  className={cn(
                    "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    readoutBadgeClass(readout.status),
                  )}
                >
                  {readout.statusLabel}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sets logged</dt>
              <dd className="mt-0.5 font-medium text-white">
                {readout.completedSets} of {readout.totalSets}
              </dd>
            </div>
          </dl>
        </section>

        {session.status === "cancelled" ? (
          <p className="text-muted-foreground text-sm">This session has been cancelled.</p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Your workout has been recorded. Your trainer can see the results.
          </p>
        )}

        <SessionExerciseSummary readout={readout} notesByExerciseId={notesByExerciseId} />

        <SessionCommentsThread sessionId={session.id} currentUserId={currentUserId} />
      </div>

      {canEdit && onEdit ? (
        <div className="border-border bg-background/90 fixed inset-x-0 bottom-0 border-t p-4 backdrop-blur-xl">
          <div className="mx-auto max-w-2xl">
            <Button type="button" className="min-h-12 w-full text-base" onClick={onEdit}>
              Edit
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
