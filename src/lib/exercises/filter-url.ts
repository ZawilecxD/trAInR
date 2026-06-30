import type { ExerciseType } from "@/types";

export interface ExerciseFilterState {
  type?: ExerciseType;
  muscleGroupIds: string[];
  q?: string;
  favouritesOnly?: boolean;
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

  if (state.favouritesOnly) {
    params.set("favourites", "1");
  }

  return params;
}

export function searchParamsToFilters(searchParams: URLSearchParams): ExerciseFilterState {
  const type = searchParams.get("type");
  const q = searchParams.get("q")?.trim();
  const favourites = searchParams.get("favourites");

  return {
    type: type && type.length > 0 ? (type as ExerciseType) : undefined,
    muscleGroupIds: searchParams.getAll("muscleGroupId"),
    q: q && q.length > 0 ? q : undefined,
    favouritesOnly: favourites === "1" ? true : undefined,
  };
}

export function buildExerciseListUrl(state: ExerciseFilterState, basePath = "/trainer/exercises"): string {
  const params = filtersToSearchParams(state);
  const query = params.toString();
  return query.length > 0 ? `${basePath}?${query}` : basePath;
}
