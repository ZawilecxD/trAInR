import { describe, expect, it } from "vitest";
import { filterExercises } from "@/lib/exercises/client-filter";
import type { ExerciseWithMuscleGroups } from "@/lib/exercises/service";

function makeExercise(overrides: Partial<ExerciseWithMuscleGroups> = {}): ExerciseWithMuscleGroups {
  return {
    id: "ex-1",
    trainer_id: "trainer-1",
    name: "Bench Press",
    exercise_type: "strength",
    default_metric: "reps_weight",
    notes: null,
    video_url: null,
    is_archived: false,
    is_favourite: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    muscle_groups: [],
    ...overrides,
  };
}

describe("filterExercises", () => {
  const exercises = [
    makeExercise({ id: "1", name: "Bench Press", is_favourite: true }),
    makeExercise({ id: "2", name: "Squat", is_favourite: false }),
    makeExercise({ id: "3", name: "Incline Bench", is_favourite: true }),
  ];

  it("returns all exercises when no filters are set", () => {
    expect(filterExercises(exercises, {})).toHaveLength(3);
  });

  it("filters by favourites only", () => {
    const result = filterExercises(exercises, { favouritesOnly: true });
    expect(result.map((exercise) => exercise.id)).toEqual(["1", "3"]);
  });

  it("filters by name search", () => {
    const result = filterExercises(exercises, { q: "bench" });
    expect(result.map((exercise) => exercise.id)).toEqual(["1", "3"]);
  });

  it("combines favourites and name filters", () => {
    const result = filterExercises(exercises, { favouritesOnly: true, q: "incline" });
    expect(result.map((exercise) => exercise.id)).toEqual(["3"]);
  });
});
