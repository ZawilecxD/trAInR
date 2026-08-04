import SessionCommentsThread from "@/components/session-comments/SessionCommentsThread";
import { StatusBadge, type StatusBadgeStatus } from "@/components/StatusBadge";
import SessionExerciseSummary from "@/components/workout-sessions/SessionExerciseSummary";
import { formatSessionOverviewDate } from "@/lib/guided-workout/format-session-date";
import type { ReadoutStatus } from "@/lib/trainer-dashboard/readout";
import type { TrainerSessionDetail } from "@/lib/workout-sessions/service";
import { surfaceCardClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface SessionActualsReviewProps {
  session: TrainerSessionDetail;
  sessionId: string;
  currentUserId: string;
}

function readoutStatusBadge(status: ReadoutStatus): StatusBadgeStatus {
  switch (status) {
    case "fully_logged":
      return "success";
    case "in_progress":
      return "warning";
    case "not_logged":
      return "muted";
  }
}

export default function SessionActualsReview({ session, sessionId, currentUserId }: SessionActualsReviewProps) {
  const notesByExerciseId = new Map(session.exercises.map((exercise) => [exercise.id, exercise.notes]));

  return (
    <div className="space-y-6">
      <section className={cn(surfaceCardClass, "p-5")}>
        <p className="text-text-soft label-caps mb-4">Session summary</p>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Client</dt>
            <dd className="text-foreground mt-0.5 font-medium">{session.client_display_name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Scheduled</dt>
            <dd className="text-foreground mt-0.5 font-medium">{formatSessionOverviewDate(session.scheduled_date)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Logging status</dt>
            <dd className="mt-1.5">
              <StatusBadge status={readoutStatusBadge(session.readout.status)}>
                {session.readout.statusLabel}
              </StatusBadge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Sets logged</dt>
            <dd className="text-foreground data-mono mt-0.5 text-base font-medium">
              {session.readout.completedSets} of {session.readout.totalSets}
            </dd>
          </div>
        </dl>
      </section>

      <SessionExerciseSummary readout={session.readout} notesByExerciseId={notesByExerciseId} />

      <SessionCommentsThread sessionId={sessionId} currentUserId={currentUserId} />
    </div>
  );
}
