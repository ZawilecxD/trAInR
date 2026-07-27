import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import PhaseBreakdown from "@/components/guided-workout/PhaseBreakdown";
import SessionCommentsThread from "@/components/session-comments/SessionCommentsThread";
import { Button } from "@/components/ui/button";
import { formatSessionOverviewDate } from "@/lib/guided-workout/format-session-date";
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
      <header className="mb-6">
        <a
          href="/client/plan"
          className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Calendar
        </a>
        <h1 className="mt-4 text-3xl font-bold text-white">{session.name ?? "Workout"}</h1>
      </header>

      <div className="space-y-4 pb-28">
        <section className="border-border bg-card rounded-2xl border p-5 backdrop-blur-xl">
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Assigned by</dt>
              <dd className="text-right font-medium text-white">{session.trainer_display_name || "Your trainer"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Date</dt>
              <dd className="text-right font-medium text-white">{formatSessionOverviewDate(session.scheduled_date)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Total exercises</dt>
              <dd className="text-right font-medium text-white">{session.exercises.length}</dd>
            </div>
          </dl>
        </section>

        {trainerNote ? (
          <section className="border-border bg-card rounded-2xl border p-5 backdrop-blur-xl">
            <h2 className="text-muted-foreground text-sm font-medium">Trainer note</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/90">{trainerNote}</p>
          </section>
        ) : null}

        <section>
          <h2 className="text-muted-foreground mb-3 text-sm font-medium">Phase breakdown</h2>
          <PhaseBreakdown exercises={session.exercises} />
        </section>

        <SessionCommentsThread sessionId={session.id} currentUserId={currentUserId} />

        {beginError ? (
          <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {beginError}
          </p>
        ) : null}
      </div>

      <div className="border-border bg-background/90 fixed inset-x-0 bottom-0 border-t p-4 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl space-y-2">
          {cancelError ? (
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-100">
              {cancelError}
            </p>
          ) : null}
          <Button
            type="button"
            className="min-h-12 w-full text-base"
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
