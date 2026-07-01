/** 24-hour edit window per FR-022. All comparisons use UTC instants. */
export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function computeEditDeadline(firstLoggedAt: string | Date): string {
  const start = typeof firstLoggedAt === "string" ? new Date(firstLoggedAt) : firstLoggedAt;
  return new Date(start.getTime() + EDIT_WINDOW_MS).toISOString();
}

/** True when the session seal deadline has passed. `lockedAt` is the deadline instant, not a boolean flag. */
export function isSessionSealed(lockedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!lockedAt) {
    return false;
  }

  return new Date(lockedAt).getTime() <= now.getTime();
}

export function formatEditWindowRemaining(
  lockedAt: string | null | undefined,
  now: Date = new Date(),
): { status: "open" | "sealed"; label: string } {
  if (!lockedAt) {
    return { status: "open", label: "Editable for 24h after your first logged set" };
  }

  const deadlineMs = new Date(lockedAt).getTime();
  const remainingMs = deadlineMs - now.getTime();

  if (remainingMs <= 0) {
    return { status: "sealed", label: "Session sealed — logged data can no longer be edited" };
  }

  const totalMinutes = Math.ceil(remainingMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return { status: "open", label: `Editable for ${hours}h ${minutes}m (UTC)` };
  }

  if (hours > 0) {
    return { status: "open", label: `Editable for ${hours}h (UTC)` };
  }

  return { status: "open", label: `Editable for ${Math.max(minutes, 1)}m (UTC)` };
}
