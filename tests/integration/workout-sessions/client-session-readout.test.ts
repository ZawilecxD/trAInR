import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { deriveSessionReadout } from "../../../src/lib/trainer-dashboard/readout.js";
import { toExerciseReadoutInputs } from "../../../src/lib/trainer-dashboard/to-exercise-readout-input.js";
import { getMySessionDetail } from "../../../src/lib/workout-sessions/service.js";
import { createClient_, createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";
import { seedSessionExerciseWithSets } from "../helpers/session-graph.js";

describe("client session readout", () => {
  let trainerA: TestUser;
  let clientA: TestUser;
  let sessionId: string;
  let sessionExerciseId: string;

  beforeAll(async () => {
    trainerA = await createTrainer();
    clientA = await createClient_(trainerA);

    const { data: exercise, error: exerciseError } = await trainerA.client
      .from("exercises")
      .insert({
        trainer_id: trainerA.id,
        name: "Summary Readout Exercise",
        exercise_type: "strength",
        default_metric: "reps_weight",
      })
      .select("id")
      .single<{ id: string }>();

    if (exerciseError) {
      throw new Error(`Failed to seed exercise: ${exerciseError.message}`);
    }

    const { data: plan, error: planError } = await trainerA.client
      .from("client_plans")
      .insert({
        trainer_id: trainerA.id,
        client_id: clientA.id,
        name: "Summary Readout Plan",
      })
      .select("id")
      .single<{ id: string }>();

    if (planError) {
      throw new Error(`Failed to seed client plan: ${planError.message}`);
    }

    const { data: session, error: sessionError } = await trainerA.client
      .from("workout_sessions")
      .insert({
        client_plan_id: plan.id,
        scheduled_date: "2026-06-14",
        name: "Summary Readout Session",
        status: "not_started",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single<{ id: string }>();

    if (sessionError) {
      throw new Error(`Failed to seed workout session: ${sessionError.message}`);
    }

    sessionId = session.id;

    const seeded = await seedSessionExerciseWithSets(trainerA.client, {
      sessionId: session.id,
      exerciseId: exercise.id,
      sets: [{ set_number: 1, prescribed_reps: 8, prescribed_load_kg: 40 }],
    });

    sessionExerciseId = seeded.sessionExerciseId;

    const { error: logError } = await clientA.client.from("set_logs").insert({
      session_exercise_id: sessionExerciseId,
      set_number: 1,
      reps: 8,
      load_kg: 42.5,
      is_complete: true,
      is_warmup: false,
    });

    if (logError) {
      throw new Error(`Failed to seed set log: ${logError.message}`);
    }

    const completedAt = new Date().toISOString();
    const lockedAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: completeError } = await clientA.client
      .from("workout_sessions")
      .update({
        status: "finished",
        completed_at: completedAt,
        locked_at: lockedAt,
      })
      .eq("id", sessionId);

    if (completeError) {
      throw new Error(`Failed to mark session finished: ${completeError.message}`);
    }
  });

  afterAll(async () => {
    await deleteUser(clientA.id);
    await deleteUser(trainerA.id);
  });

  it("loads finished session exercises and derives a useful readout summary", async () => {
    const result = await getMySessionDetail(clientA.client, clientA.id, sessionId);

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data?.status).toBe("finished");
    expect(result.data?.exercises).toHaveLength(1);
    expect(result.data?.exercises[0].exercise_name).toBe("Summary Readout Exercise");

    if (!result.data) {
      throw new Error("Expected session detail");
    }

    const readout = deriveSessionReadout(toExerciseReadoutInputs(result.data.exercises));
    expect(readout.completedSets).toBe(1);
    expect(readout.totalSets).toBe(1);
    expect(readout.exercises[0].sets[0].log?.load_kg).toBe(42.5);
  });
});
