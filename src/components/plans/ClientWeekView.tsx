import { useMemo } from "react";
import { type PlanCalendarSession } from "@/components/plans/PlanCalendar";
import { Badge } from "@/components/ui/badge";
import { groupSessionsByWeekDays } from "@/lib/week-view";
import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/types";

interface ClientWeekViewProps {
  sessions: PlanCalendarSession[];
  weekStart: Date;
}

function statusLabel(status: SessionStatus): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "finished":
      return "Finished";
    case "finished_partially":
      return "Partial";
  }
}

function statusBadgeClass(status: SessionStatus): string {
  switch (status) {
    case "not_started":
      return "border-blue-400/40 bg-blue-500/20 text-blue-100";
    case "finished":
      return "border-emerald-400/40 bg-emerald-500/20 text-emerald-100";
    case "finished_partially":
      return "border-amber-400/40 bg-amber-500/20 text-amber-100";
  }
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
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl md:p-5">
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
              <div className="rounded-lg border border-dashed border-white/10 px-4 py-2 text-sm text-blue-100/50">
                Rest day
              </div>
            ) : (
              <ul className="space-y-2">
                {day.sessions.map((session) => (
                  <li key={session.id} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <span className="block truncate font-medium text-white">{session.name}</span>
                    <Badge variant="outline" className={cn("mt-1", statusBadgeClass(session.status))}>
                      {statusLabel(session.status)}
                    </Badge>
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
