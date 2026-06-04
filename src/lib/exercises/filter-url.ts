import type { ExerciseType } from "@/types";

export interface ExerciseFilterState {
  type?: ExerciseType;
  muscleGroupIds: string[];
  q?: string;
}

export function filtersToSearchParams(state: ExerciseFilterState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.type) {
    params.set("type", state.type);
  }

  for (const muscleGroupId of state.muscleGroupIds) {
    params.append("muscleGroupId", muscleGroupId);
  }

  if (state.q) {
    params.set("q", state.q);
  }

  return params;
}

export function searchParamsToFilters(searchParams: URLSearchParams): ExerciseFilterState {
  const type = searchParams.get("type");
  const q = searchParams.get("q")?.trim();

  return {
    type: type && type.length > 0 ? (type as ExerciseType) : undefined,
    muscleGroupIds: searchParams.getAll("muscleGroupId"),
    q: q && q.length > 0 ? q : undefined,
  };
}

export function buildExerciseListUrl(state: ExerciseFilterState, basePath = "/trainer/exercises"): string {
  const params = filtersToSearchParams(state);
  const query = params.toString();
  return query.length > 0 ? `${basePath}?${query}` : basePath;
}
