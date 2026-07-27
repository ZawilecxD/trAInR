import { useMemo } from "react";
import { type PlanCalendarSession } from "@/components/plans/PlanCalendar";
import { Badge } from "@/components/ui/badge";
import { groupSessionsByWeekDays } from "@/lib/week-view";
import { sessionStatusBadgeClass, sessionStatusLabel } from "@/lib/session-status";
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
    <section className="border-border bg-card rounded-2xl border p-4 backdrop-blur-xl md:p-5">
      <ul className="space-y-4">
        {weekDays.map((day) => (
          <li key={day.isoDate}>
            <h3 className="mb-2 text-sm font-semibold text-white">
              {day.date.toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </h3>
            {day.sessions.length === 0 ? (
              <div className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-2 text-sm">
                Rest day
              </div>
            ) : (
              <ul className="space-y-2">
                {day.sessions.map((session) => (
                  <li key={session.id}>
                    <a
                      href={`/client/sessions/${session.id}`}
                      className="border-border bg-card hover:bg-accent flex min-h-11 items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <span className="block truncate font-medium text-white">{session.name}</span>
                        <Badge variant="outline" className={cn("mt-1", sessionStatusBadgeClass(session.status))}>
                          {sessionStatusLabel(session.status)}
                        </Badge>
                      </div>
                      <span className="text-text-soft shrink-0 text-sm font-medium">Open</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
