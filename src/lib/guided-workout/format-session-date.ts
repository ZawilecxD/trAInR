import { parseISODate } from "@/lib/dates";

/** Mockup overview format: `Sat, Jun 14 2026` */
export function formatSessionOverviewDate(scheduledDate: string): string {
  const date = parseISODate(scheduledDate);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
