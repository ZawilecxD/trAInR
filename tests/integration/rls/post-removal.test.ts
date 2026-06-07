import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClient_, createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";

describe("post-removal session graph", () => {
  let trainerA: TestUser;
  let clientA: TestUser;
  let assignmentAId: string;
  let planAId: string;
  let sessionAId: string;
  let sessionExerciseAId: string;

  beforeAll(async () => {
    trainerA = await createTrainer();
    clientA = await createClient_(trainerA);

    const { data: assignment, error: assignmentError } = await trainerA.client
      .from("trainer_clients")
      .select("id")
      .eq("client_id", clientA.id)
      .single<{ id: string }>();

    if (assignmentError) {
      throw new Error(`Failed to load assignment: ${assignmentError.message}`);
    }

    assignmentAId = assignment.id;

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

    planAId = plan.id;

    const { data: session, error: sessionError } = await trainerA.client
      .from("workout_sessions")
      .insert({
        client_plan_id: planAId,
        scheduled_date: "2026-06-07",
        name: "Trainer A Session",
      })
      .select("id")
      .single<{ id: string }>();

    if (sessionError) {
      throw new Error(`Failed to seed workout session: ${sessionError.message}`);
    }

    sessionAId = session.id;

    const { data: sessionExercise, error: sessionExerciseError } = await trainerA.client
      .from("session_exercises")
      .insert({
        session_id: sessionAId,
        exercise_id: exercise.id,
        phase: "main",
        sort_order: 1,
        prescribed_sets: 3,
        prescribed_reps: 10,
      })
      .select("id")
      .single<{ id: string }>();

    if (sessionExerciseError) {
      throw new Error(`Failed to seed session exercise: ${sessionExerciseError.message}`);
    }

    sessionExerciseAId = sessionExercise.id;
  });

  afterAll(async () => {
    await deleteUser(clientA.id);
    await deleteUser(trainerA.id);
  });

  describe("before removal", () => {
    it("Trainer A can SELECT client plan, workout session, and session exercise", async () => {
      const { data: plans, error: plansError } = await trainerA.client
        .from("client_plans")
        .select("id")
        .eq("id", planAId);

      expect(plansError).toBeNull();
      expect(plans).toEqual([{ id: planAId }]);

      const { data: sessions, error: sessionsError } = await trainerA.client
        .from("workout_sessions")
        .select("id")
        .eq("id", sessionAId);

      expect(sessionsError).toBeNull();
      expect(sessions).toEqual([{ id: sessionAId }]);

      const { data: sessionExercises, error: sessionExercisesError } = await trainerA.client
        .from("session_exercises")
        .select("id")
        .eq("id", sessionExerciseAId);

      expect(sessionExercisesError).toBeNull();
      expect(sessionExercises).toEqual([{ id: sessionExerciseAId }]);
    });
  });

  describe("after remove_trainer_client", () => {
    it("Trainer A loses SELECT access to client plan, workout session, and session exercise", async () => {
      const { error: removeError } = await trainerA.client.rpc("remove_trainer_client", {
        p_assignment_id: assignmentAId,
      });

      expect(removeError).toBeNull();

      const { data: plans, error: plansError } = await trainerA.client
        .from("client_plans")
        .select("id")
        .eq("id", planAId);

      expect(plansError).toBeNull();
      expect(plans).toEqual([]);

      const { data: sessions, error: sessionsError } = await trainerA.client
        .from("workout_sessions")
        .select("id")
        .eq("id", sessionAId);

      expect(sessionsError).toBeNull();
      expect(sessions).toEqual([]);

      const { data: sessionExercises, error: sessionExercisesError } = await trainerA.client
        .from("session_exercises")
        .select("id")
        .eq("id", sessionExerciseAId);

      expect(sessionExercisesError).toBeNull();
      expect(sessionExercises).toEqual([]);
    });

    it("Client retains SELECT access to archived client plan history", async () => {
      const { data, error } = await clientA.client.from("client_plans").select("id, status").eq("id", planAId);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: planAId, status: "archived" }]);
    });
  });
});
