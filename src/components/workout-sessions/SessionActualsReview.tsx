import SessionCommentsThread from "@/components/session-comments/SessionCommentsThread";
import SessionExerciseSummary, { readoutBadgeClass } from "@/components/workout-sessions/SessionExerciseSummary";
import { formatSessionOverviewDate } from "@/lib/guided-workout/format-session-date";
import type { TrainerSessionDetail } from "@/lib/workout-sessions/service";
import { cn } from "@/lib/utils";

interface SessionActualsReviewProps {
  session: TrainerSessionDetail;
  sessionId: string;
  currentUserId: string;
}

export default function SessionActualsReview({ session, sessionId, currentUserId }: SessionActualsReviewProps) {
  const notesByExerciseId = new Map(session.exercises.map((exercise) => [exercise.id, exercise.notes]));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-blue-100/60">Client</dt>
            <dd className="mt-0.5 font-medium text-white">{session.client_display_name}</dd>
          </div>
          <div>
            <dt className="text-blue-100/60">Scheduled</dt>
            <dd className="mt-0.5 font-medium text-white">{formatSessionOverviewDate(session.scheduled_date)}</dd>
          </div>
          <div>
            <dt className="text-blue-100/60">Logging status</dt>
            <dd className="mt-0.5">
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  readoutBadgeClass(session.readout.status),
                )}
              >
                {session.readout.statusLabel}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-blue-100/60">Sets logged</dt>
            <dd className="mt-0.5 font-medium text-white">
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
