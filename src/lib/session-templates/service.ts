import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateTemplateBody, TemplateExerciseInput, UpdateTemplateBody } from "@/lib/session-templates/schemas";
import type { ExerciseMetric, ExercisePhase, SessionTemplate, TemplateExercise, TemplateExerciseSet } from "@/types";

export type TemplateExerciseWithName = TemplateExercise & {
  exercise_name: string;
  exercise_default_metric: ExerciseMetric;
};

export type TemplateWithExercises = SessionTemplate & {
  exercises: TemplateExerciseWithName[];
};

type TemplateExerciseSetRow = TemplateExerciseSet;

interface TemplateExerciseJoinRow {
  id: string;
  template_id: string;
  exercise_id: string;
  phase: ExercisePhase;
  sort_order: number;
  notes: string | null;
  exercises: { name: string; default_metric: ExerciseMetric } | null;
  template_exercise_sets: TemplateExerciseSetRow[];
}

type TemplateWithJoinedExercises = SessionTemplate & { template_exercises: TemplateExerciseJoinRow[] };

function parseSessionTemplate(raw: unknown): SessionTemplate {
  return raw as SessionTemplate;
}

function parseTemplateWithJoin(raw: unknown): TemplateWithJoinedExercises {
  return raw as TemplateWithJoinedExercises;
}

function mapTemplateExerciseSetRow(row: TemplateExerciseSetRow): TemplateExerciseSet {
  return {
    id: row.id,
    template_exercise_id: row.template_exercise_id,
    set_number: row.set_number,
    prescribed_reps: row.prescribed_reps,
    prescribed_duration_seconds: row.prescribed_duration_seconds,
    prescribed_load_kg: row.prescribed_load_kg,
    rest_after_seconds: row.rest_after_seconds,
  };
}

function mapTemplateExerciseRow(row: TemplateExerciseJoinRow): TemplateExerciseWithName {
  const sets = row.template_exercise_sets.map(mapTemplateExerciseSetRow).sort((a, b) => a.set_number - b.set_number);

  return {
    id: row.id,
    template_id: row.template_id,
    exercise_id: row.exercise_id,
    phase: row.phase,
    sort_order: row.sort_order,
    notes: row.notes,
    sets,
    exercise_name: row.exercises?.name ?? "",
    exercise_default_metric: row.exercises?.default_metric ?? "reps_weight",
  };
}

async function insertTemplateExercises(
  supabase: SupabaseClient,
  templateId: string,
  exercises: TemplateExerciseInput[],
): Promise<{ error: string | null }> {
  for (const exercise of exercises) {
    const insertResult = await supabase
      .from("template_exercises")
      .insert({
        template_id: templateId,
        exercise_id: exercise.exercise_id,
        phase: exercise.phase,
        sort_order: exercise.sort_order,
        notes: exercise.notes ?? null,
      })
      .select("id")
      .single();

    if (insertResult.error) {
      return { error: insertResult.error.message };
    }

    const templateExerciseId = insertResult.data.id as string;

    const setRows = exercise.sets.map((set, index) => ({
      template_exercise_id: templateExerciseId,
      set_number: index + 1,
      prescribed_reps: set.prescribed_reps ?? null,
      prescribed_duration_seconds: set.prescribed_duration_seconds ?? null,
      prescribed_load_kg: set.prescribed_load_kg ?? null,
      rest_after_seconds: set.rest_after_seconds ?? null,
    }));

    const { error: setsError } = await supabase.from("template_exercise_sets").insert(setRows);

    if (setsError) {
      return { error: setsError.message };
    }
  }

  return { error: null };
}

export async function listTemplates(
  supabase: SupabaseClient,
  trainerId: string,
): Promise<{ data: SessionTemplate[] | null; error: string | null }> {
  const result = await supabase
    .from("session_templates")
    .select("*")
    .eq("trainer_id", trainerId)
    .order("updated_at", { ascending: false });

  if (result.error) {
    return { data: null, error: result.error.message };
  }

  return { data: Array.isArray(result.data) ? result.data.map(parseSessionTemplate) : [], error: null };
}

export async function getTemplate(
  supabase: SupabaseClient,
  templateId: string,
): Promise<{ data: TemplateWithExercises | null; error: string | null }> {
  const getResult = await supabase
    .from("session_templates")
    .select("*, template_exercises(*, exercises(name, default_metric), template_exercise_sets(*))")
    .eq("id", templateId)
    .maybeSingle();

  if (getResult.error) {
    return { data: null, error: getResult.error.message };
  }

  if (!getResult.data) {
    return { data: null, error: null };
  }

  const raw = parseTemplateWithJoin(getResult.data);

  const exercises = raw.template_exercises.map(mapTemplateExerciseRow);

  const { template_exercises: _omit, ...template } = raw;

  return {
    data: {
      ...template,
      exercises,
    },
    error: null,
  };
}

export async function createTemplate(
  supabase: SupabaseClient,
  trainerId: string,
  body: CreateTemplateBody,
): Promise<{ data: SessionTemplate | null; error: string | null }> {
  const createResult = await supabase
    .from("session_templates")
    .insert({
      trainer_id: trainerId,
      name: body.name,
      description: body.description ?? null,
    })
    .select("*")
    .single();

  if (createResult.error || !createResult.data) {
    return { data: null, error: createResult.error?.message ?? "Failed to create template" };
  }

  const template = parseSessionTemplate(createResult.data);

  if (body.exercises.length > 0) {
    const { error: exercisesError } = await insertTemplateExercises(supabase, template.id, body.exercises);

    if (exercisesError) {
      await supabase.from("session_templates").delete().eq("id", template.id);
      return { data: null, error: exercisesError };
    }
  }

  return { data: template, error: null };
}

export async function updateTemplate(
  supabase: SupabaseClient,
  templateId: string,
  body: UpdateTemplateBody,
): Promise<{ data: SessionTemplate | null; error: string | null }> {
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.description !== undefined) patch.description = body.description;

  if (Object.keys(patch).length > 0) {
    const { error: patchError } = await supabase.from("session_templates").update(patch).eq("id", templateId);

    if (patchError) {
      return { data: null, error: patchError.message };
    }
  }

  if (body.exercises !== undefined) {
    const { error: deleteError } = await supabase.from("template_exercises").delete().eq("template_id", templateId);

    if (deleteError) {
      return { data: null, error: deleteError.message };
    }

    if (body.exercises.length > 0) {
      const { error: insertError } = await insertTemplateExercises(supabase, templateId, body.exercises);

      if (insertError) {
        return { data: null, error: insertError };
      }
    }
  }

  const fetchResult = await supabase.from("session_templates").select("*").eq("id", templateId).maybeSingle();

  if (fetchResult.error) {
    return { data: null, error: fetchResult.error.message };
  }

  return { data: fetchResult.data !== null ? parseSessionTemplate(fetchResult.data) : null, error: null };
}

export async function deleteTemplate(supabase: SupabaseClient, templateId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("session_templates").delete().eq("id", templateId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}
