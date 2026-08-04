import type { SessionStatus } from "@/types";

export interface NextSessionCandidate {
  id: string;
  name: string | null;
  scheduled_date: string;
  status: SessionStatus;
  started_at?: string | null;
}

function isOpenSession(session: NextSessionCandidate): boolean {
  return session.status === "not_started";
}

function compareSessions(a: NextSessionCandidate, b: NextSessionCandidate): number {
  const byDate = a.scheduled_date.localeCompare(b.scheduled_date);
  if (byDate !== 0) {
    return byDate;
  }
  return (a.name ?? "").localeCompare(b.name ?? "");
}

/** Prefer an open session already started today, else earliest open session on/after today. */
export function selectFocusSession(sessions: NextSessionCandidate[], todayIso: string): NextSessionCandidate | null {
  const open = sessions.filter(isOpenSession).sort(compareSessions);
  const inProgressToday = open.find((session) => session.scheduled_date === todayIso && Boolean(session.started_at));
  if (inProgressToday) {
    return inProgressToday;
  }

  return open.find((session) => session.scheduled_date >= todayIso) ?? null;
}

/** Upcoming open sessions after the focus session (or from today if none). */
export function selectUpcomingSessions(
  sessions: NextSessionCandidate[],
  todayIso: string,
  focusId: string | null,
  limit = 3,
): NextSessionCandidate[] {
  return sessions
    .filter(isOpenSession)
    .filter((session) => session.scheduled_date >= todayIso)
    .filter((session) => session.id !== focusId)
    .sort(compareSessions)
    .slice(0, limit);
}

export function isSessionInProgress(session: Pick<NextSessionCandidate, "status" | "started_at">): boolean {
  return session.status === "not_started" && Boolean(session.started_at);
}
