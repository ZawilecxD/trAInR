import { describe, expect, it } from "vitest";
import { formatSessionOverviewDate } from "@/lib/guided-workout/format-session-date";
import { resolveInitialMode } from "@/lib/guided-workout/session-mode";
import type { ClientSessionDetail } from "@/lib/workout-sessions/service";

const baseSession: ClientSessionDetail = {
  id: "a1000001-0000-4000-8000-000000000001",
  client_plan_id: "b1000001-0000-4000-8000-000000000001",
  source_template_id: null,
  scheduled_date: "2026-06-14",
  name: "Workout",
  status: "not_started",
  started_at: null,
  completed_at: null,
  locked_at: null,
  created_at: "2026-06-14T00:00:00.000Z",
  trainer_display_name: "Trainer A",
  exercises: [
    {
      id: "c1000001-0000-4000-8000-000000000001",
      session_id: "a1000001-0000-4000-8000-000000000001",
      exercise_id: "d1000001-0000-4000-8000-000000000001",
      phase: "main",
      sort_order: 0,
      notes: null,
      sets: [],
      exercise_name: "Bench Press",
      exercise_default_metric: "reps_weight",
      logs: [],
    },
  ],
};

describe("formatSessionOverviewDate", () => {
  it("formats scheduled date for overview meta", () => {
    expect(formatSessionOverviewDate("2026-06-14")).toMatch(/Jun 14, 2026/);
  });
});

describe("resolveInitialMode", () => {
  it("returns overview when session has not started", () => {
    expect(resolveInitialMode(baseSession)).toBe("overview");
  });

  it("returns guided when started with no logs", () => {
    expect(resolveInitialMode({ ...baseSession, started_at: "2026-06-14T12:00:00.000Z" })).toBe("guided");
  });

  it("returns edit-list when started with logs", () => {
    expect(
      resolveInitialMode({
        ...baseSession,
        started_at: "2026-06-14T12:00:00.000Z",
        exercises: [
          {
            ...baseSession.exercises[0],
            logs: [
              {
                id: "e1000001-0000-4000-8000-000000000001",
                session_exercise_id: "c1000001-0000-4000-8000-000000000001",
                set_number: 1,
                is_warmup: false,
                is_complete: true,
                reps: 10,
                duration_seconds: null,
                load_kg: 60,
                logged_at: "2026-06-14T12:05:00.000Z",
              },
            ],
          },
        ],
      }),
    ).toBe("edit-list");
  });

  it("returns completed when finished within the edit window", () => {
    expect(
      resolveInitialMode({
        ...baseSession,
        status: "finished",
        started_at: "2026-06-14T12:00:00.000Z",
        completed_at: "2026-06-14T13:00:00.000Z",
        locked_at: "2099-06-15T13:00:00.000Z",
      }),
    ).toBe("completed");
  });

  it("returns completed when finished and edit window has passed", () => {
    expect(
      resolveInitialMode({
        ...baseSession,
        status: "finished",
        started_at: "2026-06-14T12:00:00.000Z",
        completed_at: "2026-06-14T13:00:00.000Z",
        locked_at: "2020-01-01T00:00:00.000Z",
      }),
    ).toBe("completed");
  });

  it("returns completed for cancelled sessions", () => {
    expect(
      resolveInitialMode({
        ...baseSession,
        status: "cancelled",
        started_at: "2026-06-14T12:00:00.000Z",
      }),
    ).toBe("completed");
  });

  it("returns edit-list when in progress with logs (no completion deadline yet)", () => {
    expect(
      resolveInitialMode({
        ...baseSession,
        started_at: "2026-06-14T12:00:00.000Z",
        locked_at: null,
        exercises: [
          {
            ...baseSession.exercises[0],
            logs: [
              {
                id: "e1000001-0000-4000-8000-000000000001",
                session_exercise_id: "c1000001-0000-4000-8000-000000000001",
                set_number: 1,
                is_warmup: false,
                is_complete: true,
                reps: 10,
                duration_seconds: null,
                load_kg: 60,
                logged_at: "2026-06-14T12:05:00.000Z",
              },
            ],
          },
        ],
      }),
    ).toBe("edit-list");
  });
});
