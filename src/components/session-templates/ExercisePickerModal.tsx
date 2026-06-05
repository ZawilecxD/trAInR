import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExerciseWithMuscleGroups } from "@/lib/exercises/service";
import { cn } from "@/lib/utils";

interface ExercisePickerModalProps {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: ExerciseWithMuscleGroups) => void;
  availableExercises: ExerciseWithMuscleGroups[];
}

const inputClass =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:ring-2 focus:ring-purple-400 focus:outline-none";

export default function ExercisePickerModal({ open, onClose, onPick, availableExercises }: ExercisePickerModalProps) {
  const [query, setQuery] = useState("");

  const filteredExercises = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return availableExercises;
    }
    return availableExercises.filter((exercise) => exercise.name.toLowerCase().includes(normalized));
  }, [availableExercises, query]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        aria-label="Close exercise picker"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-picker-title"
        className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 id="exercise-picker-title" className="text-lg font-semibold text-white">
            Add exercise
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/20 bg-transparent text-white hover:bg-white/10"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="border-b border-white/10 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-blue-100/50" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search exercises..."
              className={cn(inputClass, "pl-9")}
              autoFocus
            />
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto p-2">
          {filteredExercises.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-blue-100/60">No exercises match your search.</li>
          ) : (
            filteredExercises.map((exercise) => (
              <li key={exercise.id}>
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/10"
                  onClick={() => {
                    onPick(exercise);
                    setQuery("");
                    onClose();
                  }}
                >
                  {exercise.name}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
