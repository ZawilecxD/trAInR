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
          className="inline-flex min-h-11 items-center gap-2 text-sm text-blue-100/70 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Calendar
        </a>
        <h1 className="mt-4 text-3xl font-bold text-white">{session.name ?? "Workout"}</h1>
      </header>

      <div className="space-y-4 pb-28">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-blue-100/60">Assigned by</dt>
              <dd className="text-right font-medium text-white">{session.trainer_display_name || "Your trainer"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-blue-100/60">Date</dt>
              <dd className="text-right font-medium text-white">{formatSessionOverviewDate(session.scheduled_date)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-blue-100/60">Total exercises</dt>
              <dd className="text-right font-medium text-white">{session.exercises.length}</dd>
            </div>
          </dl>
        </section>

        {trainerNote ? (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <h2 className="text-sm font-medium text-blue-100/80">Trainer note</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/90">{trainerNote}</p>
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 text-sm font-medium text-blue-100/80">Phase breakdown</h2>
          <PhaseBreakdown exercises={session.exercises} />
        </section>

        <SessionCommentsThread sessionId={session.id} currentUserId={currentUserId} />

        {beginError ? (
          <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {beginError}
          </p>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-slate-950/90 p-4 backdrop-blur-xl">
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
              className="min-h-11 w-full border-slate-500/30 bg-slate-500/10 text-slate-300 hover:bg-slate-500/20"
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
