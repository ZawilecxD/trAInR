import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getExerciseHistoryForClient, listLoggedExercisesForClient } from "../../../src/lib/exercise-stats/service.js";
import { createClient_, createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";
import { seedSessionExerciseWithSets } from "../helpers/session-graph.js";

/**
 * Seeds one exercise with two logged sessions (session 1 also has a warm-up set
 * that must be excluded from stats) and verifies per-session aggregation, Epley
 * 1RM, tonnage, warm-up exclusion, and cross-client RLS isolation (S-12).
 */
describe("exercise statistics service", () => {
  let trainerA: TestUser;
  let clientA: TestUser;
  let clientB: TestUser;
  let exerciseId: string;

  async function seedLoggedSession(
    planId: string,
    scheduledDate: string,
    logs: { set_number: number; reps: number; load_kg: number; is_warmup: boolean }[],
  ): Promise<void> {
    const { data: session, error: sessionError } = await trainerA.client
      .from("workout_sessions")
      .insert({
        client_plan_id: planId,
        scheduled_date: scheduledDate,
        name: `Session ${scheduledDate}`,
        status: "not_started",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single<{ id: string }>();

    if (sessionError) {
      throw new Error(`Failed to seed session: ${sessionError.message}`);
    }

    const seeded = await seedSessionExerciseWithSets(trainerA.client, {
      sessionId: session.id,
      exerciseId,
      sets: logs.map((log) => ({
        set_number: log.set_number,
        prescribed_reps: log.reps,
        prescribed_load_kg: log.load_kg,
        is_warmup: log.is_warmup,
      })),
    });

    const { error: logError } = await clientA.client.from("set_logs").insert(
      logs.map((log) => ({
        session_exercise_id: seeded.sessionExerciseId,
        set_number: log.set_number,
        reps: log.reps,
        load_kg: log.load_kg,
        is_warmup: log.is_warmup,
        is_complete: true,
      })),
    );

    if (logError) {
      throw new Error(`Failed to seed set logs: ${logError.message}`);
    }
  }

  beforeAll(async () => {
    trainerA = await createTrainer();
    clientA = await createClient_(trainerA);
    clientB = await createClient_(trainerA);

    const { data: exercise, error: exerciseError } = await trainerA.client
      .from("exercises")
      .insert({
        trainer_id: trainerA.id,
        name: "Back Squat",
        exercise_type: "strength",
        default_metric: "reps_weight",
      })
      .select("id")
      .single<{ id: string }>();

    if (exerciseError) {
      throw new Error(`Failed to seed exercise: ${exerciseError.message}`);
    }
    exerciseId = exercise.id;

    const { data: plan, error: planError } = await trainerA.client
      .from("client_plans")
      .insert({ trainer_id: trainerA.id, client_id: clientA.id, name: "Stats Plan" })
      .select("id")
      .single<{ id: string }>();

    if (planError) {
      throw new Error(`Failed to seed client plan: ${planError.message}`);
    }

    // Session 1: one warm-up set (excluded) + one working set (8 reps @ 40 kg).
    await seedLoggedSession(plan.id, "2026-07-10", [
      { set_number: 1, reps: 5, load_kg: 20, is_warmup: true },
      { set_number: 2, reps: 8, load_kg: 40, is_warmup: false },
    ]);

    // Session 2: one working set (6 reps @ 50 kg).
    await seedLoggedSession(plan.id, "2026-07-12", [{ set_number: 1, reps: 6, load_kg: 50, is_warmup: false }]);
  });

  afterAll(async () => {
    await deleteUser(clientA.id);
    await deleteUser(clientB.id);
    await deleteUser(trainerA.id);
  });

  it("lists the exercise with working-set counts (warm-up excluded)", async () => {
    const { data, error } = await listLoggedExercisesForClient(clientA.client, clientA.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].exerciseId).toBe(exerciseId);
    expect(data?.[0].name).toBe("Back Squat");
    expect(data?.[0].sessionCount).toBe(2);
    expect(data?.[0].loggedSetCount).toBe(2); // warm-up set is not counted
  });

  it("returns per-session history with Epley 1RM and tonnage, most recent first", async () => {
    const { data, error } = await getExerciseHistoryForClient(clientA.client, clientA.id, exerciseId);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.exercise.defaultMetric).toBe("reps_weight");
    expect(data?.sessions).toHaveLength(2);

    if (!data) {
      throw new Error("Expected exercise history");
    }

    const [recent, older] = data.sessions;
    expect(recent.scheduledDate).toBe("2026-07-12");
    expect(recent.workingSetCount).toBe(1);
    expect(recent.estimated1RM).toBe(60); // 50 * (1 + 6/30)
    expect(recent.totalVolumeKg).toBe(300); // 50 * 6

    expect(older.scheduledDate).toBe("2026-07-10");
    expect(older.workingSetCount).toBe(1); // warm-up excluded
    expect(older.estimated1RM).toBe(50.7); // 40 * (1 + 8/30) = 50.66..
    expect(older.totalVolumeKg).toBe(320); // 40 * 8

    expect(data.summary.allTimeBest1RM).toBe(60);
    expect(data.summary.bestSessionVolumeKg).toBe(320);
    expect(data.summary.sessionCount).toBe(2);
    expect(data.summary.totalWorkingSets).toBe(2);
  });

  it("does not leak another client's history", async () => {
    const list = await listLoggedExercisesForClient(clientB.client, clientB.id);
    expect(list.error).toBeNull();
    expect(list.data).toEqual([]);

    const history = await getExerciseHistoryForClient(clientB.client, clientB.id, exerciseId);
    expect(history.error).toBeNull();
    expect(history.data).toBeNull();
  });
});
