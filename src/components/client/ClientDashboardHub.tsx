import { Play } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { clientSessionChip } from "@/lib/session-status";
import { surfaceCardClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/types";

export interface ClientDashboardSession {
  id: string;
  name: string | null;
  scheduled_date: string;
  status: SessionStatus;
  started_at?: string | null;
}

interface ClientDashboardHubProps {
  clientName: string;
  trainerName: string | null;
  greeting: string;
  todayIso: string;
  focusSession: ClientDashboardSession | null;
  upcomingSessions: ClientDashboardSession[];
  hasActivePlan: boolean;
  loadError: string | null;
}

function formatSessionDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function focusCtaLabel(session: ClientDashboardSession): string {
  const chip = clientSessionChip(session.status, session.started_at);
  return chip.label === "In progress" ? "Resume Workout" : "Start Workout";
}

export default function ClientDashboardHub({
  clientName,
  trainerName,
  greeting,
  todayIso,
  focusSession,
  upcomingSessions,
  hasActivePlan,
  loadError,
}: ClientDashboardHubProps) {
  const focusChip = focusSession ? clientSessionChip(focusSession.status, focusSession.started_at) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-1">
        <p className="label-caps text-muted-foreground">{greeting}</p>
        <h1 className="headline-lg text-foreground">{clientName}</h1>
        {trainerName ? (
          <p className="text-muted-foreground text-sm">
            Training with <span className="text-foreground font-medium">{trainerName}</span>
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">Your trainer will appear here once you are assigned.</p>
        )}
      </header>

      {loadError ? (
        <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
          {loadError}
        </p>
      ) : null}

      {!hasActivePlan && !loadError ? (
        <EmptyState
          title="No active plan yet"
          description="Your trainer will assign a plan soon. Check back here for your next session."
          action={
            <a
              href="/client/plan"
              className="bg-primary text-primary-foreground inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] px-5 text-sm font-semibold"
            >
              Open calendar
            </a>
          }
        />
      ) : null}

      {hasActivePlan && !focusSession && !loadError ? (
        <EmptyState
          title="No upcoming sessions"
          description="Nothing scheduled from today onward. Browse your calendar or wait for your trainer to assign workouts."
          action={
            <a
              href="/client/plan"
              className="bg-primary text-primary-foreground inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] px-5 text-sm font-semibold"
            >
              Open calendar
            </a>
          }
        />
      ) : null}

      {focusSession ? (
        <section className={cn(surfaceCardClass, "space-y-4 p-5")}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="label-caps text-muted-foreground">
                {focusSession.scheduled_date === todayIso ? "Today" : "Next session"}
              </p>
              <h2 className="text-foreground mt-1 text-2xl font-bold tracking-tight">
                {focusSession.name ?? "Workout"}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">{formatSessionDate(focusSession.scheduled_date)}</p>
            </div>
            {focusChip ? <StatusBadge status={focusChip.status}>{focusChip.label}</StatusBadge> : null}
          </div>

          <a
            href={`/client/sessions/${focusSession.id}`}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] text-base font-semibold transition-colors"
          >
            <Play className="size-4 fill-current" aria-hidden="true" />
            {focusCtaLabel(focusSession)}
          </a>
        </section>
      ) : null}

      {upcomingSessions.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="label-caps text-muted-foreground">Upcoming</h2>
            <a href="/client/plan" className="text-primary text-sm font-medium hover:underline">
              View all
            </a>
          </div>
          <ul className="space-y-2">
            {upcomingSessions.map((session) => {
              const chip = clientSessionChip(session.status, session.started_at);
              return (
                <li key={session.id}>
                  <a
                    href={`/client/sessions/${session.id}`}
                    className={cn(
                      surfaceCardClass,
                      "hover:bg-accent flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition-colors",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-foreground truncate font-medium">{session.name ?? "Workout"}</p>
                      <p className="text-muted-foreground text-sm">{formatSessionDate(session.scheduled_date)}</p>
                    </div>
                    <StatusBadge status={chip.status}>{chip.label}</StatusBadge>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
