import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExercisePhase } from "../../../src/types.js";

export interface SessionExerciseSetSeed {
  set_number: number;
  prescribed_reps?: number | null;
  prescribed_duration_seconds?: number | null;
  prescribed_load_kg?: number | null;
  rest_after_seconds?: number | null;
}

export interface SeedSessionExerciseResult {
  sessionExerciseId: string;
  setIds: string[];
}

const DEFAULT_SETS: SessionExerciseSetSeed[] = [
  { set_number: 1, prescribed_reps: 10 },
  { set_number: 2, prescribed_reps: 10 },
  { set_number: 3, prescribed_reps: 10 },
];

export async function seedSessionExerciseWithSets(
  client: SupabaseClient,
  params: {
    sessionId: string;
    exerciseId: string;
    phase?: ExercisePhase;
    sortOrder?: number;
    sets?: SessionExerciseSetSeed[];
  },
): Promise<SeedSessionExerciseResult> {
  const { data: sessionExercise, error: sessionExerciseError } = await client
    .from("session_exercises")
    .insert({
      session_id: params.sessionId,
      exercise_id: params.exerciseId,
      phase: params.phase ?? "main",
      sort_order: params.sortOrder ?? 1,
    })
    .select("id")
    .single<{ id: string }>();

  if (sessionExerciseError) {
    throw new Error(`Failed to seed session exercise: ${sessionExerciseError.message}`);
  }

  const sets = params.sets ?? DEFAULT_SETS;

  const { data: insertedSets, error: setsError } = await client
    .from("session_exercise_sets")
    .insert(
      sets.map((set) => ({
        session_exercise_id: sessionExercise.id,
        set_number: set.set_number,
        prescribed_reps: set.prescribed_reps ?? null,
        prescribed_duration_seconds: set.prescribed_duration_seconds ?? null,
        prescribed_load_kg: set.prescribed_load_kg ?? null,
        rest_after_seconds: set.rest_after_seconds ?? null,
      })),
    )
    .select("id");

  if (setsError) {
    throw new Error(`Failed to seed session exercise sets: ${setsError.message}`);
  }

  if (insertedSets.length === 0) {
    throw new Error("Failed to seed session exercise sets: no rows returned");
  }

  return {
    sessionExerciseId: sessionExercise.id,
    setIds: insertedSets.map((row: { id: string }) => row.id),
  };
}
