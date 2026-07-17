import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClient_, createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";
import { seedSessionExerciseWithSets } from "../helpers/session-graph.js";

describe("set_logs rpe", () => {
  let trainerA: TestUser;
  let clientA: TestUser;
  let sessionExerciseAId: string;
  let setLogId: string;

  beforeAll(async () => {
    trainerA = await createTrainer();
    clientA = await createClient_(trainerA);

    const { data: exercise, error: exerciseError } = await trainerA.client
      .from("exercises")
      .insert({
        trainer_id: trainerA.id,
        name: "Trainer A Exercise",
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
        name: "Trainer A Client Plan",
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
        scheduled_date: "2026-07-02",
        name: "RPE Integration Session",
      })
      .select("id")
      .single<{ id: string }>();

    if (sessionError) {
      throw new Error(`Failed to seed workout session: ${sessionError.message}`);
    }

    const seeded = await seedSessionExerciseWithSets(trainerA.client, {
      sessionId: session.id,
      exerciseId: exercise.id,
    });

    sessionExerciseAId = seeded.sessionExerciseId;
  });

  afterAll(async () => {
    await deleteUser(clientA.id);
    await deleteUser(trainerA.id);
  });

  it("Client can INSERT set log with nullable rpe", async () => {
    const { data, error } = await clientA.client
      .from("set_logs")
      .insert({
        session_exercise_id: sessionExerciseAId,
        set_number: 1,
        reps: 10,
        load_kg: 50,
        rpe: null,
        is_complete: false,
        is_warmup: false,
      })
      .select("id, rpe")
      .single<{ id: string; rpe: number | null }>();

    expect(error).toBeNull();
    if (!data?.id) {
      throw new Error("Expected set log id after insert");
    }
    expect(data.rpe).toBeNull();
    setLogId = data.id;
  });

  it("Client can UPDATE rpe to 1–10", async () => {
    const { data, error } = await clientA.client
      .from("set_logs")
      .update({ rpe: 8 })
      .eq("id", setLogId)
      .select("id, rpe");

    expect(error).toBeNull();
    expect(data).toEqual([{ id: setLogId, rpe: 8 }]);
  });

  it("Client can clear rpe back to null", async () => {
    const { data, error } = await clientA.client
      .from("set_logs")
      .update({ rpe: null })
      .eq("id", setLogId)
      .select("id, rpe");

    expect(error).toBeNull();
    expect(data).toEqual([{ id: setLogId, rpe: null }]);
  });

  it("Trainer can SELECT client set log rpe", async () => {
    await clientA.client.from("set_logs").update({ rpe: 7 }).eq("id", setLogId);

    const { data, error } = await trainerA.client.from("set_logs").select("id, rpe").eq("id", setLogId);

    expect(error).toBeNull();
    expect(data).toEqual([{ id: setLogId, rpe: 7 }]);
  });
});
