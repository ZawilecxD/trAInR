import { useMemo } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { type PlanCalendarSession } from "@/lib/plans/calendar-session";
import { groupSessionsByWeekDays } from "@/lib/week-view";
import { clientSessionChip } from "@/lib/session-status";
import { surfaceCardClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface ClientWeekViewProps {
  sessions: PlanCalendarSession[];
  weekStart: Date;
}

export default function ClientWeekView({ sessions, weekStart }: ClientWeekViewProps) {
  const weekDays = useMemo(() => {
    const buckets = groupSessionsByWeekDays(sessions, weekStart);
    return buckets.map((bucket) => ({
      ...bucket,
      sessions: [...bucket.sessions].sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [sessions, weekStart]);

  return (
    <section className={cn(surfaceCardClass, "p-4 md:p-5")}>
      <ul className="space-y-4">
        {weekDays.map((day) => (
          <li key={day.isoDate}>
            <h3 className="text-foreground mb-2 text-sm font-semibold">
              {day.date.toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </h3>
            {day.sessions.length === 0 ? (
              <div className="border-border text-muted-foreground rounded-[var(--radius)] border border-dashed px-4 py-2 text-sm">
                Rest day
              </div>
            ) : (
              <ul className="space-y-2">
                {day.sessions.map((session) => {
                  const chip = clientSessionChip(session.status, session.started_at);
                  return (
                    <li key={session.id}>
                      <a
                        href={`/client/sessions/${session.id}`}
                        className="border-border bg-card hover:bg-accent flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius)] border px-4 py-3 transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="text-foreground block truncate font-medium">{session.name}</span>
                          <StatusBadge status={chip.status} className="mt-1">
                            {chip.label}
                          </StatusBadge>
                        </div>
                        <span className="text-text-soft shrink-0 text-sm font-medium">Open</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
