import { getLoggingSetNumbers } from "@/lib/guided-workout/logging-sets";
import { sortByPhaseThenSortOrder } from "@/lib/guided-workout/phase-labels";
import { hasLoggedValues } from "@/lib/guided-workout/prescription-fill";
import type { ExerciseMetric, ExercisePhase, SessionExerciseSet, SetLog } from "@/types";

export type ReadoutStatus = "not_logged" | "in_progress" | "fully_logged";

export interface SetReadout {
  setNumber: number;
  prescribed: SessionExerciseSet | null;
  log: SetLog | null;
  isComplete: boolean;
}

export interface ExerciseReadoutInput {
  id: string;
  exercise_id: string;
  phase: ExercisePhase;
  sort_order: number;
  exercise_name: string;
  exercise_default_metric: ExerciseMetric;
  sets: SessionExerciseSet[];
  logs: SetLog[];
}

export interface ExerciseReadout {
  sessionExerciseId: string;
  exerciseId: string;
  phase: ExercisePhase;
  sortOrder: number;
  exerciseName: string;
  defaultMetric: ExerciseMetric;
  sets: SetReadout[];
  status: ReadoutStatus;
  completedSets: number;
  totalSets: number;
}

export interface SessionReadoutSummary {
  status: ReadoutStatus;
  statusLabel: string;
  completedSets: number;
  totalSets: number;
  exercises: ExerciseReadout[];
}

export function readoutStatusLabel(status: ReadoutStatus): string {
  switch (status) {
    case "not_logged":
      return "Not logged";
    case "in_progress":
      return "In progress";
    case "fully_logged":
      return "Fully logged";
  }
}

export function deriveReadoutStatus(completedSets: number, totalSets: number): ReadoutStatus {
  if (totalSets === 0 || completedSets === 0) {
    return "not_logged";
  }

  if (completedSets === totalSets) {
    return "fully_logged";
  }

  return "in_progress";
}

export function deriveSetReadouts(prescribedSets: SessionExerciseSet[], logs: SetLog[]): SetReadout[] {
  const setNumbers = getLoggingSetNumbers(prescribedSets, logs);

  return setNumbers.map((setNumber) => {
    const prescribed = prescribedSets.find((set) => set.set_number === setNumber) ?? null;
    const log = logs.find((entry) => entry.set_number === setNumber) ?? null;

    return {
      setNumber,
      prescribed,
      log,
      isComplete: hasLoggedValues(log),
    };
  });
}

export function deriveExerciseReadout(exercise: ExerciseReadoutInput): ExerciseReadout {
  const setNumbers = getLoggingSetNumbers(exercise.sets, exercise.logs);
  const sets = deriveSetReadouts(exercise.sets, exercise.logs);
  let completedSets = 0;

  for (const setNumber of setNumbers) {
    const log = exercise.logs.find((entry) => entry.set_number === setNumber);
    if (hasLoggedValues(log)) {
      completedSets += 1;
    }
  }

  const totalSets = setNumbers.length;
  const status = deriveReadoutStatus(completedSets, totalSets);

  return {
    sessionExerciseId: exercise.id,
    exerciseId: exercise.exercise_id,
    phase: exercise.phase,
    sortOrder: exercise.sort_order,
    exerciseName: exercise.exercise_name,
    defaultMetric: exercise.exercise_default_metric,
    sets,
    status,
    completedSets,
    totalSets,
  };
}

export function deriveSessionReadout(exercises: ExerciseReadoutInput[]): SessionReadoutSummary {
  const sortedExercises = sortByPhaseThenSortOrder(exercises);
  const exerciseReadouts = sortedExercises.map(deriveExerciseReadout);

  let completedSets = 0;
  let totalSets = 0;

  for (const exercise of exerciseReadouts) {
    completedSets += exercise.completedSets;
    totalSets += exercise.totalSets;
  }

  const status = deriveReadoutStatus(completedSets, totalSets);

  return {
    status,
    statusLabel: readoutStatusLabel(status),
    completedSets,
    totalSets,
    exercises: exerciseReadouts,
  };
}

export function getLatestLogTimestamp(logs: SetLog[]): string | null {
  if (logs.length === 0) {
    return null;
  }

  return logs.reduce((latest, log) => (log.logged_at > latest ? log.logged_at : latest), logs[0].logged_at);
}

export function resolveLastActivityAt(startedAt: string | null, logs: SetLog[]): string | null {
  const latestLog = getLatestLogTimestamp(logs);

  if (startedAt && latestLog) {
    return startedAt > latestLog ? startedAt : latestLog;
  }

  return startedAt ?? latestLog;
}
