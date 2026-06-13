import type { ExercisePhase } from "@/types";

const TEMPLATE_PHASES = ["warm_up", "main", "cool_down"] as const satisfies readonly ExercisePhase[];

function isExercisePhase(value: string): value is ExercisePhase {
  return TEMPLATE_PHASES.includes(value as ExercisePhase);
}

export interface TemplateFilterState {
  q?: string;
  phase?: ExercisePhase;
}

export function filtersToSearchParams(state: TemplateFilterState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.phase) {
    params.set("phase", state.phase);
  }

  if (state.q) {
    params.set("q", state.q);
  }

  return params;
}

export function searchParamsToFilters(searchParams: URLSearchParams): TemplateFilterState {
  const phase = searchParams.get("phase");
  const q = searchParams.get("q")?.trim();

  return {
    phase: phase && isExercisePhase(phase) ? phase : undefined,
    q: q && q.length > 0 ? q : undefined,
  };
}

export function buildTemplateListUrl(state: TemplateFilterState, basePath = "/trainer/templates"): string {
  const params = filtersToSearchParams(state);
  const query = params.toString();
  return query.length > 0 ? `${basePath}?${query}` : basePath;
}
