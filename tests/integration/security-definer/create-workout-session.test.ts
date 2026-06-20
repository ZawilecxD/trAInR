import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getAdmin } from "../helpers/admin.js";
import { createClient_, createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";

const sampleExercises = (exerciseId: string) => [
  {
    exercise_id: exerciseId,
    phase: "main",
    sort_order: 0,
    notes: "Integration test",
    sets: [
      {
        prescribed_reps: 10,
        prescribed_duration_seconds: null,
        prescribed_load_kg: 50,
        rest_after_seconds: 90,
        is_warmup: true,
      },
      {
        prescribed_reps: 8,
        prescribed_duration_seconds: null,
        prescribed_load_kg: 55,
        rest_after_seconds: 120,
        is_warmup: false,
      },
    ],
  },
];

describe("create_workout_session", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let clientA: TestUser;
  let exerciseAId: string;
  let templateAId: string;
  let sessionId: string | undefined;

  beforeAll(async () => {
    trainerA = await createTrainer();
    trainerB = await createTrainer();
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

    exerciseAId = exercise.id;

    const { data: template, error: templateError } = await trainerA.client
      .from("session_templates")
      .insert({
        trainer_id: trainerA.id,
        name: "Trainer A Template",
      })
      .select("id")
      .single<{ id: string }>();

    if (templateError) {
      throw new Error(`Failed to seed session template: ${templateError.message}`);
    }

    templateAId = template.id;

    const { data: templateExercise, error: templateExerciseError } = await trainerA.client
      .from("template_exercises")
      .insert({
        template_id: templateAId,
        exercise_id: exerciseAId,
        phase: "main",
        sort_order: 0,
      })
      .select("id")
      .single<{ id: string }>();

    if (templateExerciseError) {
      throw new Error(`Failed to seed template exercise: ${templateExerciseError.message}`);
    }

    const { error: templateSetError } = await trainerA.client.from("template_exercise_sets").insert({
      template_exercise_id: templateExercise.id,
      set_number: 1,
      prescribed_reps: 10,
      prescribed_load_kg: 40,
    });

    if (templateSetError) {
      throw new Error(`Failed to seed template exercise set: ${templateSetError.message}`);
    }
  });

  afterAll(async () => {
    const admin = getAdmin();

    if (sessionId) {
      await admin.from("workout_sessions").delete().eq("id", sessionId);
    }

    await admin.from("client_plans").delete().eq("client_id", clientA.id);
    await trainerA.client.from("session_templates").delete().eq("id", templateAId);
    await trainerA.client.from("exercises").delete().eq("id", exerciseAId);

    await deleteUser(clientA.id);
    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
  });

  describe("create authorization and snapshot", () => {
    it("Trainer A creates session via RPC and populates all three tables", async () => {
      const createResponse = await trainerA.client.rpc("create_workout_session", {
        p_client_id: clientA.id,
        p_scheduled_date: "2026-06-15",
        p_name: "RPC integration session",
        p_source_template_id: templateAId,
        p_exercises: sampleExercises(exerciseAId),
      });

      expect(createResponse.error).toBeNull();
      expect(createResponse.data).toBeTruthy();
      sessionId = createResponse.data as string;

      const { data: session, error: sessionError } = await getAdmin()
        .from("workout_sessions")
        .select("id, name, status, started_at, source_template_id")
        .eq("id", sessionId)
        .single();

      expect(sessionError).toBeNull();
      expect(session).toMatchObject({
        id: sessionId,
        name: "RPC integration session",
        status: "not_started",
        started_at: null,
        source_template_id: templateAId,
      });

      const { count: exerciseCount, error: exerciseCountError } = await getAdmin()
        .from("session_exercises")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId);

      expect(exerciseCountError).toBeNull();
      expect(exerciseCount).toBe(1);

      const { data: sessionExercise, error: sessionExerciseError } = await getAdmin()
        .from("session_exercises")
        .select("id")
        .eq("session_id", sessionId)
        .single<{ id: string }>();

      expect(sessionExerciseError).toBeNull();

      if (!sessionExercise) {
        throw new Error("Expected session exercise row after create");
      }

      const { count: setCount, error: setCountError } = await getAdmin()
        .from("session_exercise_sets")
        .select("id", { count: "exact", head: true })
        .eq("session_exercise_id", sessionExercise.id);

      expect(setCountError).toBeNull();
      expect(setCount).toBe(2);

      const { data: sessionSets, error: sessionSetsError } = await getAdmin()
        .from("session_exercise_sets")
        .select("set_number, is_warmup")
        .eq("session_exercise_id", sessionExercise.id)
        .order("set_number");

      expect(sessionSetsError).toBeNull();
      expect(sessionSets).toEqual([
        { set_number: 1, is_warmup: true },
        { set_number: 2, is_warmup: false },
      ]);
    });

    it("Trainer B cannot create session for Trainer A client", async () => {
      const createResponse = await trainerB.client.rpc("create_workout_session", {
        p_client_id: clientA.id,
        p_scheduled_date: "2026-06-16",
        p_name: "Cross-trainer session",
        p_source_template_id: null,
        p_exercises: sampleExercises(exerciseAId),
      });

      expect(createResponse.error).not.toBeNull();
      expect(createResponse.data).toBeNull();
      expect(createResponse.error?.message).toMatch(/trainer is not assigned to this client/i);
    });
  });

  describe("update_workout_session_snapshot", () => {
    it("Trainer A can update not_started session snapshot", async () => {
      const { error } = await trainerA.client.rpc("update_workout_session_snapshot", {
        p_session_id: sessionId,
        p_scheduled_date: "2026-06-17",
        p_name: "Updated RPC session",
        p_exercises: sampleExercises(exerciseAId),
      });

      expect(error).toBeNull();

      const { data, error: selectError } = await getAdmin()
        .from("workout_sessions")
        .select("name, scheduled_date")
        .eq("id", sessionId)
        .single();

      expect(selectError).toBeNull();
      expect(data).toMatchObject({
        name: "Updated RPC session",
        scheduled_date: "2026-06-17",
      });
    });

    it("Update fails after started_at is set", async () => {
      const { error: startedError } = await getAdmin()
        .from("workout_sessions")
        .update({ started_at: new Date().toISOString() })
        .eq("id", sessionId);

      expect(startedError).toBeNull();

      const { error } = await trainerA.client.rpc("update_workout_session_snapshot", {
        p_session_id: sessionId,
        p_scheduled_date: "2026-06-18",
        p_name: "Should not apply",
        p_exercises: sampleExercises(exerciseAId),
      });

      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/session cannot be edited after client has started/i);

      const { data, error: selectError } = await getAdmin()
        .from("workout_sessions")
        .select("name")
        .eq("id", sessionId)
        .single();

      expect(selectError).toBeNull();
      expect(data?.name).toBe("Updated RPC session");
    });
  });
});
