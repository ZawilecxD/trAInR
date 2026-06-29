import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateExerciseBody, ListExercisesQuery, UpdateExerciseBody } from "@/lib/exercises/schemas";
import type { Exercise, ExerciseMuscleGroup } from "@/types";

export type ExerciseMuscleGroupRow = Pick<ExerciseMuscleGroup, "muscle_group_id" | "role">;

export type ExerciseWithMuscleGroups = Exercise & {
  muscle_groups: ExerciseMuscleGroupRow[];
};

type ExerciseRow = Exercise & {
  exercise_muscle_groups: ExerciseMuscleGroupRow[] | null;
};

interface ExerciseMuscleLinkRow {
  exercise_id: string;
}

function isExerciseMuscleLinkRow(value: unknown): value is ExerciseMuscleLinkRow {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.exercise_id === "string";
}

function parseMuscleLinks(raw: unknown): ExerciseMuscleLinkRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isExerciseMuscleLinkRow);
}

function parseExerciseRow(raw: unknown): ExerciseRow {
  return raw as ExerciseRow;
}

function mapExerciseRow(row: ExerciseRow): ExerciseWithMuscleGroups {
  const { exercise_muscle_groups, ...exercise } = row;
  return {
    ...exercise,
    muscle_groups: exercise_muscle_groups ?? [],
  };
}

async function replaceMuscleGroups(
  supabase: SupabaseClient,
  exerciseId: string,
  muscleGroups: ExerciseMuscleGroupRow[],
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("replace_exercise_muscle_groups", {
    p_exercise_id: exerciseId,
    p_muscle_groups: muscleGroups.map((group) => ({
      muscle_group_id: group.muscle_group_id,
      role: group.role,
    })),
  });

  return { error: error?.message ?? null };
}

export async function listExercises(
  supabase: SupabaseClient,
  filters: ListExercisesQuery,
): Promise<{ data: ExerciseWithMuscleGroups[] | null; error: string | null }> {
  let exerciseIdsForMuscleFilter: string[] | undefined;

  if (filters.muscleGroupId && filters.muscleGroupId.length > 0) {
    const { data: links, error: linksError } = await supabase
      .from("exercise_muscle_groups")
      .select("exercise_id")
      .in("muscle_group_id", filters.muscleGroupId);

    if (linksError) {
      return { data: null, error: linksError.message };
    }

    const linkRows = parseMuscleLinks(links);
    exerciseIdsForMuscleFilter = [...new Set(linkRows.map((link) => link.exercise_id))];

    if (exerciseIdsForMuscleFilter.length === 0) {
      return { data: [], error: null };
    }
  }

  let query = supabase
    .from("exercises")
    .select("*, exercise_muscle_groups(muscle_group_id, role)")
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  if (filters.type) {
    query = query.eq("exercise_type", filters.type);
  }

  if (filters.q) {
    query = query.ilike("name", `%${filters.q}%`);
  }

  if (filters.favouritesOnly) {
    query = query.eq("is_favourite", true);
  }

  if (exerciseIdsForMuscleFilter) {
    query = query.in("id", exerciseIdsForMuscleFilter);
  }

  const { data: exerciseRows, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  const rows = Array.isArray(exerciseRows) ? exerciseRows.map(parseExerciseRow) : [];
  return {
    data: rows.map(mapExerciseRow),
    error: null,
  };
}

export async function getExercise(
  supabase: SupabaseClient,
  exerciseId: string,
): Promise<{ data: ExerciseWithMuscleGroups | null; error: string | null }> {
  const exerciseResult = await supabase
    .from("exercises")
    .select("*, exercise_muscle_groups(muscle_group_id, role)")
    .eq("id", exerciseId)
    .maybeSingle();

  if (exerciseResult.error) {
    return { data: null, error: exerciseResult.error.message };
  }

  if (!exerciseResult.data) {
    return { data: null, error: null };
  }

  return { data: mapExerciseRow(parseExerciseRow(exerciseResult.data)), error: null };
}

export async function createExercise(
  supabase: SupabaseClient,
  trainerId: string,
  body: CreateExerciseBody,
): Promise<{ data: ExerciseWithMuscleGroups | null; error: string | null }> {
  const { muscle_groups, ...exerciseFields } = body;

  const createResult = await supabase
    .from("exercises")
    .insert({
      trainer_id: trainerId,
      name: exerciseFields.name,
      exercise_type: exerciseFields.exercise_type,
      default_metric: exerciseFields.default_metric,
      notes: exerciseFields.notes ?? null,
      video_url: exerciseFields.video_url ?? null,
    })
    .select("*, exercise_muscle_groups(muscle_group_id, role)")
    .single();

  if (createResult.error || !createResult.data) {
    return { data: null, error: createResult.error?.message ?? "Failed to create exercise" };
  }

  const createdId = parseExerciseRow(createResult.data).id;
  const junctionResult = await replaceMuscleGroups(supabase, createdId, muscle_groups);

  if (junctionResult.error) {
    await supabase.from("exercises").delete().eq("id", createdId);
    return { data: null, error: junctionResult.error };
  }

  return getExercise(supabase, createdId);
}

export async function updateExercise(
  supabase: SupabaseClient,
  exerciseId: string,
  body: UpdateExerciseBody,
): Promise<{ data: ExerciseWithMuscleGroups | null; error: string | null }> {
  const { muscle_groups, ...patch } = body;
  const exercisePatch: Record<string, unknown> = {};

  if (patch.name !== undefined) exercisePatch.name = patch.name;
  if (patch.exercise_type !== undefined) exercisePatch.exercise_type = patch.exercise_type;
  if (patch.default_metric !== undefined) exercisePatch.default_metric = patch.default_metric;
  if (patch.notes !== undefined) exercisePatch.notes = patch.notes;
  if (patch.video_url !== undefined) exercisePatch.video_url = patch.video_url;
  if (patch.is_archived !== undefined) exercisePatch.is_archived = patch.is_archived;
  if (patch.is_favourite !== undefined) exercisePatch.is_favourite = patch.is_favourite;

  if (Object.keys(exercisePatch).length > 0) {
    const { error: updateError } = await supabase.from("exercises").update(exercisePatch).eq("id", exerciseId);

    if (updateError) {
      return { data: null, error: updateError.message };
    }
  }

  if (muscle_groups) {
    const junctionResult = await replaceMuscleGroups(supabase, exerciseId, muscle_groups);

    if (junctionResult.error) {
      return { data: null, error: junctionResult.error };
    }
  }

  return getExercise(supabase, exerciseId);
}

export async function archiveExercise(
  supabase: SupabaseClient,
  exerciseId: string,
): Promise<{ data: ExerciseWithMuscleGroups | null; error: string | null }> {
  return updateExercise(supabase, exerciseId, { is_archived: true });
}
