import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateTemplateBody, TemplateExerciseInput, UpdateTemplateBody } from "@/lib/session-templates/schemas";
import type { ExerciseMetric, SessionTemplate, TemplateExercise } from "@/types";

export type TemplateExerciseWithName = TemplateExercise & {
  exercise_name: string;
  exercise_default_metric: ExerciseMetric;
};

export type TemplateWithExercises = SessionTemplate & {
  exercises: TemplateExerciseWithName[];
};

type TemplateExerciseJoinRow = Omit<TemplateExercise, never> & {
  exercises: { name: string; default_metric: ExerciseMetric } | null;
};

type TemplateWithJoinedExercises = SessionTemplate & { template_exercises: TemplateExerciseJoinRow[] };

function parseSessionTemplate(raw: unknown): SessionTemplate {
  return raw as SessionTemplate;
}

function parseTemplateWithJoin(raw: unknown): TemplateWithJoinedExercises {
  return raw as TemplateWithJoinedExercises;
}

function mapTemplateExerciseRow(row: TemplateExerciseJoinRow): TemplateExerciseWithName {
  return {
    id: row.id,
    template_id: row.template_id,
    exercise_id: row.exercise_id,
    phase: row.phase,
    sort_order: row.sort_order,
    prescribed_sets: row.prescribed_sets,
    prescribed_reps: row.prescribed_reps,
    prescribed_duration_seconds: row.prescribed_duration_seconds,
    prescribed_load_kg: row.prescribed_load_kg,
    rest_after_seconds: row.rest_after_seconds,
    notes: row.notes,
    exercise_name: row.exercises?.name ?? "",
    exercise_default_metric: row.exercises?.default_metric ?? "reps_weight",
  };
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
    .select("*, template_exercises(*, exercises(name, default_metric))")
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
    const exerciseRows = body.exercises.map((ex: TemplateExerciseInput) => ({
      template_id: template.id,
      exercise_id: ex.exercise_id,
      phase: ex.phase,
      sort_order: ex.sort_order,
      prescribed_sets: ex.prescribed_sets,
      prescribed_reps: ex.prescribed_reps ?? null,
      prescribed_duration_seconds: ex.prescribed_duration_seconds ?? null,
      prescribed_load_kg: ex.prescribed_load_kg ?? null,
      rest_after_seconds: ex.rest_after_seconds ?? null,
      notes: ex.notes ?? null,
    }));

    const { error: exercisesError } = await supabase.from("template_exercises").insert(exerciseRows);

    if (exercisesError) {
      await supabase.from("session_templates").delete().eq("id", template.id);
      return { data: null, error: exercisesError.message };
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
      const exerciseRows = body.exercises.map((ex: TemplateExerciseInput) => ({
        template_id: templateId,
        exercise_id: ex.exercise_id,
        phase: ex.phase,
        sort_order: ex.sort_order,
        prescribed_sets: ex.prescribed_sets,
        prescribed_reps: ex.prescribed_reps ?? null,
        prescribed_duration_seconds: ex.prescribed_duration_seconds ?? null,
        prescribed_load_kg: ex.prescribed_load_kg ?? null,
        rest_after_seconds: ex.rest_after_seconds ?? null,
        notes: ex.notes ?? null,
      }));

      const { error: insertError } = await supabase.from("template_exercises").insert(exerciseRows);

      if (insertError) {
        return { data: null, error: insertError.message };
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
