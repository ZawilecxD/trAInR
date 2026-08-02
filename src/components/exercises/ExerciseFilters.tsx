import { Search } from "lucide-react";
import { buildExerciseListUrl, type ExerciseFilterState } from "@/lib/exercises/filter-url";
import { EXERCISE_TYPE_LABELS } from "@/lib/exercises/labels";
import { cn } from "@/lib/utils";
import { formInputClass } from "@/lib/ui-classes";
import type { ExerciseType, MuscleGroup } from "@/types";

interface ExerciseFiltersProps {
  muscleGroups: MuscleGroup[];
  initialFilters: ExerciseFilterState;
}

function isExerciseType(value: string): value is ExerciseType {
  return value in EXERCISE_TYPE_LABELS;
}

export default function ExerciseFilters({ muscleGroups, initialFilters }: ExerciseFiltersProps) {
  function applyFilters(next: ExerciseFilterState) {
    window.location.assign(buildExerciseListUrl(next));
  }

  function toggleMuscleGroup(muscleGroupId: string) {
    const selected = new Set(initialFilters.muscleGroupIds);
    if (selected.has(muscleGroupId)) {
      selected.delete(muscleGroupId);
    } else {
      selected.add(muscleGroupId);
    }

    applyFilters({
      ...initialFilters,
      muscleGroupIds: [...selected],
    });
  }

  function handleTypeChange(value: string) {
    applyFilters({
      ...initialFilters,
      type: value.length > 0 && isExerciseType(value) ? value : undefined,
    });
  }

  function handleSearchSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const rawQuery = formData.get("q");
    const q = typeof rawQuery === "string" ? rawQuery.trim() : "";

    applyFilters({
      ...initialFilters,
      q: q.length > 0 ? q : undefined,
    });
  }

  function clearFilters() {
    applyFilters({ muscleGroupIds: [] });
  }

  function toggleFavouritesOnly() {
    applyFilters({
      ...initialFilters,
      favouritesOnly: initialFilters.favouritesOnly ? undefined : true,
    });
  }

  const hasActiveFilters =
    initialFilters.type !== undefined ||
    initialFilters.q !== undefined ||
    initialFilters.muscleGroupIds.length > 0 ||
    initialFilters.favouritesOnly === true;

  return (
    <div className="border-border bg-card space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[180px] flex-1">
          <label htmlFor="filter-type" className="text-muted-foreground mb-1 block text-sm">
            Type
          </label>
          <select
            id="filter-type"
            value={initialFilters.type ?? ""}
            onChange={(event) => {
              handleTypeChange(event.target.value);
            }}
            className={formInputClass}
          >
            <option value="">All types</option>
            {(Object.keys(EXERCISE_TYPE_LABELS) as ExerciseType[]).map((type) => (
              <option key={type} value={type}>
                {EXERCISE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <form className="min-w-[220px] flex-[2]" onSubmit={handleSearchSubmit} key={`search-${initialFilters.q ?? ""}`}>
          <label htmlFor="filter-q" className="text-muted-foreground mb-1 block text-sm">
            Search
          </label>
          <div className="relative">
            <Search className="text-foreground/40 absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              id="filter-q"
              name="q"
              defaultValue={initialFilters.q ?? ""}
              placeholder="Search by name..."
              className={cn(formInputClass, "pl-10")}
            />
          </div>
        </form>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="border-border text-muted-foreground hover:bg-accent rounded-lg border px-3 py-2 text-sm transition-colors"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">Quick filters</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={initialFilters.favouritesOnly === true}
            onClick={toggleFavouritesOnly}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              initialFilters.favouritesOnly
                ? "border-warning/60 bg-warning/20 text-warning"
                : "border-border bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            Favourites only
          </button>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">Muscle groups</p>
        <div className="flex flex-wrap gap-2">
          {muscleGroups.map((group) => {
            const selected = initialFilters.muscleGroupIds.includes(group.id);
            return (
              <button
                key={group.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  toggleMuscleGroup(group.id);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  selected
                    ? "border-primary/60 bg-primary/30 text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                {group.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
