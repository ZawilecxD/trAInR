import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExerciseMetric } from "@/types";
import {
  aggregateSessionStats,
  summarizeExerciseHistory,
  type ExerciseHistorySummary,
  type SessionStat,
  type SessionStatInput,
  type WorkingSetInput,
} from "@/lib/exercise-stats/calculations";

/** One exercise the client has logged working sets for (list view). */
export interface LoggedExerciseSummary {
  exerciseId: string;
  name: string;
  defaultMetric: ExerciseMetric;
  lastLoggedAt: string;
  sessionCount: number;
  loggedSetCount: number;
}

/** Full per-exercise history for the stats detail page. */
export interface ExerciseHistory {
  exercise: { id: string; name: string; defaultMetric: ExerciseMetric };
  sessions: SessionStat[];
  summary: ExerciseHistorySummary;
}

interface WorkingSetRow {
  reps: number | null;
  duration_seconds: number | null;
  load_kg: number | null;
  logged_at: string;
  session_exercises: {
    exercise_id: string;
    exercises: { id: string; name: string; default_metric: ExerciseMetric } | null;
    workout_sessions: {
      id: string;
      scheduled_date: string;
      client_plans: { client_id: string } | null;
    } | null;
  } | null;
}

const WORKING_SET_SELECT =
  "reps, duration_seconds, load_kg, logged_at, " +
  "session_exercises!inner(exercise_id, exercises!inner(id, name, default_metric), " +
  "workout_sessions!inner(id, scheduled_date, client_plans!inner(client_id)))";

/** A row that carries all the nested data we need. */
interface ResolvedRow {
  reps: number | null;
  durationSeconds: number | null;
  loadKg: number | null;
  loggedAt: string;
  clientId: string;
  exerciseId: string;
  exerciseName: string;
  defaultMetric: ExerciseMetric;
  sessionId: string;
  scheduledDate: string;
}

function resolveRow(row: WorkingSetRow): ResolvedRow | null {
  const se = row.session_exercises;
  const exercise = se?.exercises;
  const session = se?.workout_sessions;
  const plan = session?.client_plans;
  if (!se || !exercise || !session || !plan) {
    return null;
  }

  return {
    reps: row.reps,
    durationSeconds: row.duration_seconds,
    loadKg: row.load_kg,
    loggedAt: row.logged_at,
    clientId: plan.client_id,
    exerciseId: se.exercise_id,
    exerciseName: exercise.name,
    defaultMetric: exercise.default_metric,
    sessionId: session.id,
    scheduledDate: session.scheduled_date,
  };
}

/**
 * List the distinct exercises this client has logged at least one working set
 * (`is_warmup = false`) for, most-recently-logged first.
 */
export async function listLoggedExercisesForClient(
  supabase: SupabaseClient,
  clientId: string,
): Promise<{ data: LoggedExerciseSummary[] | null; error: string | null }> {
  const result = await supabase
    .from("set_logs")
    .select(WORKING_SET_SELECT)
    .eq("is_warmup", false)
    .eq("session_exercises.workout_sessions.client_plans.client_id", clientId);

  if (result.error) {
    return { data: null, error: result.error.message };
  }

  const rawRows = (result.data as WorkingSetRow[] | null) ?? [];
  const rows = rawRows.map(resolveRow).filter((row): row is ResolvedRow => row !== null && row.clientId === clientId);

  const byExercise = new Map<string, { summary: LoggedExerciseSummary; sessionIds: Set<string> }>();

  for (const row of rows) {
    const existing = byExercise.get(row.exerciseId);
    if (existing) {
      existing.summary.loggedSetCount += 1;
      existing.sessionIds.add(row.sessionId);
      if (row.loggedAt > existing.summary.lastLoggedAt) {
        existing.summary.lastLoggedAt = row.loggedAt;
      }
    } else {
      byExercise.set(row.exerciseId, {
        summary: {
          exerciseId: row.exerciseId,
          name: row.exerciseName,
          defaultMetric: row.defaultMetric,
          lastLoggedAt: row.loggedAt,
          sessionCount: 0,
          loggedSetCount: 1,
        },
        sessionIds: new Set([row.sessionId]),
      });
    }
  }

  const summaries = Array.from(byExercise.values())
    .map(({ summary, sessionIds }) => ({ ...summary, sessionCount: sessionIds.size }))
    .sort((a, b) => b.lastLoggedAt.localeCompare(a.lastLoggedAt));

  return { data: summaries, error: null };
}

/**
 * Full working-set history for one exercise, grouped by session (most recent
 * first) with per-session aggregates and an all-time summary. Returns `null`
 * data (no error) when the client has logged no working sets for the exercise.
 */
export async function getExerciseHistoryForClient(
  supabase: SupabaseClient,
  clientId: string,
  exerciseId: string,
): Promise<{ data: ExerciseHistory | null; error: string | null }> {
  const result = await supabase
    .from("set_logs")
    .select(WORKING_SET_SELECT)
    .eq("is_warmup", false)
    .eq("session_exercises.exercise_id", exerciseId)
    .eq("session_exercises.workout_sessions.client_plans.client_id", clientId)
    .order("set_number", { ascending: true });

  if (result.error) {
    return { data: null, error: result.error.message };
  }

  const rawRows = (result.data as WorkingSetRow[] | null) ?? [];
  const rows = rawRows
    .map(resolveRow)
    .filter((row): row is ResolvedRow => row !== null && row.exerciseId === exerciseId && row.clientId === clientId);

  if (rows.length === 0) {
    return { data: null, error: null };
  }

  const metric = rows[0].defaultMetric;
  const exercise = { id: exerciseId, name: rows[0].exerciseName, defaultMetric: metric };

  const bySession = new Map<string, SessionStatInput & { latestLoggedAt: string }>();

  for (const row of rows) {
    const workingSet: WorkingSetInput = {
      reps: row.reps,
      loadKg: row.loadKg,
      durationSeconds: row.durationSeconds,
    };
    const existing = bySession.get(row.sessionId);
    if (existing) {
      existing.sets.push(workingSet);
      if (row.loggedAt > existing.latestLoggedAt) {
        existing.latestLoggedAt = row.loggedAt;
      }
    } else {
      bySession.set(row.sessionId, {
        sessionId: row.sessionId,
        scheduledDate: row.scheduledDate,
        loggedAt: row.loggedAt,
        latestLoggedAt: row.loggedAt,
        sets: [workingSet],
      });
    }
  }

  const sessions: SessionStat[] = Array.from(bySession.values())
    .map((input) => aggregateSessionStats({ ...input, loggedAt: input.latestLoggedAt }, metric))
    .sort((a, b) => {
      const byDate = b.scheduledDate.localeCompare(a.scheduledDate);
      return byDate !== 0 ? byDate : b.loggedAt.localeCompare(a.loggedAt);
    });

  return {
    data: {
      exercise,
      sessions,
      summary: summarizeExerciseHistory(sessions),
    },
    error: null,
  };
}
