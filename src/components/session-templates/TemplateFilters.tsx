import { Search } from "lucide-react";
import { buildTemplateListUrl, type TemplateFilterState } from "@/lib/session-templates/filter-url";
import { TEMPLATE_PHASE_LABELS } from "@/lib/session-templates/labels";
import { cn } from "@/lib/utils";
import { formInputClass } from "@/lib/ui-classes";
import type { ExercisePhase } from "@/types";

interface TemplateFiltersProps {
  initialFilters: TemplateFilterState;
}

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
    <div className="border-border bg-card space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[180px] flex-1">
          <label htmlFor="template-filter-phase" className="text-muted-foreground mb-1 block text-sm">
            Phase
          </label>
          <select
            id="template-filter-phase"
            value={initialFilters.phase ?? ""}
            onChange={(event) => {
              handlePhaseChange(event.target.value);
            }}
            className={formInputClass}
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
          <label htmlFor="template-filter-q" className="text-muted-foreground mb-1 block text-sm">
            Search
          </label>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
            <input
              id="template-filter-q"
              name="q"
              defaultValue={initialFilters.q ?? ""}
              placeholder="Search by name or description..."
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
    </div>
  );
}
