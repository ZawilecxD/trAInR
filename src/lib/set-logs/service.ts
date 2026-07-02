import type { SupabaseClient } from "@supabase/supabase-js";
import type { UpsertSetLogBody } from "@/lib/set-logs/schemas";
import { isSessionSealed } from "@/lib/guided-workout/edit-window";
import type { ExerciseMetric, SetLog } from "@/types";

type UpsertSetLogErrorCode = "not_found" | "locked" | "validation_error";

export type UpsertSetLogResult =
  | { ok: true; data: SetLog }
  | { ok: false; code: UpsertSetLogErrorCode; message: string };

interface SessionExerciseContextRow {
  id: string;
  exercises: { default_metric: ExerciseMetric } | { default_metric: ExerciseMetric }[] | null;
  workout_sessions:
    | {
        locked_at: string | null;
        client_plans: { client_id: string } | { client_id: string }[];
      }
    | {
        locked_at: string | null;
        client_plans: { client_id: string } | { client_id: string }[];
      }[]
    | null;
}

function unwrapSingle<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function parseSetLog(raw: unknown): SetLog {
  return raw as SetLog;
}

function getClientIdFromPlanJoin(
  session: {
    locked_at: string | null;
    client_plans: { client_id: string } | { client_id: string }[];
  } | null,
): string | null {
  if (!session) return null;
  const joined = session.client_plans;
  if (Array.isArray(joined)) {
    return joined[0]?.client_id ?? null;
  }
  return joined.client_id;
}

function validateMetricFields(metric: ExerciseMetric, body: UpsertSetLogBody): string | null {
  if (metric === "distance") {
    return "distance exercises are not supported for logging";
  }

  const hasValues = body.reps !== null || body.duration_seconds !== null || body.load_kg !== null;
  if (!hasValues) {
    return null;
  }

  if (metric === "time") {
    if (body.duration_seconds === null) {
      return "duration is required for timed exercises";
    }
    return null;
  }

  if (body.reps === null) {
    return "reps are required for this exercise";
  }

  return null;
}

export async function upsertSetLog(
  supabase: SupabaseClient,
  userId: string,
  body: UpsertSetLogBody,
): Promise<UpsertSetLogResult> {
  const contextResult = await supabase
    .from("session_exercises")
    .select("id, exercises(default_metric), workout_sessions(locked_at, client_plans!inner(client_id))")
    .eq("id", body.session_exercise_id)
    .maybeSingle();

  if (contextResult.error) {
    return { ok: false, code: "not_found", message: contextResult.error.message };
  }

  if (!contextResult.data) {
    return { ok: false, code: "not_found", message: "Session exercise not found" };
  }

  const row = contextResult.data as SessionExerciseContextRow;
  const session = unwrapSingle(row.workout_sessions);
  const clientId = getClientIdFromPlanJoin(session);

  if (clientId !== userId) {
    return { ok: false, code: "not_found", message: "Session exercise not found" };
  }

  if (isSessionSealed(session?.locked_at)) {
    return { ok: false, code: "locked", message: "Session is locked" };
  }

  const exercise = unwrapSingle(row.exercises);
  const metric = exercise?.default_metric ?? "reps_weight";
  const metricError = validateMetricFields(metric, body);
  if (metricError) {
    return { ok: false, code: "validation_error", message: metricError };
  }

  const upsertResult = await supabase
    .from("set_logs")
    .upsert(
      {
        session_exercise_id: body.session_exercise_id,
        set_number: body.set_number,
        reps: body.reps,
        duration_seconds: body.duration_seconds,
        load_kg: body.load_kg,
        rpe: body.rpe,
        is_complete: body.is_complete,
        is_warmup: body.is_warmup,
      },
      { onConflict: "session_exercise_id,set_number" },
    )
    .select("*")
    .single();

  if (upsertResult.error) {
    return { ok: false, code: "not_found", message: upsertResult.error.message };
  }

  return { ok: true, data: parseSetLog(upsertResult.data) };
}

type DeleteSetLogErrorCode = "not_found" | "locked";

export type DeleteSetLogResult = { ok: true } | { ok: false; code: DeleteSetLogErrorCode; message: string };

export async function deleteSetLog(
  supabase: SupabaseClient,
  userId: string,
  sessionExerciseId: string,
  setNumber: number,
): Promise<DeleteSetLogResult> {
  const contextResult = await supabase
    .from("session_exercises")
    .select("id, workout_sessions(locked_at, client_plans!inner(client_id))")
    .eq("id", sessionExerciseId)
    .maybeSingle();

  if (contextResult.error) {
    return { ok: false, code: "not_found", message: contextResult.error.message };
  }

  if (!contextResult.data) {
    return { ok: false, code: "not_found", message: "Session exercise not found" };
  }

  const row = contextResult.data as {
    id: string;
    workout_sessions:
      | {
          locked_at: string | null;
          client_plans: { client_id: string } | { client_id: string }[];
        }
      | {
          locked_at: string | null;
          client_plans: { client_id: string } | { client_id: string }[];
        }[]
      | null;
  };

  const session = unwrapSingle(row.workout_sessions);
  const clientId = getClientIdFromPlanJoin(session);

  if (clientId !== userId) {
    return { ok: false, code: "not_found", message: "Session exercise not found" };
  }

  if (isSessionSealed(session?.locked_at)) {
    return { ok: false, code: "locked", message: "Session is locked" };
  }

  const deleteResult = await supabase
    .from("set_logs")
    .delete()
    .eq("session_exercise_id", sessionExerciseId)
    .eq("set_number", setNumber);

  if (deleteResult.error) {
    return { ok: false, code: "not_found", message: deleteResult.error.message };
  }

  return { ok: true };
}
