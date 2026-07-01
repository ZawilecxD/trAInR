import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClient_, createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";
import { seedSessionExerciseWithSets } from "../helpers/session-graph.js";

describe("set_logs", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let clientA: TestUser;
  let sessionExerciseAId: string;
  let setLogId: string;

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
  });

  afterAll(async () => {
    await deleteUser(clientA.id);
    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
  });

  describe("INSERT", () => {
    it("Client can INSERT set log on own session exercise", async () => {
      const { data, error } = await clientA.client
        .from("set_logs")
        .insert({
          session_exercise_id: sessionExerciseAId,
          set_number: 1,
          reps: 10,
          load_kg: 50,
        })
        .select("id")
        .single<{ id: string }>();

      expect(error).toBeNull();
      if (!data?.id) {
        throw new Error("Expected set log id after insert");
      }
      setLogId = data.id;
    });

    it("Trainer B cannot INSERT set log on Trainer A session exercise", async () => {
      const { data, error } = await trainerB.client
        .from("set_logs")
        .insert({
          session_exercise_id: sessionExerciseAId,
          set_number: 2,
          reps: 8,
        })
        .select("id");

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it("Trainer A cannot INSERT set log on client session exercise", async () => {
      const { data, error } = await trainerA.client
        .from("set_logs")
        .insert({
          session_exercise_id: sessionExerciseAId,
          set_number: 3,
          reps: 12,
        })
        .select("id");

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe("SELECT", () => {
    it("Trainer A can SELECT client set logs", async () => {
      const { data, error } = await trainerA.client.from("set_logs").select("id").eq("id", setLogId);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: setLogId }]);
    });

    it("Trainer B cannot SELECT Trainer A client set logs", async () => {
      const { data, error } = await trainerB.client.from("set_logs").select("id").eq("id", setLogId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("UPDATE", () => {
    it("Client can UPSERT fill-like values on own session exercise without is_complete", async () => {
      const first = await clientA.client
        .from("set_logs")
        .upsert(
          {
            session_exercise_id: sessionExerciseAId,
            set_number: 5,
            reps: 8,
            load_kg: 60,
            is_complete: false,
            is_warmup: false,
          },
          { onConflict: "session_exercise_id,set_number" },
        )
        .select("id, reps, load_kg, is_complete")
        .single<{ id: string; reps: number; load_kg: number; is_complete: boolean }>();

      expect(first.error).toBeNull();
      expect(first.data).toMatchObject({ reps: 8, load_kg: 60, is_complete: false });

      const second = await clientA.client
        .from("set_logs")
        .upsert(
          {
            session_exercise_id: sessionExerciseAId,
            set_number: 5,
            reps: 9,
            load_kg: 62.5,
            is_complete: false,
            is_warmup: false,
          },
          { onConflict: "session_exercise_id,set_number" },
        )
        .select("id, reps, load_kg, is_complete")
        .single<{ id: string; reps: number; load_kg: number; is_complete: boolean }>();

      expect(second.error).toBeNull();
      expect(second.data).toMatchObject({ id: first.data?.id, reps: 9, load_kg: 62.5, is_complete: false });
    });

    it("Client can UPDATE own set log", async () => {
      const { data, error } = await clientA.client
        .from("set_logs")
        .update({ reps: 11 })
        .eq("id", setLogId)
        .select("id, reps");

      expect(error).toBeNull();
      expect(data).toEqual([{ id: setLogId, reps: 11 }]);
    });

    it("Trainer A cannot UPDATE client set log", async () => {
      const { data, error } = await trainerA.client
        .from("set_logs")
        .update({ reps: 99 })
        .eq("id", setLogId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("DELETE", () => {
    it("Client can DELETE own set log on assigned session", async () => {
      const { data, error } = await clientA.client.from("set_logs").delete().eq("id", setLogId).select("id");

      expect(error).toBeNull();
      expect(data).toEqual([{ id: setLogId }]);

      const { data: stillThere, error: selectError } = await clientA.client
        .from("set_logs")
        .select("id")
        .eq("id", setLogId);

      expect(selectError).toBeNull();
      expect(stillThere).toEqual([]);
    });

    it("Trainer A cannot DELETE client set log", async () => {
      const { data: inserted, error: insertError } = await clientA.client
        .from("set_logs")
        .insert({
          session_exercise_id: sessionExerciseAId,
          set_number: 4,
          reps: 10,
        })
        .select("id")
        .single<{ id: string }>();

      expect(insertError).toBeNull();
      if (!inserted?.id) {
        throw new Error("Expected set log id after insert");
      }

      const { data, error } = await trainerA.client.from("set_logs").delete().eq("id", inserted.id).select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });
});
