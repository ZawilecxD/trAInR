import { describe, expect, it } from "vitest";
import { parseISODate } from "@/lib/dates";
import { formatWeekRangeLabel, getWeekStart, groupSessionsByWeekDays, weekRange } from "@/lib/week-view";

describe("getWeekStart", () => {
  it("returns Monday for a Wednesday in the same week", () => {
    const wednesday = parseISODate("2026-06-10");
    const weekStart = getWeekStart(wednesday);
    expect(weekStart.getDay()).toBe(1);
    expect(weekStart.toISOString().slice(0, 10)).not.toBe("2026-06-10");
    expect(weekStart.getDate()).toBe(8);
    expect(weekStart.getMonth()).toBe(5);
  });

  it("returns the same Monday when the date is already Monday", () => {
    const monday = parseISODate("2026-06-08");
    const weekStart = getWeekStart(monday);
    expect(weekStart.getFullYear()).toBe(2026);
    expect(weekStart.getMonth()).toBe(5);
    expect(weekStart.getDate()).toBe(8);
  });
});

describe("weekRange", () => {
  it("spans Monday through Sunday for a Monday week start", () => {
    const weekStart = parseISODate("2026-06-08");
    expect(weekRange(weekStart)).toEqual({ from: "2026-06-08", to: "2026-06-14" });
  });
});

describe("groupSessionsByWeekDays", () => {
  it("places sessions in the correct day buckets across week boundaries", () => {
    const weekStart = parseISODate("2026-06-08");
    const sessions = [
      { id: "1", scheduled_date: "2026-06-08", name: "Monday session" },
      { id: "2", scheduled_date: "2026-06-14", name: "Sunday session" },
      { id: "3", scheduled_date: "2026-06-10", name: "Wednesday session" },
    ];

    const buckets = groupSessionsByWeekDays(sessions, weekStart);

    expect(buckets).toHaveLength(7);
    expect(buckets[0].isoDate).toBe("2026-06-08");
    expect(buckets[0].sessions).toHaveLength(1);
    expect(buckets[2].isoDate).toBe("2026-06-10");
    expect(buckets[2].sessions).toHaveLength(1);
    expect(buckets[6].isoDate).toBe("2026-06-14");
    expect(buckets[6].sessions).toHaveLength(1);
    expect(buckets[1].sessions).toHaveLength(0);
    expect(buckets[3].sessions).toHaveLength(0);
  });

  it("returns empty buckets for days without sessions", () => {
    const weekStart = parseISODate("2026-06-08");
    const buckets = groupSessionsByWeekDays([], weekStart);
    expect(buckets).toHaveLength(7);
    expect(buckets.every((bucket) => bucket.sessions.length === 0)).toBe(true);
  });
});

describe("formatWeekRangeLabel", () => {
  it("formats a range within the same month", () => {
    const weekStart = parseISODate("2026-06-08");
    expect(formatWeekRangeLabel(weekStart)).toBe("Jun 8 – 14, 2026");
  });

  it("formats a range spanning two months in the same year", () => {
    const weekStart = parseISODate("2026-05-26");
    expect(formatWeekRangeLabel(weekStart)).toBe("May 26 – Jun 1, 2026");
  });
});
