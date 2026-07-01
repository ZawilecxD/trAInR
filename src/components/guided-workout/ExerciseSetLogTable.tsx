import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useLoggingSetNumbers } from "@/components/hooks/useLoggingSetNumbers";
import SetLogRow from "@/components/guided-workout/SetLogRow";
import { Button } from "@/components/ui/button";
import { findFirstIncompleteSetNumber, isPrescribedSetNumber } from "@/lib/guided-workout/logging-sets";
import type { SessionExerciseDetail } from "@/lib/workout-sessions/service";
import type { SetLog } from "@/types";

interface ExerciseSetLogTableProps {
  exercise: SessionExerciseDetail;
  onLogSaved: (setLog: SetLog) => void;
  onLogDeleted: (sessionExerciseId: string, setNumber: number) => void;
}

export default function ExerciseSetLogTable({ exercise, onLogSaved, onLogDeleted }: ExerciseSetLogTableProps) {
  const { setNumbers, addRound, removeAdditionalSet } = useLoggingSetNumbers(exercise);
  const [activeSetNumber, setActiveSetNumber] = useState<number | null>(() =>
    findFirstIncompleteSetNumber(setNumbers, exercise.logs, exercise.exercise_default_metric),
  );

  const logsBySetNumber = useMemo(() => {
    const map = new Map<number, SetLog>();
    for (const log of exercise.logs) {
      map.set(log.set_number, log);
    }
    return map;
  }, [exercise.logs]);

  function handleAddRound() {
    const nextSetNumber = addRound();
    setActiveSetNumber(nextSetNumber);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
      <table className="w-full border-collapse">
        <tbody>
          {setNumbers.map((setNumber) => {
            const isPrescribed = isPrescribedSetNumber(exercise.sets, setNumber);
            const prescribedSet = exercise.sets.find((set) => set.set_number === setNumber);

            return (
              <SetLogRow
                key={`${exercise.id}-${setNumber}-${logsBySetNumber.get(setNumber)?.id ?? "new"}`}
                sessionExerciseId={exercise.id}
                setNumber={setNumber}
                existingLog={logsBySetNumber.get(setNumber)}
                prescribedSet={prescribedSet}
                defaultMetric={exercise.exercise_default_metric}
                isPrescribed={isPrescribed}
                isActive={activeSetNumber === setNumber}
                onFocus={() => {
                  setActiveSetNumber(setNumber);
                }}
                onSaved={onLogSaved}
                onDeleted={() => {
                  onLogDeleted(exercise.id, setNumber);
                }}
                onRowRemoved={() => {
                  removeAdditionalSet(setNumber);
                }}
              />
            );
          })}
        </tbody>
      </table>

      <div className="border-t border-white/10 p-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full border-white/20 bg-white/5 text-white hover:bg-white/10"
          onClick={handleAddRound}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add round
        </Button>
      </div>
    </div>
  );
}
