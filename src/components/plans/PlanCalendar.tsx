import { useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/types";

export interface PlanCalendarSession {
  id: string;
  scheduled_date: string;
  name: string;
  status: SessionStatus;
}

interface PlanCalendarProps {
  sessions: PlanCalendarSession[];
  selectedDate: Date;
  onSelectDate: (date: Date | undefined) => void;
  month: Date;
  onMonthChange: (month: Date) => void;
}

const STATUS_PRIORITY: Record<SessionStatus, number> = {
  not_started: 3,
  finished_partially: 2,
  finished: 1,
  cancelled: 4,
};

function isoToLocalDate(iso: string): Date {
  const [year, monthPart, day] = iso.split("-").map(Number);
  return new Date(year, monthPart - 1, day);
}

function highestPriorityStatus(sessions: PlanCalendarSession[]): SessionStatus {
  return sessions.reduce(
    (best, session) => (STATUS_PRIORITY[session.status] > STATUS_PRIORITY[best] ? session.status : best),
    sessions[0].status,
  );
}

const sessionDotBase = cn(
  "relative font-semibold",
  "after:absolute after:bottom-1 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full",
);

export default function PlanCalendar({
  sessions,
  selectedDate,
  onSelectDate,
  month,
  onMonthChange,
}: PlanCalendarProps) {
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, PlanCalendarSession[]>();
    for (const session of sessions) {
      const existing = map.get(session.scheduled_date) ?? [];
      existing.push(session);
      map.set(session.scheduled_date, existing);
    }
    return map;
  }, [sessions]);

  const statusDates = useMemo(() => {
    const sessionNotStarted: Date[] = [];
    const sessionPartial: Date[] = [];
    const sessionFinished: Date[] = [];
    const sessionCancelled: Date[] = [];

    for (const [iso, daySessions] of sessionsByDate) {
      const date = isoToLocalDate(iso);
      const status = highestPriorityStatus(daySessions);

      switch (status) {
        case "not_started":
          sessionNotStarted.push(date);
          break;
        case "finished_partially":
          sessionPartial.push(date);
          break;
        case "finished":
          sessionFinished.push(date);
          break;
        case "cancelled":
          sessionCancelled.push(date);
          break;
      }
    }

    return { sessionNotStarted, sessionPartial, sessionFinished, sessionCancelled };
  }, [sessionsByDate]);

  return (
    <Calendar
      mode="single"
      selected={selectedDate}
      onSelect={onSelectDate}
      month={month}
      onMonthChange={onMonthChange}
      modifiers={statusDates}
      modifiersClassNames={{
        sessionNotStarted: cn(sessionDotBase, "after:bg-blue-400"),
        sessionPartial: cn(sessionDotBase, "after:bg-amber-400"),
        sessionFinished: cn(sessionDotBase, "after:bg-emerald-400"),
        sessionCancelled: cn(sessionDotBase, "after:bg-red-400"),
      }}
      className="w-full max-w-full rounded-xl border border-white/10 bg-white/5 p-2 text-white [--cell-size:2.75rem]"
      classNames={{
        caption_label: "text-base font-semibold text-white",
        weekday: "w-11 shrink-0 text-xs text-blue-100/60",
        day_button: cn(
          "size-11 rounded-lg text-white hover:bg-white/10",
          "aria-selected:bg-purple-500 aria-selected:text-white aria-selected:hover:bg-purple-500/90",
        ),
        today: "border border-purple-400/40 bg-purple-500/10 text-white",
        outside: "text-blue-100/30",
        button_previous: "border-white/20 bg-white/5 text-white hover:bg-white/10",
        button_next: "border-white/20 bg-white/5 text-white hover:bg-white/10",
      }}
    />
  );
}
