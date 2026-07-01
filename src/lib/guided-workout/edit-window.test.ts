import { describe, expect, it } from "vitest";
import {
  computeEditDeadline,
  formatEditDeadlineLabel,
  formatEditWindowRemaining,
  isEditWindowOpen,
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

  it("isEditWindowOpen is true for finished sessions before deadline", () => {
    const deadline = computeEditDeadline(firstLogged);
    expect(isEditWindowOpen("finished", deadline, new Date("2026-06-14T13:00:00.000Z"))).toBe(true);
    expect(isEditWindowOpen("finished_partially", deadline, new Date("2026-06-14T13:00:00.000Z"))).toBe(true);
    expect(isEditWindowOpen("cancelled", deadline)).toBe(false);
    expect(isEditWindowOpen("finished", null)).toBe(false);
    expect(isEditWindowOpen("finished", deadline, new Date("2026-06-15T12:00:00.000Z"))).toBe(false);
  });

  it("formatEditDeadlineLabel shows full UTC date and time", () => {
    expect(formatEditDeadlineLabel("2026-06-15T12:00:00.000Z")).toBe("Editable till 15.06.2026 12:00");
    expect(formatEditDeadlineLabel("2026-07-02T14:30:00.000Z")).toBe("Editable till 02.07.2026 14:30");
  });

  it("formatEditWindowRemaining shows deadline label and sealed state", () => {
    const deadline = computeEditDeadline(firstLogged);

    expect(formatEditWindowRemaining(null).status).toBe("open");
    expect(formatEditWindowRemaining(null).label).toBe("Editable for 24h after you mark the workout done or partial");
    expect(formatEditWindowRemaining(deadline, new Date("2026-06-14T13:00:00.000Z"))).toEqual({
      status: "open",
      label: "Editable till 15.06.2026 12:00",
    });
    expect(formatEditWindowRemaining(deadline, new Date("2026-06-15T12:00:00.000Z"))).toEqual({
      status: "sealed",
      label: "Session sealed — logged data can no longer be edited",
    });
  });
});
