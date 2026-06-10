import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createBareClient, createClient_, createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";
import { seedSessionExerciseWithSets } from "../helpers/session-graph.js";

describe("session_exercise_sets", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let clientA: TestUser;
  let clientB: TestUser;
  let sessionExerciseAId: string;
  let sessionExerciseSetAId: string;

  beforeAll(async () => {
    trainerA = await createTrainer();
    trainerB = await createTrainer();
    clientA = await createClient_(trainerA);
    clientB = await createBareClient("client");

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
        scheduled_date: "2026-06-07",
        name: "Trainer A Session",
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

    const firstSetId = seeded.setIds[0];
    if (!firstSetId) {
      throw new Error("Expected at least one session exercise set");
    }

    sessionExerciseSetAId = firstSetId;
  });

  afterAll(async () => {
    await deleteUser(clientA.id);
    await deleteUser(clientB.id);
    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
  });

  describe("SELECT", () => {
    it("Trainer A sees own session exercise sets", async () => {
      const { data, error } = await trainerA.client
        .from("session_exercise_sets")
        .select("id")
        .eq("id", sessionExerciseSetAId);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: sessionExerciseSetAId }]);
    });

    it("Trainer B cannot SELECT Trainer A session exercise sets", async () => {
      const { data, error } = await trainerB.client
        .from("session_exercise_sets")
        .select("id")
        .eq("id", sessionExerciseSetAId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("Client sees own session exercise sets", async () => {
      const { data, error } = await clientA.client
        .from("session_exercise_sets")
        .select("id")
        .eq("id", sessionExerciseSetAId);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: sessionExerciseSetAId }]);
    });

    it("Other client cannot SELECT session exercise sets", async () => {
      const { data, error } = await clientB.client
        .from("session_exercise_sets")
        .select("id")
        .eq("id", sessionExerciseSetAId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("INSERT", () => {
    it("Trainer B cannot INSERT session exercise set on Trainer A session exercise", async () => {
      const { data, error } = await trainerB.client
        .from("session_exercise_sets")
        .insert({
          session_exercise_id: sessionExerciseAId,
          set_number: 99,
          prescribed_reps: 5,
        })
        .select("id");

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });
});
