import { startOfWeek } from "date-fns";
import { parseISODate, toLocalISODate } from "@/lib/dates";
import type { ExerciseMetric } from "@/types";
import type { SessionStat } from "@/lib/exercise-stats/calculations";

export type TrendKind = "one_rm" | "volume" | "reps" | "duration";

export interface TrendPoint {
  date: string;
  value: number;
}

export interface ExerciseTrend {
  kind: TrendKind;
  label: string;
  unit: string;
  points: TrendPoint[];
}

export interface WeekBucket {
  weekStart: string;
  volumeKg: number;
  sessionCount: number;
}

export function chronologicalSessions(sessions: SessionStat[]): SessionStat[] {
  return [...sessions].sort((a, b) => {
    const byDate = a.scheduledDate.localeCompare(b.scheduledDate);
    return byDate !== 0 ? byDate : a.loggedAt.localeCompare(b.loggedAt);
  });
}

function valueForKind(session: SessionStat, kind: TrendKind): number | null {
  switch (kind) {
    case "one_rm":
      return session.estimated1RM;
    case "volume":
      return session.totalVolumeKg;
    case "reps":
      return session.totalReps;
    case "duration":
      return session.totalDurationSeconds;
  }
}

function detectTrendKind(sessions: SessionStat[], metric: ExerciseMetric): TrendKind {
  if (sessions.some((session) => session.estimated1RM !== null)) {
    return "one_rm";
  }
  if (sessions.some((session) => session.totalVolumeKg !== null)) {
    return "volume";
  }
  if (metric === "time") {
    return "duration";
  }
  return "reps";
}

const TREND_COPY: Record<TrendKind, { label: string; unit: string }> = {
  one_rm: { label: "Est. 1RM", unit: "kg" },
  volume: { label: "Volume", unit: "kg" },
  reps: { label: "Reps", unit: "reps" },
  duration: { label: "Time", unit: "s" },
};

export function primaryTrendForSessions(sessions: SessionStat[], metric: ExerciseMetric): ExerciseTrend {
  const kind = detectTrendKind(sessions, metric);
  const copy = TREND_COPY[kind];
  const points: TrendPoint[] = [];

  for (const session of chronologicalSessions(sessions)) {
    const value = valueForKind(session, kind);
    if (value === null) {
      continue;
    }
    points.push({ date: session.scheduledDate, value });
  }

  return { kind, label: copy.label, unit: copy.unit, points };
}

export function weekStartMonday(isoDate: string): string {
  return toLocalISODate(startOfWeek(parseISODate(isoDate), { weekStartsOn: 1 }));
}

export function lastNWeekStarts(weekCount: number, fromIso: string): string[] {
  const current = parseISODate(weekStartMonday(fromIso));
  const weeks: string[] = [];

  for (let i = weekCount - 1; i >= 0; i -= 1) {
    const day = new Date(current);
    day.setDate(day.getDate() - i * 7);
    weeks.push(toLocalISODate(day));
  }

  return weeks;
}

export function weeklyVolumeBuckets(
  sessions: { scheduledDate: string; totalVolumeKg: number | null }[],
  weekCount: number,
  fromIso: string,
): WeekBucket[] {
  const weekStarts = lastNWeekStarts(weekCount, fromIso);
  const byWeek = new Map<string, WeekBucket>(
    weekStarts.map((weekStart) => [weekStart, { weekStart, volumeKg: 0, sessionCount: 0 }]),
  );

  for (const session of sessions) {
    const weekStart = weekStartMonday(session.scheduledDate);
    const bucket = byWeek.get(weekStart);
    if (!bucket) {
      continue;
    }
    bucket.sessionCount += 1;
    if (session.totalVolumeKg !== null) {
      bucket.volumeKg += session.totalVolumeKg;
    }
  }

  return weekStarts.map((weekStart) => byWeek.get(weekStart) ?? { weekStart, volumeKg: 0, sessionCount: 0 });
}

export interface ChartScale {
  min: number;
  max: number;
}

export function yScaleForTrend(values: number[], kind: TrendKind): ChartScale {
  if (values.length === 0) {
    return { min: 0, max: 1 };
  }

  const max = Math.max(...values);
  if (kind === "one_rm") {
    const min = Math.min(...values);
    if (min === max) {
      return { min: Math.max(0, min * 0.9), max: max * 1.1 || 1 };
    }
    const pad = (max - min) * 0.12;
    return { min: Math.max(0, min - pad), max: max + pad };
  }

  return { min: 0, max: max === 0 ? 1 : max * 1.08 };
}

export function plotPoints(
  values: number[],
  width: number,
  height: number,
  pad: number,
  scale: ChartScale,
): { x: number; y: number }[] {
  const innerWidth = width - pad * 2;
  const innerHeight = height - pad * 2;
  const range = scale.max - scale.min || 1;

  if (values.length === 1) {
    const y = pad + innerHeight - ((values[0] - scale.min) / range) * innerHeight;
    return [{ x: pad + innerWidth / 2, y }];
  }

  return values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * innerWidth;
    const y = pad + innerHeight - ((value - scale.min) / range) * innerHeight;
    return { x, y };
  });
}

export function linePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) {
    return "";
  }
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

export function areaPath(points: { x: number; y: number }[], baselineY: number): string {
  if (points.length === 0) {
    return "";
  }
  const line = linePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L${last.x.toFixed(2)} ${baselineY.toFixed(2)} L${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
}
