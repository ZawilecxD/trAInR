import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateWorkoutSessionBody, UpdateWorkoutSessionBody } from "@/lib/workout-sessions/schemas";
import type { ExerciseMetric, ExercisePhase, SessionExercise, SessionExerciseSet, WorkoutSession } from "@/types";

export type SessionListItem = Pick<WorkoutSession, "id" | "name" | "scheduled_date" | "status" | "source_template_id">;

export type SessionExerciseWithName = SessionExercise & {
  exercise_name: string;
  exercise_default_metric: ExerciseMetric;
  sets: SessionExerciseSet[];
};

export type SessionWithExercises = WorkoutSession & {
  exercises: SessionExerciseWithName[];
};

type SessionExerciseSetRow = SessionExerciseSet;

interface SessionExerciseJoinRow {
  id: string;
  session_id: string;
  exercise_id: string;
  phase: ExercisePhase;
  sort_order: number;
  notes: string | null;
  exercises: { name: string; default_metric: ExerciseMetric } | null;
  session_exercise_sets: SessionExerciseSetRow[];
}

type WorkoutSessionWithJoinedExercises = WorkoutSession & { session_exercises: SessionExerciseJoinRow[] };

function parseWorkoutSession(raw: unknown): WorkoutSession {
  return raw as WorkoutSession;
}

function parseSessionListItem(raw: unknown): SessionListItem {
  return raw as SessionListItem;
}

function parseSessionWithJoin(raw: unknown): WorkoutSessionWithJoinedExercises {
  return raw as WorkoutSessionWithJoinedExercises;
}

function mapSessionExerciseSetRow(row: SessionExerciseSetRow): SessionExerciseSet {
  return {
    id: row.id,
    session_exercise_id: row.session_exercise_id,
    set_number: row.set_number,
    prescribed_reps: row.prescribed_reps,
    prescribed_duration_seconds: row.prescribed_duration_seconds,
    prescribed_load_kg: row.prescribed_load_kg,
    rest_after_seconds: row.rest_after_seconds,
  };
}

function mapSessionExerciseRow(row: SessionExerciseJoinRow): SessionExerciseWithName {
  const sets = row.session_exercise_sets.map(mapSessionExerciseSetRow).sort((a, b) => a.set_number - b.set_number);

  return {
    id: row.id,
    session_id: row.session_id,
    exercise_id: row.exercise_id,
    phase: row.phase,
    sort_order: row.sort_order,
    notes: row.notes,
    sets,
    exercise_name: row.exercises?.name ?? "",
    exercise_default_metric: row.exercises?.default_metric ?? "reps_weight",
  };
}

export async function listSessionsForClient(
  supabase: SupabaseClient,
  trainerId: string,
  clientId: string,
  from: string,
  to: string,
): Promise<{ data: SessionListItem[] | null; error: string | null }> {
  const planResult = await supabase
    .from("client_plans")
    .select("id")
    .eq("trainer_id", trainerId)
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();

  if (planResult.error) {
    return { data: null, error: planResult.error.message };
  }

  if (!planResult.data) {
    return { data: [], error: null };
  }

  const sessionsResult = await supabase
    .from("workout_sessions")
    .select("id, name, scheduled_date, status, source_template_id")
    .eq("client_plan_id", planResult.data.id)
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)
    .order("scheduled_date", { ascending: true });

  if (sessionsResult.error) {
    return { data: null, error: sessionsResult.error.message };
  }

  const sessions = Array.isArray(sessionsResult.data) ? sessionsResult.data.map(parseSessionListItem) : [];

  return { data: sessions, error: null };
}

export async function listMySessionsAsClient(
  supabase: SupabaseClient,
  from: string,
  to: string,
): Promise<{ data: SessionListItem[] | null; error: string | null }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return { data: null, error: authError.message };
  }

  if (!user) {
    return { data: [], error: null };
  }

  const planResult = await supabase
    .from("client_plans")
    .select("id")
    .eq("client_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (planResult.error) {
    return { data: null, error: planResult.error.message };
  }

  if (!planResult.data) {
    return { data: [], error: null };
  }

  const sessionsResult = await supabase
    .from("workout_sessions")
    .select("id, name, scheduled_date, status, source_template_id")
    .eq("client_plan_id", planResult.data.id)
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)
    .order("scheduled_date", { ascending: true });

  if (sessionsResult.error) {
    return { data: null, error: sessionsResult.error.message };
  }

  const sessions = Array.isArray(sessionsResult.data) ? sessionsResult.data.map(parseSessionListItem) : [];

  return { data: sessions, error: null };
}

export async function getSessionWithExercises(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<{ data: SessionWithExercises | null; error: string | null }> {
  const getResult = await supabase
    .from("workout_sessions")
    .select("*, session_exercises(*, exercises(name, default_metric), session_exercise_sets(*))")
    .eq("id", sessionId)
    .maybeSingle();

  if (getResult.error) {
    return { data: null, error: getResult.error.message };
  }

  if (!getResult.data) {
    return { data: null, error: null };
  }

  const raw = parseSessionWithJoin(getResult.data);
  const exercises = raw.session_exercises.map(mapSessionExerciseRow);
  const { session_exercises: _omit, ...session } = raw;

  return {
    data: {
      ...session,
      exercises,
    },
    error: null,
  };
}

export async function createWorkoutSession(
  supabase: SupabaseClient,
  body: CreateWorkoutSessionBody,
): Promise<{ data: string | null; error: string | null }> {
  const result = await supabase.rpc("create_workout_session", {
    p_client_id: body.client_id,
    p_scheduled_date: body.scheduled_date,
    p_name: body.name,
    p_source_template_id: body.source_template_id,
    p_exercises: body.exercises,
  });

  if (result.error) {
    return { data: null, error: result.error.message };
  }

  if (typeof result.data !== "string") {
    return { data: null, error: "Failed to create session" };
  }

  return { data: result.data, error: null };
}

export async function updateWorkoutSession(
  supabase: SupabaseClient,
  sessionId: string,
  body: UpdateWorkoutSessionBody,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("update_workout_session_snapshot", {
    p_session_id: sessionId,
    p_scheduled_date: body.scheduled_date ?? null,
    p_name: body.name ?? null,
    p_exercises: body.exercises ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function deleteWorkoutSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("delete_workout_session", {
    p_session_id: sessionId,
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function getWorkoutSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<{ data: WorkoutSession | null; error: string | null }> {
  const result = await supabase.from("workout_sessions").select("*").eq("id", sessionId).maybeSingle();

  if (result.error) {
    return { data: null, error: result.error.message };
  }

  return { data: result.data !== null ? parseWorkoutSession(result.data) : null, error: null };
}
