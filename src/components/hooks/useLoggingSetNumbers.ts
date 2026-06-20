import { useMemo, useState } from "react";
import { getLoggingSetNumbers, getNextSetNumber } from "@/lib/guided-workout/logging-sets";
import type { SessionExerciseDetail } from "@/lib/workout-sessions/service";

export function useLoggingSetNumbers(exercise: SessionExerciseDetail) {
  const [additionalSetNumbers, setAdditionalSetNumbers] = useState<number[]>([]);

  const setNumbers = useMemo(
    () => getLoggingSetNumbers(exercise.sets, exercise.logs, additionalSetNumbers),
    [additionalSetNumbers, exercise.logs, exercise.sets],
  );

  function addRound() {
    const nextSetNumber = getNextSetNumber(setNumbers);
    setAdditionalSetNumbers((current) => [...current, nextSetNumber]);
    return nextSetNumber;
  }

  function removeAdditionalSet(setNumber: number) {
    setAdditionalSetNumbers((current) => current.filter((value) => value !== setNumber));
  }

  return {
    setNumbers,
    addRound,
    removeAdditionalSet,
  };
}
