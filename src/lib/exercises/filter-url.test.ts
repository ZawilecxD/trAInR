import { describe, expect, it } from "vitest";
import {
  buildExerciseListUrl,
  filtersToSearchParams,
  searchParamsToFilters,
  type ExerciseFilterState,
} from "@/lib/exercises/filter-url";
import { parseListExercisesQuery } from "@/lib/exercises/schemas";

const chestId = "a1000001-0000-4000-8000-000000000001";
const backId = "a1000001-0000-4000-8000-000000000002";

describe("filtersToSearchParams", () => {
  it("serializes type, repeated muscleGroupId, and search query", () => {
    const params = filtersToSearchParams({
      type: "strength",
      muscleGroupIds: [chestId, backId],
      q: "bench",
    });

    expect(params.get("type")).toBe("strength");
    expect(params.getAll("muscleGroupId")).toEqual([chestId, backId]);
    expect(params.get("q")).toBe("bench");
  });

  it("omits empty filter values", () => {
    const params = filtersToSearchParams({ muscleGroupIds: [] });
    expect(params.toString()).toBe("");
  });
});

describe("searchParamsToFilters", () => {
  it("deserializes URL params into filter state", () => {
    const params = new URLSearchParams();
    params.set("type", "cardio");
    params.append("muscleGroupId", chestId);
    params.set("q", "run");

    expect(searchParamsToFilters(params)).toEqual({
      type: "cardio",
      muscleGroupIds: [chestId],
      q: "run",
    });
  });
});

describe("filter URL round-trip", () => {
  it("preserves state through serialize and parse", () => {
    const state: ExerciseFilterState = {
      type: "strength",
      muscleGroupIds: [chestId, backId],
      q: "press",
    };

    const roundTripped = searchParamsToFilters(filtersToSearchParams(state));
    expect(roundTripped).toEqual(state);
  });

  it("builds list URLs compatible with parseListExercisesQuery", () => {
    const url = buildExerciseListUrl({
      type: "strength",
      muscleGroupIds: [chestId, backId],
      q: "bench",
    });

    const parsed = parseListExercisesQuery(new URL(url, "http://localhost").searchParams);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.type).toBe("strength");
      expect(parsed.data.muscleGroupId).toEqual([chestId, backId]);
      expect(parsed.data.q).toBe("bench");
    }
  });
});
