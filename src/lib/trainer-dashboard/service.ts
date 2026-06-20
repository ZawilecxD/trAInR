import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActiveClientPlan } from "@/lib/client-plans/service";
import {
  deriveSessionReadout,
  readoutStatusLabel,
  resolveLastActivityAt,
  type ExerciseReadoutInput,
  type ReadoutStatus,
} from "@/lib/trainer-dashboard/readout";
import type { ExerciseMetric, ExercisePhase, Profile, SessionExerciseSet, SetLog, TrainerClient } from "@/types";

export interface TrainerDashboardClient {
  assignmentId: string;
  clientId: string;
  displayName: string;
  assignedAt: string;
  activePlan: ActiveClientPlan | null;
}

export interface TrainerActivityItem {
  sessionId: string;
  clientId: string;
  clientDisplayName: string;
  sessionName: string;
  scheduledDate: string;
  lastActivityAt: string;
  readoutStatus: ReadoutStatus;
  readoutLabel: string;
}

export interface TrainerDashboardSummary {
  activeClientCount: number;
  clientsWithActivePlanCount: number;
  recentLoggedSessionCount: number;
}

export interface TrainerDashboard {
  clients: TrainerDashboardClient[];
  summary: TrainerDashboardSummary;
  recentActivity: TrainerActivityItem[];
}

export interface GetTrainerDashboardOptions {
  activityLimit?: number;
}

const DEFAULT_ACTIVITY_LIMIT = 20;

interface ClientPlanRow {
  id: string;
  client_id: string;
  name: string;
  start_date: string | null;
}

interface ActivitySessionExerciseRow {
  id: string;
  exercise_id: string;
  phase: ExercisePhase;
  sort_order: number;
  exercises: { name: string; default_metric: ExerciseMetric } | null;
  session_exercise_sets: SessionExerciseSet[];
  set_logs: SetLog[];
}

interface ActivitySessionRow {
  id: string;
  name: string | null;
  scheduled_date: string;
  started_at: string | null;
  client_plans: { client_id: string } | { client_id: string }[];
  session_exercises: ActivitySessionExerciseRow[];
}

function parseTrainerClient(raw: unknown): TrainerClient {
  return raw as TrainerClient;
}

function parseClientPlanRow(raw: unknown): ClientPlanRow {
  return raw as ClientPlanRow;
}

function parseActivitySessionRow(raw: unknown): ActivitySessionRow {
  return raw as ActivitySessionRow;
}

function unwrapClientPlanClientId(clientPlans: ActivitySessionRow["client_plans"]): string | null {
  if (Array.isArray(clientPlans)) {
    return clientPlans[0]?.client_id ?? null;
  }

  return clientPlans.client_id;
}

function mapSessionExerciseToReadoutInput(exercise: ActivitySessionExerciseRow): ExerciseReadoutInput {
  return {
    id: exercise.id,
    exercise_id: exercise.exercise_id,
    phase: exercise.phase,
    sort_order: exercise.sort_order,
    exercise_name: exercise.exercises?.name ?? "",
    exercise_default_metric: exercise.exercises?.default_metric ?? "reps_weight",
    sets: exercise.session_exercise_sets,
    logs: exercise.set_logs,
  };
}

function sessionHasLoggedActivity(session: ActivitySessionRow): boolean {
  if (session.started_at) {
    return true;
  }

  return session.session_exercises.some((exercise) => exercise.set_logs.length > 0);
}

function collectSessionLogs(session: ActivitySessionRow): SetLog[] {
  return session.session_exercises.flatMap((exercise) => exercise.set_logs);
}

function buildActivityItem(
  session: ActivitySessionRow,
  displayNameByClientId: Map<string, string>,
): TrainerActivityItem | null {
  const clientId = unwrapClientPlanClientId(session.client_plans);

  if (!clientId) {
    return null;
  }

  const readoutInputs = session.session_exercises.map(mapSessionExerciseToReadoutInput);
  const readout = deriveSessionReadout(readoutInputs);
  const logs = collectSessionLogs(session);
  const lastActivityAt = resolveLastActivityAt(session.started_at, logs);

  if (!lastActivityAt) {
    return null;
  }

  return {
    sessionId: session.id,
    clientId,
    clientDisplayName: displayNameByClientId.get(clientId) ?? "Unknown client",
    sessionName: session.name ?? "Workout",
    scheduledDate: session.scheduled_date,
    lastActivityAt,
    readoutStatus: readout.status,
    readoutLabel: readoutStatusLabel(readout.status),
  };
}

