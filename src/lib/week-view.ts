import { addDays, format, startOfWeek } from "date-fns";
import { toLocalISODate } from "@/lib/dates";

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function weekRange(weekStart: Date): { from: string; to: string } {
  return {
    from: toLocalISODate(weekStart),
    to: toLocalISODate(addDays(weekStart, 6)),
  };
}

export function formatWeekRangeLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  if (sameMonth) {
    return `${format(weekStart, "MMM d")} – ${format(weekEnd, "d, yyyy")}`;
  }
  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
  if (sameYear) {
    return `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;
  }
  return `${format(weekStart, "MMM d, yyyy")} – ${format(weekEnd, "MMM d, yyyy")}`;
}

export interface WeekDayBucket<T extends { scheduled_date: string }> {
  date: Date;
  isoDate: string;
  sessions: T[];
}

export function groupSessionsByWeekDays<T extends { scheduled_date: string }>(
  sessions: T[],
  weekStart: Date,
): WeekDayBucket<T>[] {
  const byDate = new Map<string, T[]>();
  for (const session of sessions) {
    const existing = byDate.get(session.scheduled_date) ?? [];
    existing.push(session);
    byDate.set(session.scheduled_date, existing);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const isoDate = toLocalISODate(date);
    return {
      date,
      isoDate,
      sessions: byDate.get(isoDate) ?? [],
    };
  });
}
