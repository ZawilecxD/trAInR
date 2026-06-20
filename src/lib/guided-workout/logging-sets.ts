import type { SessionExerciseSet, SetLog } from "@/types";

export function getLoggingSetNumbers(
  prescribedSets: SessionExerciseSet[],
  logs: SetLog[],
  additionalSetNumbers: number[] = [],
): number[] {
  const numbers = new Set<number>();

  for (const set of prescribedSets) {
    numbers.add(set.set_number);
  }

  for (const log of logs) {
    numbers.add(log.set_number);
  }

  for (const setNumber of additionalSetNumbers) {
    numbers.add(setNumber);
  }

  return [...numbers].sort((a, b) => a - b);
}

export function getNextSetNumber(setNumbers: number[]): number {
  if (setNumbers.length === 0) {
    return 1;
  }

  return Math.max(...setNumbers) + 1;
}

export function isPrescribedSetNumber(prescribedSets: SessionExerciseSet[], setNumber: number): boolean {
  return prescribedSets.some((set) => set.set_number === setNumber);
}

export function findFirstIncompleteSetNumber(setNumbers: number[], logs: SetLog[]): number | null {
  for (const setNumber of setNumbers) {
    const log = logs.find((entry) => entry.set_number === setNumber);
    if (!log?.is_complete) {
      return setNumber;
    }
  }

  return setNumbers[0] ?? null;
}
