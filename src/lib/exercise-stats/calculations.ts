import type { ExerciseMetric } from "@/types";

/**
 * Pure exercise-statistics calculations (S-12). No I/O.
 *
 * Estimated 1RM uses the Epley formula `load × (1 + reps / 30)` and is only
 * meaningful for weighted rep sets — it is `null` for bodyweight (load ≤ 0) and
 * timed sets. Estimates are inaccurate above ~10 reps; callers should surface an
 * "estimated" qualifier (FR-025).
 */

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** One working set's raw metric values (subset of `set_logs`). */
export interface WorkingSetInput {
  reps: number | null;
  loadKg: number | null;
  durationSeconds: number | null;
}

/** Aggregated view of a single session's working sets for one exercise. */
export interface SessionStat {
  sessionId: string;
  scheduledDate: string;
  loggedAt: string;
  workingSetCount: number;
  /** The session's working sets, preserved for per-set drill-down in the UI. */
  sets: WorkingSetInput[];
  topSet: WorkingSetInput | null;
  estimated1RM: number | null;
  totalVolumeKg: number | null;
  totalReps: number;
  totalDurationSeconds: number;
}

export interface SessionStatInput {
  sessionId: string;
  scheduledDate: string;
  loggedAt: string;
  sets: WorkingSetInput[];
}

/** All-time roll-up across a client's session history for one exercise. */
export interface ExerciseHistorySummary {
  sessionCount: number;
  totalWorkingSets: number;
  allTimeBest1RM: number | null;
  bestSessionVolumeKg: number | null;
  lastLoggedAt: string | null;
}

/**
 * Epley estimated one-rep max. Returns `null` when the set is not a weighted rep
 * set. A single rep is reported at the lifted load (Epley overestimates at r=1).
 */
export function estimateOneRepMax(loadKg: number | null, reps: number | null): number | null {
  if (loadKg == null || loadKg <= 0 || reps == null || reps < 1) {
    return null;
  }

  if (reps === 1) {
    return round1(loadKg);
  }

  return round1(loadKg * (1 + reps / 30));
}

/** Tonnage for a single set: `load × reps`. `null` unless both are present and load > 0. */
export function computeSetVolume(loadKg: number | null, reps: number | null): number | null {
  if (loadKg == null || loadKg <= 0 || reps == null || reps < 1) {
    return null;
  }

  return round1(loadKg * reps);
}

function pickTopSet(sets: WorkingSetInput[], metric: ExerciseMetric): WorkingSetInput | null {
  if (sets.length === 0) {
    return null;
  }

  if (metric === "time") {
    return sets.reduce((best, set) => ((set.durationSeconds ?? -1) > (best.durationSeconds ?? -1) ? set : best));
  }

  // Weighted / rep-based: prefer the set with the highest estimated 1RM. When no
  // set has weighted data (bodyweight), fall back to highest reps, then load.
  return sets.reduce((best, set) => {
    const setOneRm = estimateOneRepMax(set.loadKg, set.reps);
    const bestOneRm = estimateOneRepMax(best.loadKg, best.reps);

    if (setOneRm !== null || bestOneRm !== null) {
      return (setOneRm ?? -1) > (bestOneRm ?? -1) ? set : best;
    }

    if ((set.reps ?? -1) !== (best.reps ?? -1)) {
      return (set.reps ?? -1) > (best.reps ?? -1) ? set : best;
    }

    return (set.loadKg ?? -1) > (best.loadKg ?? -1) ? set : best;
  });
}

/** Reduce one session's working sets into a `SessionStat`. */
export function aggregateSessionStats(input: SessionStatInput, metric: ExerciseMetric): SessionStat {
  const { sets } = input;

  let estimated1RM: number | null = null;
  let volumeSum = 0;
  let hasVolume = false;
  let totalReps = 0;
  let totalDurationSeconds = 0;

  for (const set of sets) {
    const oneRm = estimateOneRepMax(set.loadKg, set.reps);
    if (oneRm !== null && (estimated1RM === null || oneRm > estimated1RM)) {
      estimated1RM = oneRm;
    }

    const volume = computeSetVolume(set.loadKg, set.reps);
    if (volume !== null) {
      volumeSum += volume;
      hasVolume = true;
    }

    if (set.reps != null) {
      totalReps += set.reps;
    }
    if (set.durationSeconds != null) {
      totalDurationSeconds += set.durationSeconds;
    }
  }

  return {
    sessionId: input.sessionId,
    scheduledDate: input.scheduledDate,
    loggedAt: input.loggedAt,
    workingSetCount: sets.length,
    sets,
    topSet: pickTopSet(sets, metric),
    estimated1RM,
    totalVolumeKg: hasVolume ? round1(volumeSum) : null,
    totalReps,
    totalDurationSeconds,
  };
}

/** Roll up per-session stats into an all-time summary. Sessions may be in any order. */
export function summarizeExerciseHistory(sessions: SessionStat[]): ExerciseHistorySummary {
  let allTimeBest1RM: number | null = null;
  let bestSessionVolumeKg: number | null = null;
  let totalWorkingSets = 0;
  let lastLoggedAt: string | null = null;

  for (const session of sessions) {
    if (session.estimated1RM !== null && (allTimeBest1RM === null || session.estimated1RM > allTimeBest1RM)) {
      allTimeBest1RM = session.estimated1RM;
    }
    if (
      session.totalVolumeKg !== null &&
      (bestSessionVolumeKg === null || session.totalVolumeKg > bestSessionVolumeKg)
    ) {
      bestSessionVolumeKg = session.totalVolumeKg;
    }
    totalWorkingSets += session.workingSetCount;
    if (lastLoggedAt === null || session.loggedAt > lastLoggedAt) {
      lastLoggedAt = session.loggedAt;
    }
  }

  return {
    sessionCount: sessions.length,
    totalWorkingSets,
    allTimeBest1RM,
    bestSessionVolumeKg,
    lastLoggedAt,
  };
}

/** Whether a metric can carry weighted figures (1RM / tonnage) at all. */
export function metricSupportsLoad(metric: ExerciseMetric): boolean {
  return metric !== "time";
}