export async function getTrainerDashboard(
  supabase: SupabaseClient,
  trainerId: string,
  options: GetTrainerDashboardOptions = {},
): Promise<{ data: TrainerDashboard | null; error: string | null }> {
  const activityLimit = options.activityLimit ?? DEFAULT_ACTIVITY_LIMIT;

  const assignmentsResult = await supabase
    .from("trainer_clients")
    .select("id, client_id, assigned_at")
    .eq("trainer_id", trainerId)
    .eq("status", "active")
    .order("assigned_at", { ascending: false });

  if (assignmentsResult.error) {
    return { data: null, error: assignmentsResult.error.message };
  }

  const assignments = Array.isArray(assignmentsResult.data) ? assignmentsResult.data.map(parseTrainerClient) : [];
  const clientIds = assignments.map((assignment) => assignment.client_id);

  if (clientIds.length === 0) {
    return {
      data: {
        clients: [],
        summary: {
          activeClientCount: 0,
          clientsWithActivePlanCount: 0,
          recentLoggedSessionCount: 0,
        },
        recentActivity: [],
      },
      error: null,
    };
  }

  const [profilesResult, plansResult] = await Promise.all([
    supabase.from("profiles").select("id, display_name").in("id", clientIds),
    supabase
      .from("client_plans")
      .select("id, client_id, name, start_date")
      .eq("trainer_id", trainerId)
      .eq("status", "active")
      .in("client_id", clientIds),
  ]);

  if (profilesResult.error) {
    return { data: null, error: profilesResult.error.message };
  }

  if (plansResult.error) {
    return { data: null, error: plansResult.error.message };
  }

  const profiles = Array.isArray(profilesResult.data)
    ? (profilesResult.data as Pick<Profile, "id" | "display_name">[])
    : [];
  const displayNameByClientId = new Map(profiles.map((profile) => [profile.id, profile.display_name]));

  const planRows = Array.isArray(plansResult.data) ? plansResult.data.map(parseClientPlanRow) : [];
  const planByClientId = new Map(planRows.map((plan) => [plan.client_id, plan]));
  const planIds = planRows.map((plan) => plan.id);

  const clients: TrainerDashboardClient[] = assignments.map((assignment) => {
    const plan = planByClientId.get(assignment.client_id);

    return {
      assignmentId: assignment.id,
      clientId: assignment.client_id,
      displayName: displayNameByClientId.get(assignment.client_id) ?? "Unknown client",
      assignedAt: assignment.assigned_at,
      activePlan: plan
        ? {
            id: plan.id,
            name: plan.name,
            start_date: plan.start_date,
          }
        : null,
    };
  });

  let recentActivity: TrainerActivityItem[] = [];

  if (planIds.length > 0) {
    const sessionsResult = await supabase
      .from("workout_sessions")
      .select(
        "id, name, scheduled_date, started_at, client_plans!inner(client_id), session_exercises(id, exercise_id, phase, sort_order, exercises(name, default_metric), session_exercise_sets(*), set_logs(*))",
      )
      .in("client_plan_id", planIds)
      .order("scheduled_date", { ascending: false })
      .limit(activityLimit * 3);

    if (sessionsResult.error) {
      return { data: null, error: sessionsResult.error.message };
    }

    const sessions = Array.isArray(sessionsResult.data) ? sessionsResult.data.map(parseActivitySessionRow) : [];

    recentActivity = sessions
      .filter(sessionHasLoggedActivity)
      .map((session) => buildActivityItem(session, displayNameByClientId))
      .filter((item): item is TrainerActivityItem => item !== null)
      .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt))
      .slice(0, activityLimit);
  }

  return {
    data: {
      clients,
      summary: {
        activeClientCount: clients.length,
        clientsWithActivePlanCount: clients.filter((client) => client.activePlan !== null).length,
        recentLoggedSessionCount: recentActivity.length,
      },
      recentActivity,
    },
    error: null,
  };
}
