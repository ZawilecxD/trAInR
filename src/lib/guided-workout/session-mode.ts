import type { ClientSessionDetail } from "@/lib/workout-sessions/service";

export type GuidedWorkoutMode = "overview" | "guided" | "edit-list" | "completed";

function isTerminalStatus(status: ClientSessionDetail["status"]): boolean {
  return status === "finished" || status === "finished_partially" || status === "cancelled";
}

export function resolveInitialMode(session: ClientSessionDetail): GuidedWorkoutMode {
  if (isTerminalStatus(session.status)) {
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
