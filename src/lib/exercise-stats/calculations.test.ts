import { describe, expect, it } from "vitest";
import {
  aggregateSessionStats,
  computeSetVolume,
  estimateOneRepMax,
  metricSupportsLoad,
  summarizeExerciseHistory,
  type SessionStat,
  type SessionStatInput,
  type WorkingSetInput,
} from "@/lib/exercise-stats/calculations";

const set = (reps: number | null, loadKg: number | null, durationSeconds: number | null = null): WorkingSetInput => ({
  reps,
  loadKg,
  durationSeconds,
});

const sessionInput = (id: string, date: string, sets: WorkingSetInput[]): SessionStatInput => ({
  sessionId: id,
  scheduledDate: date,
  loggedAt: `${date}T12:00:00.000Z`,
  sets,
});

describe("estimateOneRepMax", () => {
  it("applies Epley for multi-rep sets", () => {
    expect(estimateOneRepMax(100, 5)).toBe(116.7); // 100 * (1 + 5/30) = 116.66..
    expect(estimateOneRepMax(60, 8)).toBe(76); // 60 * (1 + 8/30) = 76
  });

  it("reports the lifted load for a single rep", () => {
    expect(estimateOneRepMax(120, 1)).toBe(120);
  });

  it("returns null for bodyweight, missing, or invalid inputs", () => {
    expect(estimateOneRepMax(0, 10)).toBeNull();
    expect(estimateOneRepMax(null, 10)).toBeNull();
    expect(estimateOneRepMax(-20, 10)).toBeNull();
    expect(estimateOneRepMax(100, null)).toBeNull();
    expect(estimateOneRepMax(100, 0)).toBeNull();
  });
});

describe("computeSetVolume", () => {
  it("multiplies load by reps", () => {
    expect(computeSetVolume(60, 8)).toBe(480);
    expect(computeSetVolume(82.5, 5)).toBe(412.5);
  });

  it("returns null when load or reps are missing/zero", () => {
    expect(computeSetVolume(0, 10)).toBeNull();
    expect(computeSetVolume(null, 10)).toBeNull();
    expect(computeSetVolume(60, null)).toBeNull();
    expect(computeSetVolume(60, 0)).toBeNull();
  });
});

describe("aggregateSessionStats", () => {
  it("aggregates a weighted session: top set, best 1RM, tonnage, totals", () => {
    const stat = aggregateSessionStats(
      sessionInput("s1", "2026-07-10", [set(10, 50), set(8, 60), set(6, 70)]),
      "reps_weight",
    );

    expect(stat.workingSetCount).toBe(3);
    // best 1RM is the 6x70 set: 70 * (1 + 6/30) = 84
    expect(stat.estimated1RM).toBe(84);
    expect(stat.topSet).toEqual(set(6, 70));
    // volume: 500 + 480 + 420 = 1400
    expect(stat.totalVolumeKg).toBe(1400);
    expect(stat.totalReps).toBe(24);
    expect(stat.totalDurationSeconds).toBe(0);
    expect(stat.sets).toHaveLength(3); // working sets preserved for drill-down
  });

  it("handles bodyweight sets: no 1RM/volume, reps counted, top set by reps", () => {
    const stat = aggregateSessionStats(sessionInput("s2", "2026-07-11", [set(12, 0), set(15, null)]), "reps_weight");

    expect(stat.estimated1RM).toBeNull();
    expect(stat.totalVolumeKg).toBeNull();
    expect(stat.totalReps).toBe(27);
    expect(stat.topSet).toEqual(set(15, null));
  });

  it("handles timed sets: top set by longest duration, no 1RM/volume", () => {
    const stat = aggregateSessionStats(
      sessionInput("s3", "2026-07-12", [set(null, null, 45), set(null, null, 60)]),
      "time",
    );

    expect(stat.estimated1RM).toBeNull();
    expect(stat.totalVolumeKg).toBeNull();
    expect(stat.totalDurationSeconds).toBe(105);
    expect(stat.topSet).toEqual(set(null, null, 60));
  });

  it("returns a null top set for an empty session", () => {
    const stat = aggregateSessionStats(sessionInput("s4", "2026-07-13", []), "reps_weight");
    expect(stat.topSet).toBeNull();
    expect(stat.workingSetCount).toBe(0);
    expect(stat.estimated1RM).toBeNull();
    expect(stat.totalVolumeKg).toBeNull();
  });
});

describe("summarizeExerciseHistory", () => {
  const makeStat = (overrides: Partial<SessionStat>): SessionStat => ({
    sessionId: "s",
    scheduledDate: "2026-07-10",
    loggedAt: "2026-07-10T12:00:00.000Z",
    workingSetCount: 3,
    sets: [set(5, 100)],
    topSet: set(5, 100),
    estimated1RM: 116.7,
    totalVolumeKg: 1000,
    totalReps: 15,
    totalDurationSeconds: 0,
    ...overrides,
  });

  it("reduces to all-time best 1RM, best volume, counts, and last logged", () => {
    const summary = summarizeExerciseHistory([
      makeStat({ estimated1RM: 100, totalVolumeKg: 800, loggedAt: "2026-07-01T10:00:00.000Z" }),
      makeStat({ estimated1RM: 125, totalVolumeKg: 1200, loggedAt: "2026-07-15T10:00:00.000Z" }),
      makeStat({ estimated1RM: 110, totalVolumeKg: 900, loggedAt: "2026-07-08T10:00:00.000Z" }),
    ]);

    expect(summary.sessionCount).toBe(3);
    expect(summary.totalWorkingSets).toBe(9);
    expect(summary.allTimeBest1RM).toBe(125);
    expect(summary.bestSessionVolumeKg).toBe(1200);
    expect(summary.lastLoggedAt).toBe("2026-07-15T10:00:00.000Z");
  });

  it("keeps nulls when no weighted data exists", () => {
    const summary = summarizeExerciseHistory([
      makeStat({ estimated1RM: null, totalVolumeKg: null }),
      makeStat({ estimated1RM: null, totalVolumeKg: null }),
    ]);

    expect(summary.allTimeBest1RM).toBeNull();
    expect(summary.bestSessionVolumeKg).toBeNull();
  });

  it("handles empty history", () => {
    const summary = summarizeExerciseHistory([]);
    expect(summary.sessionCount).toBe(0);
    expect(summary.allTimeBest1RM).toBeNull();
    expect(summary.lastLoggedAt).toBeNull();
  });
});

describe("metricSupportsLoad", () => {
  it("is false only for time", () => {
    expect(metricSupportsLoad("reps_weight")).toBe(true);
    expect(metricSupportsLoad("distance")).toBe(true);
    expect(metricSupportsLoad("time")).toBe(false);
  });
});
