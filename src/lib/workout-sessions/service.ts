import type { SupabaseClient } from "@supabase/supabase-js";
import { computeEditDeadline, isSessionSealed } from "@/lib/guided-workout/edit-window";
import { isTrainerAssignedToClient } from "@/lib/client-plans/service";
import { sortByPhaseThenSortOrder } from "@/lib/guided-workout/phase-labels";
import { deriveSessionReadout, type SessionReadoutSummary } from "@/lib/trainer-dashboard/readout";
import type { CreateWorkoutSessionBody, UpdateWorkoutSessionBody } from "@/lib/workout-sessions/schemas";
import type { AssignedTrainer } from "@/types";
import type {
  ExerciseMetric,
  ExercisePhase,
  SessionExercise,
  SessionExerciseSet,
  SetLog,
  WorkoutSession,
} from "@/types";

export type SessionListItem = Pick<WorkoutSession, "id" | "name" | "scheduled_date" | "status" | "source_template_id">;

export type SessionExerciseWithName = SessionExercise & {
  exercise_name: string;
  exercise_default_metric: ExerciseMetric;
  sets: SessionExerciseSet[];
};

export type SessionExerciseDetail = SessionExerciseWithName & {
  logs: SetLog[];
};

export interface SessionMeta {
  trainer_display_name: string;
}

export type ClientSessionDetail = WorkoutSession &
  SessionMeta & {
    exercises: SessionExerciseDetail[];
  };

export type SessionWithExercises = WorkoutSession & {
  exercises: SessionExerciseWithName[];
};

