import { ArrowLeft } from "lucide-react";
import EditWindowBanner from "@/components/guided-workout/EditWindowBanner";
import SessionCommentsThread from "@/components/session-comments/SessionCommentsThread";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isEditWindowOpen } from "@/lib/guided-workout/edit-window";
import { formatSessionOverviewDate } from "@/lib/guided-workout/format-session-date";
import { sessionStatusBadgeClass, sessionStatusLabel } from "@/lib/session-status";
import { cn } from "@/lib/utils";
import type { ClientSessionDetail } from "@/lib/workout-sessions/service";

interface SessionCompletedViewProps {
  session: ClientSessionDetail;
  currentUserId: string;
  onEdit?: () => void;
}

export default function SessionCompletedView({ session, currentUserId, onEdit }: SessionCompletedViewProps) {
  const hasLogs = session.exercises.some((exercise) => exercise.logs.length > 0);
  const canEdit = isEditWindowOpen(session.status, session.locked_at);

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
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-white">{session.name ?? "Workout"}</h1>
          <Badge variant="outline" className={cn("text-xs", sessionStatusBadgeClass(session.status))}>
            {sessionStatusLabel(session.status)}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-blue-100/70">{formatSessionOverviewDate(session.scheduled_date)}</p>
        <EditWindowBanner lockedAt={session.locked_at} hasLogs={hasLogs} />
      </header>

      <div className="space-y-4 pb-28">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-blue-100/60">Trainer</dt>
              <dd className="text-right font-medium text-white">{session.trainer_display_name || "Your trainer"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-blue-100/60">Status</dt>
              <dd className="text-right font-medium text-white">{sessionStatusLabel(session.status)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-blue-100/60">Exercises</dt>
              <dd className="text-right font-medium text-white">{session.exercises.length}</dd>
            </div>
          </dl>
        </section>

        <p className="text-sm text-blue-100/60">
          {session.status === "cancelled"
            ? "This session has been cancelled."
            : "Your workout has been recorded. Your trainer can see the results."}
        </p>

        <SessionCommentsThread sessionId={session.id} currentUserId={currentUserId} />
      </div>

      {canEdit && onEdit ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-slate-950/90 p-4 backdrop-blur-xl">
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
