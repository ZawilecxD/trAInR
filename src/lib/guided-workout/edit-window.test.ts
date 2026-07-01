import { describe, expect, it } from "vitest";
import {
  computeEditDeadline,
  formatEditWindowRemaining,
  isSessionSealed,
  EDIT_WINDOW_MS,
} from "@/lib/guided-workout/edit-window";

describe("edit-window", () => {
  const firstLogged = "2026-06-14T12:00:00.000Z";

  it("computeEditDeadline adds 24 hours", () => {
    expect(computeEditDeadline(firstLogged)).toBe("2026-06-15T12:00:00.000Z");
    expect(EDIT_WINDOW_MS).toBe(86_400_000);
  });

  it("isSessionSealed is false before deadline and true at or after", () => {
    const deadline = computeEditDeadline(firstLogged);
    expect(isSessionSealed(deadline, new Date("2026-06-15T11:59:59.999Z"))).toBe(false);
    expect(isSessionSealed(deadline, new Date("2026-06-15T12:00:00.000Z"))).toBe(true);
    expect(isSessionSealed(deadline, new Date("2026-06-16T00:00:00.000Z"))).toBe(true);
  });

  it("isSessionSealed is false when locked_at is null", () => {
    expect(isSessionSealed(null)).toBe(false);
    expect(isSessionSealed(undefined)).toBe(false);
  });

  it("formatEditWindowRemaining shows open countdown and sealed label", () => {
    const deadline = computeEditDeadline(firstLogged);

    expect(formatEditWindowRemaining(null).status).toBe("open");
    expect(formatEditWindowRemaining(deadline, new Date("2026-06-14T13:00:00.000Z"))).toEqual({
      status: "open",
      label: "Editable for 23h (UTC)",
    });
    expect(formatEditWindowRemaining(deadline, new Date("2026-06-15T12:00:00.000Z"))).toEqual({
      status: "sealed",
      label: "Session sealed — logged data can no longer be edited",
    });
  });
});