export type TrainerSessionDetail = WorkoutSession & {
  client_id: string;
  client_display_name: string;
  exercises: SessionExerciseDetail[];
  readout: SessionReadoutSummary;
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

interface SessionExerciseJoinRowWithLogs extends SessionExerciseJoinRow {
  set_logs: SetLog[];
}

type WorkoutSessionWithJoinedExercises = WorkoutSession & { session_exercises: SessionExerciseJoinRow[] };

type WorkoutSessionWithJoinedExercisesAndLogs = WorkoutSession & {
  client_plans: { client_id: string; trainer_id: string } | { client_id: string; trainer_id: string }[];
  session_exercises: SessionExerciseJoinRowWithLogs[];
};

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
    is_warmup: row.is_warmup,
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

function mapSessionExerciseDetailRow(row: SessionExerciseJoinRowWithLogs): SessionExerciseDetail {
  const base = mapSessionExerciseRow(row);
  const logs = [...row.set_logs].sort((a, b) => a.set_number - b.set_number);

  return {
    ...base,
    logs,
  };
}

function parseWorkoutSessionWithLogs(raw: unknown): WorkoutSessionWithJoinedExercisesAndLogs {
  return raw as WorkoutSessionWithJoinedExercisesAndLogs;
}

async function getTrainerDisplayName(supabase: SupabaseClient): Promise<string> {
  const trainerResult = await supabase.rpc("get_my_assigned_trainer");

  if (!trainerResult.error && trainerResult.data) {
    return (trainerResult.data as AssignedTrainer).display_name;
  }

  return "";
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
  userId: string,
  from: string,
  to: string,
): Promise<{ data: SessionListItem[] | null; error: string | null }> {
  const planResult = await supabase
    .from("client_plans")
    .select("id")
    .eq("client_id", userId)
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

export async function getMySessionDetail(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<{ data: ClientSessionDetail | null; error: string | null }> {
  const getResult = await supabase
    .from("workout_sessions")
    .select(
      "*, client_plans!inner(client_id, trainer_id), session_exercises(*, exercises(name, default_metric), session_exercise_sets(*), set_logs(*))",
    )
    .eq("id", sessionId)
    .eq("client_plans.client_id", userId)
    .maybeSingle();

  if (getResult.error) {
    return { data: null, error: getResult.error.message };
  }

  if (!getResult.data) {
    return { data: null, error: null };
  }

  const raw = parseWorkoutSessionWithLogs(getResult.data);
  const exercises = sortByPhaseThenSortOrder(raw.session_exercises.map(mapSessionExerciseDetailRow));
  const trainerDisplayName = await getTrainerDisplayName(supabase);
  const { client_plans: _omitPlan, session_exercises: _omitExercises, ...session } = raw;

  return {
    data: {
      ...session,
      trainer_display_name: trainerDisplayName,
      exercises,
    },
    error: null,
  };
}

export type StartMySessionResult =
  | { ok: true; data: WorkoutSession }
  | { ok: false; code: "not_found" | "already_started"; message: string };

export async function startMySession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<StartMySessionResult> {
  const existingResult = await supabase
    .from("workout_sessions")
    .select("id, started_at, client_plans!inner(client_id)")
    .eq("id", sessionId)
    .eq("client_plans.client_id", userId)
    .maybeSingle();

  if (existingResult.error) {
    return { ok: false, code: "not_found", message: existingResult.error.message };
  }

  if (!existingResult.data) {
    return { ok: false, code: "not_found", message: "Session not found" };
  }

  const existing = existingResult.data as { started_at: string | null };

  if (existing.started_at) {
    return { ok: false, code: "already_started", message: "Session already started" };
  }

  const updateResult = await supabase
    .from("workout_sessions")
    .update({ started_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("started_at", null)
    .select("*")
    .maybeSingle();

  if (updateResult.error) {
    return { ok: false, code: "not_found", message: updateResult.error.message };
  }

  if (!updateResult.data) {
    return { ok: false, code: "already_started", message: "Session already started" };
  }

  return { ok: true, data: parseWorkoutSession(updateResult.data) };
}

export type RestartMySessionResult =
  | { ok: true; data: WorkoutSession }
  | { ok: false; code: "not_found" | "locked"; message: string };

export async function restartMySession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<RestartMySessionResult> {
  const sessionResult = await supabase
    .from("workout_sessions")
    .select("id, locked_at, client_plans!inner(client_id), session_exercises(id)")
    .eq("id", sessionId)
    .eq("client_plans.client_id", userId)
    .maybeSingle();

  if (sessionResult.error) {
    return { ok: false, code: "not_found", message: sessionResult.error.message };
  }

  if (!sessionResult.data) {
    return { ok: false, code: "not_found", message: "Session not found" };
  }

  const session = sessionResult.data as {
    id: string;
    locked_at: string | null;
    session_exercises: { id: string }[];
  };

  if (isSessionSealed(session.locked_at)) {
    return { ok: false, code: "locked", message: "Session is locked" };
  }

  const exerciseIds = session.session_exercises.map((exercise) => exercise.id);

  if (exerciseIds.length > 0) {
    const deleteLogsResult = await supabase.from("set_logs").delete().in("session_exercise_id", exerciseIds);

    if (deleteLogsResult.error) {
      return { ok: false, code: "not_found", message: deleteLogsResult.error.message };
    }
  }

  const updateResult = await supabase
    .from("workout_sessions")
    .update({ started_at: null, locked_at: null })
    .eq("id", sessionId)
    .select("*")
    .maybeSingle();

  if (updateResult.error) {
    return { ok: false, code: "not_found", message: updateResult.error.message };
  }

  if (!updateResult.data) {
    return { ok: false, code: "not_found", message: "Session not found" };
  }

  return { ok: true, data: parseWorkoutSession(updateResult.data) };
}

export type MarkSessionCompleteResult =
  | { ok: true; data: WorkoutSession }
  | { ok: false; code: "not_found" | "already_completed"; message: string };

export async function markSessionComplete(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  status: "finished" | "finished_partially" | "cancelled",
): Promise<MarkSessionCompleteResult> {
  const sessionResult = await supabase
    .from("workout_sessions")
    .select("id, status, client_plans!inner(client_id)")
    .eq("id", sessionId)
    .eq("client_plans.client_id", userId)
    .maybeSingle();

  if (sessionResult.error) {
    return { ok: false, code: "not_found", message: sessionResult.error.message };
  }

  if (!sessionResult.data) {
    return { ok: false, code: "not_found", message: "Session not found" };
  }

  const existing = sessionResult.data as { id: string; status: string };

  if (existing.status !== "not_started") {
    return { ok: false, code: "already_completed", message: "Session has already been completed or cancelled" };
  }

  const updatePayload: Record<string, string | null> = { status };
  if (status === "finished" || status === "finished_partially") {
    const completedAt = new Date().toISOString();
    updatePayload.completed_at = completedAt;
    updatePayload.locked_at = computeEditDeadline(completedAt);
  }

  const updateResult = await supabase
    .from("workout_sessions")
    .update(updatePayload)
    .eq("id", sessionId)
    .select("*")
    .maybeSingle();

  if (updateResult.error) {
    return { ok: false, code: "not_found", message: updateResult.error.message };
  }

  if (!updateResult.data) {
    return { ok: false, code: "not_found", message: "Session not found" };
  }

  return { ok: true, data: parseWorkoutSession(updateResult.data) };
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
  const exercises = sortByPhaseThenSortOrder(raw.session_exercises.map(mapSessionExerciseRow));
  const { session_exercises: _omit, ...session } = raw;

  return {
    data: {
      ...session,
      exercises,
    },
    error: null,
  };
}

export async function getSessionDetailForTrainer(
  supabase: SupabaseClient,
  trainerId: string,
  clientId: string,
  sessionId: string,
): Promise<{ data: TrainerSessionDetail | null; error: string | null }> {
  const { assigned, error: assignmentError } = await isTrainerAssignedToClient(supabase, trainerId, clientId);

  if (assignmentError) {
    return { data: null, error: assignmentError };
  }

  if (!assigned) {
    return { data: null, error: null };
  }

  const getResult = await supabase
    .from("workout_sessions")
    .select(
      "*, client_plans!inner(client_id, trainer_id, status), session_exercises(*, exercises(name, default_metric), session_exercise_sets(*), set_logs(*))",
    )
    .eq("id", sessionId)
    .eq("client_plans.client_id", clientId)
    .eq("client_plans.trainer_id", trainerId)
    .eq("client_plans.status", "active")
    .maybeSingle();

  if (getResult.error) {
    return { data: null, error: getResult.error.message };
  }

  if (!getResult.data) {
    return { data: null, error: null };
  }

  const raw = parseWorkoutSessionWithLogs(getResult.data);
  const exercises = sortByPhaseThenSortOrder(raw.session_exercises.map(mapSessionExerciseDetailRow));
  const readout = deriveSessionReadout(
    exercises.map((exercise) => ({
      id: exercise.id,
      exercise_id: exercise.exercise_id,
      phase: exercise.phase,
      sort_order: exercise.sort_order,
      exercise_name: exercise.exercise_name,
      exercise_default_metric: exercise.exercise_default_metric,
      sets: exercise.sets,
      logs: exercise.logs,
    })),
  );

  const profileResult = await supabase.from("profiles").select("display_name").eq("id", clientId).maybeSingle();

  if (profileResult.error) {
    return { data: null, error: profileResult.error.message };
  }

  const clientDisplayName =
    typeof profileResult.data?.display_name === "string" ? profileResult.data.display_name : "Client";

  const clientPlans = raw.client_plans;
  const clientPlan = Array.isArray(clientPlans) ? clientPlans[0] : clientPlans;
  const { client_plans: _omitPlan, session_exercises: _omitExercises, ...session } = raw;

  return {
    data: {
      ...session,
      client_id: clientPlan.client_id,
      client_display_name: clientDisplayName,
      exercises,
      readout,
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
