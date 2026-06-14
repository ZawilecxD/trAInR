import { Search } from "lucide-react";
import { buildTemplateListUrl, type TemplateFilterState } from "@/lib/session-templates/filter-url";
import { TEMPLATE_PHASE_LABELS } from "@/lib/session-templates/labels";
import { cn } from "@/lib/utils";
import type { ExercisePhase } from "@/types";

interface TemplateFiltersProps {
  initialFilters: TemplateFilterState;
}

const inputClass =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:ring-2 focus:ring-purple-400 focus:outline-none";

const PHASES: ExercisePhase[] = ["warm_up", "main", "cool_down"];

export default function TemplateFilters({ initialFilters }: TemplateFiltersProps) {
  function applyFilters(next: TemplateFilterState) {
    window.location.assign(buildTemplateListUrl(next));
  }

  function handlePhaseChange(value: string) {
    applyFilters({
      ...initialFilters,
      phase: value.length > 0 && PHASES.includes(value as ExercisePhase) ? (value as ExercisePhase) : undefined,
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
    applyFilters({});
  }

  const hasActiveFilters = initialFilters.phase !== undefined || initialFilters.q !== undefined;

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[180px] flex-1">
          <label htmlFor="template-filter-phase" className="mb-1 block text-sm text-blue-100/80">
            Phase
          </label>
          <select
            id="template-filter-phase"
            value={initialFilters.phase ?? ""}
            onChange={(event) => {
              handlePhaseChange(event.target.value);
            }}
            className={inputClass}
          >
            <option value="">All phases</option>
            {PHASES.map((phase) => (
              <option key={phase} value={phase}>
                {TEMPLATE_PHASE_LABELS[phase]}
              </option>
            ))}
          </select>
        </div>

        <form className="min-w-[220px] flex-[2]" onSubmit={handleSearchSubmit} key={`search-${initialFilters.q ?? ""}`}>
          <label htmlFor="template-filter-q" className="mb-1 block text-sm text-blue-100/80">
            Search
          </label>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
            <input
              id="template-filter-q"
              name="q"
              defaultValue={initialFilters.q ?? ""}
              placeholder="Search by name or description..."
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
    </div>
  );
}
