import type { ClientSessionDetail } from "@/lib/workout-sessions/service";

export type GuidedWorkoutMode = "overview" | "guided" | "edit-list" | "completed";

export function resolveInitialMode(session: ClientSessionDetail): GuidedWorkoutMode {
  if (session.status !== "not_started") {
    return "completed";
  }

  const hasLogs = session.exercises.some((exercise) => exercise.logs.length > 0);

  if (session.started_at && hasLogs) {
    return "edit-list";
  }

  if (session.started_at) {
    return "guided";
  }

  return "overview";
}
