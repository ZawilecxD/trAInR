import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClient_, createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";
import { seedSessionExerciseWithSets } from "../helpers/session-graph.js";

describe("set_logs sealed session", () => {
  let trainerA: TestUser;
  let clientA: TestUser;
  let sessionId: string;
  let sessionExerciseAId: string;
  let setLogId: string;

  beforeAll(async () => {
    trainerA = await createTrainer();
    clientA = await createClient_(trainerA);

    const { data: exercise, error: exerciseError } = await trainerA.client
      .from("exercises")
      .insert({
        trainer_id: trainerA.id,
        name: "Seal Test Exercise",
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
        name: "Seal Test Plan",
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
        scheduled_date: "2026-06-07",
        name: "Seal Test Session",
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
    });

    sessionExerciseAId = seeded.sessionExerciseId;

    const { data: log, error: logError } = await clientA.client
      .from("set_logs")
      .insert({
        session_exercise_id: sessionExerciseAId,
        set_number: 1,
        reps: 10,
        load_kg: 50,
        is_complete: true,
        is_warmup: false,
      })
      .select("id")
      .single<{ id: string }>();

    if (logError) {
      throw new Error(`Failed to seed set log: ${logError.message}`);
    }

    setLogId = log.id;

    const { error: sealError } = await trainerA.client
      .from("workout_sessions")
      .update({ locked_at: "2020-01-01T00:00:00.000Z" })
      .eq("id", sessionId);

    if (sealError) {
      throw new Error(`Failed to seal session: ${sealError.message}`);
    }
  });

  afterAll(async () => {
    await deleteUser(clientA.id);
    await deleteUser(trainerA.id);
  });

  it("Client cannot UPDATE set log when session is sealed", async () => {
    const { error } = await clientA.client.from("set_logs").update({ reps: 12 }).eq("id", setLogId);

    expect(error).not.toBeNull();
  });

  it("Client cannot DELETE set log when session is sealed", async () => {
    const { error } = await clientA.client.from("set_logs").delete().eq("id", setLogId);

    expect(error).not.toBeNull();
  });

  it("Client cannot INSERT set log when session is sealed", async () => {
    const { error } = await clientA.client.from("set_logs").insert({
      session_exercise_id: sessionExerciseAId,
      set_number: 2,
      reps: 8,
      load_kg: 55,
      is_complete: true,
      is_warmup: false,
    });

    expect(error).not.toBeNull();
  });

  it("is_workout_session_sealed returns true for past locked_at", async () => {
    const result = await clientA.client.rpc<boolean>("is_workout_session_sealed", {
      p_session_id: sessionId,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBe(true);
  });
});
