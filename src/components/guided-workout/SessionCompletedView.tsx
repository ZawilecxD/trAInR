import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import EditWindowBanner from "@/components/guided-workout/EditWindowBanner";
import { StatusBadge } from "@/components/StatusBadge";
import SessionCommentsThread from "@/components/session-comments/SessionCommentsThread";
import SessionExerciseSummary, { readoutBadgeClass } from "@/components/workout-sessions/SessionExerciseSummary";
import { Button } from "@/components/ui/button";
import { isEditWindowOpen } from "@/lib/guided-workout/edit-window";
import { formatSessionOverviewDate } from "@/lib/guided-workout/format-session-date";
import { sessionStatusLabel, sessionStatusToBadgeStatus } from "@/lib/session-status";
import { deriveSessionReadout } from "@/lib/trainer-dashboard/readout";
import { toExerciseReadoutInputs } from "@/lib/trainer-dashboard/to-exercise-readout-input";
import { mobileStickyActionBarClass, surfaceCardClass } from "@/lib/ui-classes";
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
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Calendar
        </a>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-foreground text-3xl font-bold tracking-tight">{session.name ?? "Workout"}</h1>
          <StatusBadge status={sessionStatusToBadgeStatus(session.status)}>
            {sessionStatusLabel(session.status)}
          </StatusBadge>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">{formatSessionOverviewDate(session.scheduled_date)}</p>
        <EditWindowBanner lockedAt={session.locked_at} hasLogs={hasLogs} />
      </header>

      <div className="space-y-4 pb-36 md:pb-28">
        <section className={cn(surfaceCardClass, "p-5")}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Trainer</dt>
              <dd className="text-foreground mt-0.5 font-medium">{session.trainer_display_name || "Your trainer"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="text-foreground mt-0.5 font-medium">{sessionStatusLabel(session.status)}</dd>
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
              <dd className="text-foreground mt-0.5 font-medium">
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
        <div className={mobileStickyActionBarClass}>
          <div className="mx-auto max-w-2xl">
            <Button type="button" className="min-h-12 w-full text-base font-semibold" onClick={onEdit}>
              Edit
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
