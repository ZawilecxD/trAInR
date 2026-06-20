import { describe, expect, it } from "vitest";
import { sortByPhaseThenSortOrder } from "@/lib/guided-workout/phase-labels";
import type { ExercisePhase } from "@/types";

function exercise(phase: ExercisePhase, sortOrder: number, id: string) {
  return { id, phase, sort_order: sortOrder };
}

describe("sortByPhaseThenSortOrder", () => {
  it("orders warm-up, then main, then cool-down regardless of sort_order", () => {
    const input = [
      exercise("cool_down", 0, "f"),
      exercise("main", 1, "e"),
      exercise("warm_up", 0, "a"),
      exercise("main", 0, "d"),
      exercise("warm_up", 1, "b"),
      exercise("warm_up", 2, "c"),
    ];

    expect(sortByPhaseThenSortOrder(input).map((row) => row.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("sorts by sort_order within the same phase", () => {
    const input = [exercise("main", 2, "c"), exercise("main", 0, "a"), exercise("main", 1, "b")];

    expect(sortByPhaseThenSortOrder(input).map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});
