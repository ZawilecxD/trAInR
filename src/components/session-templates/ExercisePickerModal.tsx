import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { filterExercises } from "@/lib/exercises/client-filter";
import type { ExerciseWithMuscleGroups } from "@/lib/exercises/service";
import { cn } from "@/lib/utils";
import { formInputClass } from "@/lib/ui-classes";

interface ExercisePickerModalProps {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: ExerciseWithMuscleGroups) => void;
  availableExercises: ExerciseWithMuscleGroups[];
}

export default function ExercisePickerModal({ open, onClose, onPick, availableExercises }: ExercisePickerModalProps) {
  const [query, setQuery] = useState("");
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  function resetFilters() {
    setQuery("");
    setFavouritesOnly(false);
  }

  function handleClose() {
    resetFilters();
    onClose();
  }

  const filteredExercises = useMemo(
    () => filterExercises(availableExercises, { q: query, favouritesOnly: favouritesOnly || undefined }),
    [availableExercises, query, favouritesOnly],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="bg-background/70 absolute inset-0 backdrop-blur-sm"
        aria-label="Close exercise picker"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-picker-title"
        className="border-border bg-popover relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-xl"
      >
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <h2 id="exercise-picker-title" className="text-foreground text-lg font-semibold">
            Add exercise
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-border hover:bg-accent text-foreground bg-transparent"
            onClick={handleClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="border-border space-y-3 border-b px-4 py-3">
          <button
            type="button"
            aria-pressed={favouritesOnly}
            onClick={() => {
              setFavouritesOnly((current) => !current);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              favouritesOnly
                ? "border-warning/60 bg-warning/20 text-warning"
                : "border-border bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            Favourites only
          </button>

          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              aria-label="Search exercises"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search exercises..."
              className={cn(formInputClass, "pl-9")}
              autoFocus
            />
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto p-2">
          {filteredExercises.length === 0 ? (
            <li className="text-muted-foreground px-3 py-6 text-center text-sm">No exercises match your filters.</li>
          ) : (
            filteredExercises.map((exercise) => (
              <li key={exercise.id}>
                <button
                  type="button"
                  className="hover:bg-accent text-foreground w-full rounded-lg px-3 py-2 text-left text-sm transition-colors"
                  onClick={() => {
                    onPick(exercise);
                    resetFilters();
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
