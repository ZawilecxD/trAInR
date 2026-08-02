import { addDays, differenceInCalendarDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import ClientWeekView from "@/components/plans/ClientWeekView";
import PlanCalendar from "@/components/plans/PlanCalendar";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { monthRange, parseISODate, startOfMonth, toLocalISODate, visibleMonthRange } from "@/lib/dates";
import { type PlanCalendarSession } from "@/lib/plans/calendar-session";
import { formatWeekRangeLabel, getWeekStart, weekRange } from "@/lib/week-view";
import { clientSessionChip } from "@/lib/session-status";
import { surfaceCardClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface ClientCalendarHubProps {
  initialSessions: PlanCalendarSession[];
  initialSelectedDate: string;
  initialMonth: string;
}

type CalendarView = "month" | "week";

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
  const initialSelected = parseISODate(initialSelectedDate);
  const initialMonthDate = parseISODate(`${initialMonth}-01`);

  const [view, setView] = useState<CalendarView>("month");
  const [month, setMonth] = useState(initialMonthDate);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(initialSelected));
  const [selectedDate, setSelectedDate] = useState(initialSelected);
  const [sessions, setSessions] = useState(initialSessions);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const selectedIso = toLocalISODate(selectedDate);

  const sessionsOnSelectedDay = useMemo(
    () =>
      sessions.filter((session) => session.scheduled_date === selectedIso).sort((a, b) => a.name.localeCompare(b.name)),
    [sessions, selectedIso],
  );

  async function loadSessions(from: string, to: string) {
    const req = ++requestRef.current;
    setLoading(true);
    setFetchError(null);
    try {
      const nextSessions = await fetchMySessions(from, to);
      if (req !== requestRef.current) return;
      setSessions(nextSessions);
    } catch (err) {
      if (req !== requestRef.current) return;
      setFetchError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      if (req === requestRef.current) setLoading(false);
    }
  }

  async function handleMonthChange(nextMonth: Date) {
    setMonth(nextMonth);
    const monthStart = monthRange(nextMonth.getFullYear(), nextMonth.getMonth());
    setSelectedDate(parseISODate(monthStart.from));
    const range = visibleMonthRange(nextMonth.getFullYear(), nextMonth.getMonth());
    await loadSessions(range.from, range.to);
  }

  async function handleSelectDate(date: Date | undefined) {
    if (!date) {
      return;
    }
    setSelectedDate(date);
    const isOutsideMonth = date.getFullYear() !== month.getFullYear() || date.getMonth() !== month.getMonth();
    if (!isOutsideMonth) {
      return;
    }
    const nextMonth = startOfMonth(date);
    setMonth(nextMonth);
    const range = visibleMonthRange(nextMonth.getFullYear(), nextMonth.getMonth());
    await loadSessions(range.from, range.to);
  }

  async function handleWeekChange(direction: "prev" | "next") {
    const offset = differenceInCalendarDays(selectedDate, weekStart);
    const delta = direction === "prev" ? -7 : 7;
    const nextWeekStart = addDays(weekStart, delta);
    setWeekStart(nextWeekStart);
    setSelectedDate(addDays(nextWeekStart, offset));
    const range = weekRange(nextWeekStart);
    await loadSessions(range.from, range.to);
  }

  async function handleViewChange(nextView: CalendarView) {
    if (nextView === view) {
      return;
    }

    setView(nextView);

    if (nextView === "week") {
      const nextWeekStart = getWeekStart(selectedDate);
      setWeekStart(nextWeekStart);
      const range = weekRange(nextWeekStart);
      await loadSessions(range.from, range.to);
      return;
    }

    const nextMonth = startOfMonth(selectedDate);
    setMonth(nextMonth);
    const range = visibleMonthRange(nextMonth.getFullYear(), nextMonth.getMonth());
    await loadSessions(range.from, range.to);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="border-border bg-card flex rounded-[var(--radius)] border p-1"
          role="tablist"
          aria-label="Calendar view"
        >
          {(["month", "week"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={view === option}
              className={cn(
                "min-h-11 min-w-24 flex-1 rounded-md px-4 text-sm font-medium capitalize transition-colors",
                view === option ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                void handleViewChange(option);
              }}
            >
              {option}
            </button>
          ))}
        </div>

        {view === "week" ? (
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-border bg-card hover:bg-accent text-foreground size-11 shrink-0"
              aria-label="Previous week"
              onClick={() => {
                void handleWeekChange("prev");
              }}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <span className="text-foreground min-w-0 text-center text-sm font-medium sm:min-w-48">
              {formatWeekRangeLabel(weekStart)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-border bg-card hover:bg-accent text-foreground size-11 shrink-0"
              aria-label="Next week"
              onClick={() => {
                void handleWeekChange("next");
              }}
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
        ) : null}
      </div>

      {loading ? <p className="text-muted-foreground text-xs">Loading…</p> : null}
      {fetchError ? <p className="text-destructive/80 text-xs">{fetchError}</p> : null}

      {view === "month" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
          <section className={cn(surfaceCardClass, "min-w-0 p-4")}>
            <PlanCalendar
              sessions={sessions}
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                void handleSelectDate(date);
              }}
              month={month}
              onMonthChange={(nextMonth) => {
                void handleMonthChange(nextMonth);
              }}
            />
            <ul className="text-muted-foreground mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs">
              <li className="inline-flex items-center gap-1.5">
                <span className="bg-success size-1.5 rounded-full" aria-hidden="true" />
                Completed
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="bg-warning size-1.5 rounded-full" aria-hidden="true" />
                Partial
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="bg-primary size-1.5 rounded-full" aria-hidden="true" />
                Scheduled
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="bg-muted-foreground/50 size-1.5 rounded-full" aria-hidden="true" />
                Rest
              </li>
            </ul>
            {sessions.length === 0 ? (
              <p className="text-muted-foreground mt-4 text-center text-sm">
                No sessions yet — your trainer will add them.
              </p>
            ) : null}
          </section>

          <section className={cn(surfaceCardClass, "p-5")}>
            <div className="mb-4">
              <h2 className="text-foreground text-lg font-semibold">
                {selectedDate.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              <p className="text-muted-foreground text-sm">Your training plan</p>
            </div>

            {sessionsOnSelectedDay.length === 0 ? (
              <EmptyState title="Rest day" description="No sessions on this day." className="border-dashed" />
            ) : (
              <ul className="space-y-3">
                {sessionsOnSelectedDay.map((session) => {
                  const chip = clientSessionChip(session.status, session.started_at);
                  return (
                    <li key={session.id} className={cn(surfaceCardClass, "space-y-3 p-4")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-foreground truncate text-lg font-semibold">{session.name}</p>
                          <div className="mt-2">
                            <StatusBadge status={chip.status}>{chip.label}</StatusBadge>
                          </div>
                        </div>
                      </div>
                      <a
                        href={`/client/sessions/${session.id}`}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius)] text-sm font-semibold transition-colors"
                      >
                        View Full Session
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          <ClientWeekView sessions={sessions} weekStart={weekStart} />
          {sessions.length === 0 ? (
            <EmptyState
              title="No sessions yet"
              description="Your trainer will add workouts to your plan."
              className="border-dashed"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
