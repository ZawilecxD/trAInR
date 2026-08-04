import { describe, expect, it } from "vitest";
import {
  isSessionInProgress,
  selectFocusSession,
  selectUpcomingSessions,
  type NextSessionCandidate,
} from "@/lib/client-dashboard/next-session";

function session(
  partial: Partial<NextSessionCandidate> & Pick<NextSessionCandidate, "id" | "scheduled_date">,
): NextSessionCandidate {
  return {
    name: partial.name ?? "Workout",
    status: partial.status ?? "not_started",
    started_at: partial.started_at ?? null,
    ...partial,
  };
}

describe("selectFocusSession", () => {
  it("prefers an in-progress session scheduled today", () => {
    const focus = selectFocusSession(
      [
        session({ id: "a", scheduled_date: "2026-08-02", name: "Later" }),
        session({ id: "b", scheduled_date: "2026-08-02", name: "Active", started_at: "2026-08-02T10:00:00Z" }),
        session({ id: "c", scheduled_date: "2026-08-01", name: "Yesterday" }),
      ],
      "2026-08-02",
    );
    expect(focus?.id).toBe("b");
  });

  it("picks the earliest open session on or after today", () => {
    const focus = selectFocusSession(
      [
        session({ id: "past", scheduled_date: "2026-08-01" }),
        session({ id: "tomorrow", scheduled_date: "2026-08-03", name: "B" }),
        session({ id: "today", scheduled_date: "2026-08-02", name: "A" }),
        session({ id: "done", scheduled_date: "2026-08-02", status: "finished" }),
      ],
      "2026-08-02",
    );
    expect(focus?.id).toBe("today");
  });

  it("returns null when no open sessions remain", () => {
    expect(
      selectFocusSession([session({ id: "done", scheduled_date: "2026-08-02", status: "finished" })], "2026-08-02"),
    ).toBeNull();
  });
});

describe("selectUpcomingSessions", () => {
  it("excludes the focus session and finished sessions", () => {
    const upcoming = selectUpcomingSessions(
      [
        session({ id: "focus", scheduled_date: "2026-08-02" }),
        session({ id: "next", scheduled_date: "2026-08-03" }),
        session({ id: "done", scheduled_date: "2026-08-04", status: "finished" }),
        session({ id: "later", scheduled_date: "2026-08-05" }),
      ],
      "2026-08-02",
      "focus",
      2,
    );
    expect(upcoming.map((item) => item.id)).toEqual(["next", "later"]);
  });
});

describe("isSessionInProgress", () => {
  it("is true only for not_started with started_at", () => {
    expect(isSessionInProgress({ status: "not_started", started_at: "x" })).toBe(true);
    expect(isSessionInProgress({ status: "not_started", started_at: null })).toBe(false);
    expect(isSessionInProgress({ status: "finished", started_at: "x" })).toBe(false);
  });
});
