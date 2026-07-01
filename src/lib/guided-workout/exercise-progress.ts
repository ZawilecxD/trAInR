import { getLoggingSetNumbers } from "@/lib/guided-workout/logging-sets";
import { isSetLogged } from "@/lib/guided-workout/set-logged";
import type { ExerciseMetric, SessionExerciseSet, SetLog } from "@/types";

export interface ExerciseProgress {
  completedSets: number;
  totalSets: number;
  isDone: boolean;
  isActive: boolean;
}

export interface SessionProgressSummary {
  done: number;
  active: number;
  remaining: number;
}

export interface ExerciseWithLogs {
  sets: SessionExerciseSet[];
  logs: SetLog[];
  exercise_default_metric: ExerciseMetric;
}

function setNumbersForExercise(exercise: ExerciseWithLogs): number[] {
  return getLoggingSetNumbers(exercise.sets, exercise.logs);
}

export function getExerciseProgress(
  setNumbers: number[],
  logs: SetLog[],
  metric: ExerciseMetric,
  isActive = false,
): ExerciseProgress {
  const totalSets = setNumbers.length;
  let completedSets = 0;

  for (const setNumber of setNumbers) {
    const log = logs.find((entry) => entry.set_number === setNumber);
    if (isSetLogged(log, metric)) {
      completedSets += 1;
    }
  }

  const isDone = totalSets > 0 && completedSets === totalSets;

  return {
    completedSets,
    totalSets,
    isDone,
    isActive,
  };
}

export function getSessionProgressSummary(
  exercises: ExerciseWithLogs[],
  currentExerciseIndex: number,
): SessionProgressSummary {
  let done = 0;

  for (const exercise of exercises) {
    const progress = getExerciseProgress(
      setNumbersForExercise(exercise),
      exercise.logs,
      exercise.exercise_default_metric,
    );
    if (progress.isDone) {
      done += 1;
    }
  }

  const currentExercise = exercises.at(currentExerciseIndex);
  const currentSetNumbers = currentExercise ? setNumbersForExercise(currentExercise) : [];
  const currentDone = currentExercise
    ? getExerciseProgress(currentSetNumbers, currentExercise.logs, currentExercise.exercise_default_metric).isDone
    : true;
  const active = currentDone ? 0 : 1;
  const remaining = exercises.length - done - active;

  return { done, active, remaining };
}

export function findFirstIncompleteExerciseIndex(exercises: ExerciseWithLogs[]): number {
  for (let index = 0; index < exercises.length; index++) {
    const progress = getExerciseProgress(
      setNumbersForExercise(exercises[index]),
      exercises[index].logs,
      exercises[index].exercise_default_metric,
    );
    if (!progress.isDone) {
      return index;
    }
  }

  return 0;
}
