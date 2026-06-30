import { endOfWeek, startOfWeek } from "date-fns";

/** Format a local calendar date as YYYY-MM-DD (no timezone shift). */
export function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function monthRange(year: number, monthIndex: number): { from: string; to: string } {
  const from = new Date(year, monthIndex, 1);
  const to = new Date(year, monthIndex + 1, 0);
  return { from: toLocalISODate(from), to: toLocalISODate(to) };
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Range covering every day visible in the month calendar grid, including the
 * leading/trailing days from adjacent months that react-day-picker renders
 * (week starts on Sunday, matching the calendar's default locale).
 */
export function visibleMonthRange(year: number, monthIndex: number): { from: string; to: string } {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const lastOfMonth = new Date(year, monthIndex + 1, 0);
  const from = startOfWeek(firstOfMonth, { weekStartsOn: 0 });
  const to = endOfWeek(lastOfMonth, { weekStartsOn: 0 });
  return { from: toLocalISODate(from), to: toLocalISODate(to) };
}
