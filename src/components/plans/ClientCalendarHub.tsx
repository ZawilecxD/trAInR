import { useMemo, useState } from "react";
import PlanCalendar, { type PlanCalendarSession } from "@/components/plans/PlanCalendar";
import { Badge } from "@/components/ui/badge";
import { monthRange, parseISODate, toLocalISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/types";

interface ClientCalendarHubProps {
  initialSessions: PlanCalendarSession[];
  initialSelectedDate: string;
  initialMonth: string;
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

async function fetchMySessions(from: string, to: string): Promise<PlanCalendarSession[]> {
  const params = new URLSearchParams({ from, to });
  const response = await fetch(`/api/client/sessions?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to load sessions (${response.status})`);
  }
  const body = (await response.json()) as {
    sessions?: (Omit<PlanCalendarSession, "name"> & { name: string | null })[];
  };
  return (body.sessions ?? []).map((session) => ({
    ...session,
    name: session.name ?? "Workout",
  }));
}

export default function ClientCalendarHub({
  initialSessions,
  initialSelectedDate,
  initialMonth,
}: ClientCalendarHubProps) {
  const initialMonthDate = parseISODate(`${initialMonth}-01`);
  const [month, setMonth] = useState(initialMonthDate);
  const [selectedDate, setSelectedDate] = useState(parseISODate(initialSelectedDate));
  const [sessions, setSessions] = useState(initialSessions);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const selectedIso = toLocalISODate(selectedDate);

  const sessionsOnSelectedDay = useMemo(
    () =>
      sessions.filter((session) => session.scheduled_date === selectedIso).sort((a, b) => a.name.localeCompare(b.name)),
    [sessions, selectedIso],
  );

  async function handleMonthChange(nextMonth: Date) {
    setMonth(nextMonth);
    setLoadingMonth(true);
    setFetchError(null);
    try {
      const range = monthRange(nextMonth.getFullYear(), nextMonth.getMonth());
      setSelectedDate(parseISODate(range.from));
      const nextSessions = await fetchMySessions(range.from, range.to);
      setSessions(nextSessions);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoadingMonth(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
      <section className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-blue-100/80">Calendar</h2>
          {loadingMonth ? <span className="text-xs text-blue-100/50">Loading…</span> : null}
          {fetchError ? <span className="text-xs text-red-400/80">{fetchError}</span> : null}
        </div>
        <PlanCalendar
          sessions={sessions}
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            if (date) {
              setSelectedDate(date);
            }
          }}
          month={month}
          onMonthChange={(nextMonth) => {
            void handleMonthChange(nextMonth);
          }}
        />
        {sessions.length === 0 ? (
          <p className="mt-4 text-center text-sm text-blue-100/60">No sessions yet — your trainer will add them.</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">
            {selectedDate.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h2>
          <p className="text-sm text-blue-100/60">Your training plan</p>
        </div>

        {sessionsOnSelectedDay.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 px-4 py-8 text-center text-sm text-blue-100/60">
            No sessions on this day.
          </div>
        ) : (
          <ul className="space-y-2">
            {sessionsOnSelectedDay.map((session) => (
              <li key={session.id} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <span className="block truncate font-medium text-white">{session.name}</span>
                <Badge variant="outline" className={cn("mt-1", statusBadgeClass(session.status))}>
                  {statusLabel(session.status)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
