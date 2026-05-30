import { Search } from "lucide-react";
import { buildExerciseListUrl, type ExerciseFilterState } from "@/lib/exercises/filter-url";
import { EXERCISE_TYPE_LABELS } from "@/lib/exercises/labels";
import { cn } from "@/lib/utils";
import type { ExerciseType, MuscleGroup } from "@/types";

interface ExerciseFiltersProps {
  muscleGroups: MuscleGroup[];
  initialFilters: ExerciseFilterState;
}

const inputClass =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:ring-2 focus:ring-purple-400 focus:outline-none";

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

  const hasActiveFilters =
    initialFilters.type !== undefined || initialFilters.q !== undefined || initialFilters.muscleGroupIds.length > 0;

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[180px] flex-1">
          <label htmlFor="filter-type" className="mb-1 block text-sm text-blue-100/80">
            Type
          </label>
          <select
            id="filter-type"
            value={initialFilters.type ?? ""}
            onChange={(event) => {
              handleTypeChange(event.target.value);
            }}
            className={inputClass}
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
          <label htmlFor="filter-q" className="mb-1 block text-sm text-blue-100/80">
            Search
          </label>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
            <input
              id="filter-q"
              name="q"
              defaultValue={initialFilters.q ?? ""}
              placeholder="Search by name..."
              className={cn(inputClass, "pl-10")}
            />
          </div>
        </form>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm text-blue-100/80 transition-colors hover:bg-white/10"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-sm text-blue-100/80">Muscle groups</p>
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
                    ? "border-purple-300/60 bg-purple-500/30 text-white"
                    : "border-white/20 bg-white/5 text-blue-100/80 hover:bg-white/10",
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
