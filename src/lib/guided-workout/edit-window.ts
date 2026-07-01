import type { SessionStatus } from "@/types";

/** 24-hour edit window per FR-022. All comparisons use UTC instants. */
export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Seal deadline = anchor instant (session completion) + 24h UTC. */
export function computeEditDeadline(anchorAt: string | Date): string {
  const start = typeof anchorAt === "string" ? new Date(anchorAt) : anchorAt;
  return new Date(start.getTime() + EDIT_WINDOW_MS).toISOString();
}

/** True when the session seal deadline has passed. `lockedAt` is the deadline instant, not a boolean flag. */
export function isSessionSealed(lockedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!lockedAt) {
    return false;
  }

  return new Date(lockedAt).getTime() <= now.getTime();
}

/** Finished/partial session still within the post-completion edit window. */
export function isEditWindowOpen(
  status: SessionStatus,
  lockedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (status !== "finished" && status !== "finished_partially") {
    return false;
  }

  if (!lockedAt) {
    return false;
  }

  return !isSessionSealed(lockedAt, now);
}

/** Formats the UTC seal deadline for banner copy: "Editable till 15.06.2026 12:00". */
export function formatEditDeadlineLabel(deadline: string | Date): string {
  const instant = typeof deadline === "string" ? new Date(deadline) : deadline;
  const day = String(instant.getUTCDate()).padStart(2, "0");
  const month = String(instant.getUTCMonth() + 1).padStart(2, "0");
  const year = instant.getUTCFullYear();
  const hours = String(instant.getUTCHours()).padStart(2, "0");
  const minutes = String(instant.getUTCMinutes()).padStart(2, "0");

  return `Editable till ${day}.${month}.${year} ${hours}:${minutes}`;
}

export function formatEditWindowRemaining(
  lockedAt: string | null | undefined,
  now: Date = new Date(),
): { status: "open" | "sealed"; label: string } {
  if (!lockedAt) {
    return { status: "open", label: "Editable for 24h after you mark the workout done or partial" };
  }

  const deadlineMs = new Date(lockedAt).getTime();
  const remainingMs = deadlineMs - now.getTime();

  if (remainingMs <= 0) {
    return { status: "sealed", label: "Session sealed — logged data can no longer be edited" };
  }

  return { status: "open", label: formatEditDeadlineLabel(lockedAt) };
}
