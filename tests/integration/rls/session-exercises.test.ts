import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClient_, createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";
import { seedSessionExerciseWithSets } from "../helpers/session-graph.js";

describe("session_exercises", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let clientA: TestUser;
  let exerciseAId: string;
  let exerciseBId: string;
  let sessionAId: string;
  let sessionExerciseAId: string;

  beforeAll(async () => {
    trainerA = await createTrainer();
    trainerB = await createTrainer();
    clientA = await createClient_(trainerA);

    const { data: exerciseA, error: exerciseAError } = await trainerA.client
      .from("exercises")
      .insert({
        trainer_id: trainerA.id,
        name: "Trainer A Exercise",
        exercise_type: "strength",
        default_metric: "reps_weight",
      })
      .select("id")
      .single<{ id: string }>();

    if (exerciseAError) {
      throw new Error(`Failed to seed Trainer A exercise: ${exerciseAError.message}`);
    }

    exerciseAId = exerciseA.id;

    const { data: exerciseB, error: exerciseBError } = await trainerB.client
      .from("exercises")
      .insert({
        trainer_id: trainerB.id,
        name: "Trainer B Exercise",
        exercise_type: "strength",
        default_metric: "reps_weight",
      })
      .select("id")
      .single<{ id: string }>();

    if (exerciseBError) {
      throw new Error(`Failed to seed Trainer B exercise: ${exerciseBError.message}`);
    }

    exerciseBId = exerciseB.id;

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

    sessionAId = session.id;

    const seeded = await seedSessionExerciseWithSets(trainerA.client, {
      sessionId: sessionAId,
      exerciseId: exerciseAId,
    });

    sessionExerciseAId = seeded.sessionExerciseId;
  });

  afterAll(async () => {
    await deleteUser(clientA.id);
    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
  });

  describe("SELECT", () => {
    it("Trainer A sees own session exercise", async () => {
      const { data, error } = await trainerA.client.from("session_exercises").select("id").eq("id", sessionExerciseAId);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: sessionExerciseAId }]);
    });

    it("Trainer B cannot SELECT Trainer A session exercise", async () => {
      const { data, error } = await trainerB.client.from("session_exercises").select("id").eq("id", sessionExerciseAId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("INSERT", () => {
    it("Trainer B cannot INSERT session exercise using Trainer B exercise on Trainer A session", async () => {
      const { data, error } = await trainerB.client
        .from("session_exercises")
        .insert({
          session_id: sessionAId,
          exercise_id: exerciseBId,
          phase: "main",
          sort_order: 2,
        })
        .select("id");

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe("UPDATE", () => {
    it("Trainer B cannot UPDATE Trainer A session exercise", async () => {
      const { data, error } = await trainerB.client
        .from("session_exercises")
        .update({ sort_order: 99 })
        .eq("id", sessionExerciseAId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("DELETE", () => {
    it("Trainer B cannot DELETE Trainer A session exercise", async () => {
      const { data, error } = await trainerB.client
        .from("session_exercises")
        .delete()
        .eq("id", sessionExerciseAId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });
});
