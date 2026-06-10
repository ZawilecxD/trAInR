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

  const datesWithSessions = useMemo(
    () =>
      Array.from(sessionsByDate.keys()).map((iso) => {
        const [year, monthPart, day] = iso.split("-").map(Number);
        return new Date(year, monthPart - 1, day);
      }),
    [sessionsByDate],
  );

  return (
    <Calendar
      mode="single"
      selected={selectedDate}
      onSelect={onSelectDate}
      month={month}
      onMonthChange={onMonthChange}
      modifiers={{ hasSession: datesWithSessions }}
      modifiersClassNames={{
        hasSession: cn(
          "relative font-semibold",
          "after:absolute after:bottom-1 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:bg-purple-400",
        ),
      }}
      className="mx-auto rounded-xl border border-white/10 bg-white/5 p-2 text-white [--cell-size:2.5rem] md:[--cell-size:2.75rem]"
      classNames={{
        caption_label: "text-base font-semibold text-white",
        weekday: "w-10 text-xs text-blue-100/60",
        day_button: cn(
          "size-10 rounded-lg text-white hover:bg-white/10",
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
