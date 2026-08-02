import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import PhaseBreakdown from "@/components/guided-workout/PhaseBreakdown";
import SessionCommentsThread from "@/components/session-comments/SessionCommentsThread";
import { Button } from "@/components/ui/button";
import { formatSessionOverviewDate } from "@/lib/guided-workout/format-session-date";
import { errorBannerClass, mobileStickyActionBarClass, surfaceCardClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { ClientSessionDetail } from "@/lib/workout-sessions/service";

interface SessionOverviewProps {
  session: ClientSessionDetail;
  beginPending: boolean;
  beginError: string | null;
  onBegin: () => void;
  currentUserId: string;
  onCancel: () => Promise<void>;
}

export default function SessionOverview({
  session,
  beginPending,
  beginError,
  onBegin,
  currentUserId,
  onCancel,
}: SessionOverviewProps) {
  const isPreStart = session.status === "not_started";
  const trainerNote = session.exercises.find((exercise) => exercise.notes)?.notes ?? null;
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function handleCancelConfirm() {
    setCancelPending(true);
    setCancelError(null);

    try {
      await onCancel();
      setCancelOpen(false);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel session");
    } finally {
      setCancelPending(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col">
      <header className="mb-6 grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <a
          href="/client/plan"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Calendar
        </a>
        <h1 className="text-foreground truncate text-center text-lg font-bold sm:text-xl">
          {session.name ?? "Workout"}
        </h1>
        <span className="min-w-11" aria-hidden="true" />
      </header>

      <div className="space-y-4 pb-36 md:pb-28">
        <section className={cn(surfaceCardClass, "p-5")}>
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Assigned by</dt>
              <dd className="text-foreground text-right font-medium">
                {session.trainer_display_name || "Your trainer"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Date</dt>
              <dd className="text-foreground text-right font-medium">
                {formatSessionOverviewDate(session.scheduled_date)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Total exercises</dt>
              <dd className="text-foreground text-right font-medium">{session.exercises.length}</dd>
            </div>
          </dl>
        </section>

        {trainerNote ? (
          <section className={cn(surfaceCardClass, "p-5")}>
            <h2 className="text-muted-foreground text-sm font-medium">Trainer note</h2>
            <p className="text-foreground/90 mt-2 text-sm leading-relaxed">{trainerNote}</p>
          </section>
        ) : null}

        <section>
          <PhaseBreakdown exercises={session.exercises} />
        </section>

        <SessionCommentsThread sessionId={session.id} currentUserId={currentUserId} />

        {beginError ? <p className={errorBannerClass}>{beginError}</p> : null}
      </div>

      <div className={mobileStickyActionBarClass}>
        <div className="mx-auto max-w-2xl space-y-2">
          {cancelError ? <p className={errorBannerClass}>{cancelError}</p> : null}
          <Button
            type="button"
            className="min-h-12 w-full text-base font-semibold"
            disabled={beginPending || session.exercises.length === 0}
            onClick={onBegin}
          >
            {beginPending ? "Starting…" : "Begin Workout"}
          </Button>
          {isPreStart ? (
            <Button
              type="button"
              variant="outline"
              className="border-muted-foreground/30 bg-muted text-muted-foreground hover:bg-accent min-h-11 w-full"
              disabled={cancelPending}
              onClick={() => {
                setCancelOpen(true);
              }}
            >
              Cancel Session
            </Button>
          ) : null}
          {isPreStart ? (
            <DeleteConfirmDialog
              open={cancelOpen}
              onOpenChange={setCancelOpen}
              title="Cancel this session?"
              description="The session will be marked as cancelled and you won't be able to log it later."
              confirmLabel="Cancel session"
              loading={cancelPending}
              onConfirm={() => {
                void handleCancelConfirm();
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
