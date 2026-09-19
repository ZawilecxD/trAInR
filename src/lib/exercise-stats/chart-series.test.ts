import { describe, expect, it } from "vitest";
import type { SessionStat, WorkingSetInput } from "@/lib/exercise-stats/calculations";
import {
  areaPath,
  chronologicalSessions,
  lastNWeekStarts,
  linePath,
  plotPoints,
  primaryTrendForSessions,
  weekStartMonday,
  weeklyVolumeBuckets,
  yScaleForTrend,
} from "@/lib/exercise-stats/chart-series";

const set = (reps: number | null, loadKg: number | null, durationSeconds: number | null = null): WorkingSetInput => ({
  reps,
  loadKg,
  durationSeconds,
});

const makeStat = (overrides: Partial<SessionStat>): SessionStat => ({
  sessionId: "s",
  scheduledDate: "2026-07-10",
  loggedAt: "2026-07-10T12:00:00.000Z",
  workingSetCount: 1,
  sets: [set(5, 100)],
  topSet: set(5, 100),
  estimated1RM: 116.7,
  totalVolumeKg: 500,
  totalReps: 5,
  totalDurationSeconds: 0,
  ...overrides,
});

describe("primaryTrendForSessions", () => {
  it("prefers estimated 1RM in chronological order", () => {
    const trend = primaryTrendForSessions(
      [
        makeStat({
          sessionId: "b",
          scheduledDate: "2026-07-20",
          estimated1RM: 130,
          loggedAt: "2026-07-20T12:00:00.000Z",
        }),
        makeStat({
          sessionId: "a",
          scheduledDate: "2026-07-10",
          estimated1RM: 110,
          loggedAt: "2026-07-10T12:00:00.000Z",
        }),
      ],
      "reps_weight",
    );

    expect(trend.kind).toBe("one_rm");
    expect(trend.unit).toBe("kg");
    expect(trend.points.map((point) => point.value)).toEqual([110, 130]);
  });

  it("falls back to reps when there is no load", () => {
    const trend = primaryTrendForSessions(
      [
        makeStat({
          estimated1RM: null,
          totalVolumeKg: null,
          totalReps: 20,
          scheduledDate: "2026-07-11",
        }),
      ],
      "reps_weight",
    );

    expect(trend.kind).toBe("reps");
    expect(trend.points).toEqual([{ date: "2026-07-11", value: 20 }]);
  });

  it("uses duration for timed exercises", () => {
    const trend = primaryTrendForSessions(
      [
        makeStat({
          estimated1RM: null,
          totalVolumeKg: null,
          totalReps: 0,
          totalDurationSeconds: 90,
          scheduledDate: "2026-07-12",
        }),
      ],
      "time",
    );

    expect(trend.kind).toBe("duration");
    expect(trend.unit).toBe("s");
    expect(trend.points[0]?.value).toBe(90);
  });
});

describe("weeklyVolumeBuckets", () => {
  it("fills empty weeks and sums volume in the Monday week", () => {
    expect(weekStartMonday("2026-07-15")).toBe("2026-07-13");
    expect(lastNWeekStarts(3, "2026-07-15")).toEqual(["2026-06-29", "2026-07-06", "2026-07-13"]);

    const buckets = weeklyVolumeBuckets(
      [
        { scheduledDate: "2026-07-14", totalVolumeKg: 200 },
        { scheduledDate: "2026-07-15", totalVolumeKg: 100 },
        { scheduledDate: "2026-07-08", totalVolumeKg: 50 },
      ],
      3,
      "2026-07-15",
    );

    expect(buckets).toEqual([
      { weekStart: "2026-06-29", volumeKg: 0, sessionCount: 0 },
      { weekStart: "2026-07-06", volumeKg: 50, sessionCount: 1 },
      { weekStart: "2026-07-13", volumeKg: 300, sessionCount: 2 },
    ]);
  });
});

describe("chart geometry", () => {
  it("plots a single point in the horizontal center", () => {
    const [point] = plotPoints([10], 100, 40, 0, { min: 0, max: 10 });
    expect(point.x).toBe(50);
    expect(point.y).toBe(0);
  });

  it("builds line and area paths", () => {
    expect(
      linePath([
        { x: 0, y: 10 },
        { x: 20, y: 4 },
      ]),
    ).toBe("M0.00 10.00 L20.00 4.00");
    expect(
      areaPath(
        [
          { x: 0, y: 10 },
          { x: 20, y: 4 },
        ],
        40,
      ),
    ).toBe("M0.00 10.00 L20.00 4.00 L20.00 40.00 L0.00 40.00 Z");
  });

  it("uses a tight band for 1RM so small progress is visible", () => {
    const scale = yScaleForTrend([100, 110], "one_rm");
    expect(scale.min).toBeGreaterThan(80);
    expect(scale.max).toBeGreaterThan(110);
  });
});

describe("chronologicalSessions", () => {
  it("does not mutate the original array", () => {
    const sessions = [
      makeStat({ sessionId: "b", scheduledDate: "2026-07-20" }),
      makeStat({ sessionId: "a", scheduledDate: "2026-07-10" }),
    ];
    const ordered = chronologicalSessions(sessions);
    expect(sessions[0].sessionId).toBe("b");
    expect(ordered.map((session) => session.sessionId)).toEqual(["a", "b"]);
  });
});
