import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClient_, createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";

describe("workout_sessions", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let clientA: TestUser;
  let planAId: string;
  let sessionAId: string;

  beforeAll(async () => {
    trainerA = await createTrainer();
    trainerB = await createTrainer();
    clientA = await createClient_(trainerA);

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
  });

  afterAll(async () => {
    await deleteUser(clientA.id);
    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
  });

  describe("SELECT", () => {
    it("Trainer A sees own client workout session", async () => {
      const { data, error } = await trainerA.client.from("workout_sessions").select("id").eq("id", sessionAId);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: sessionAId }]);
    });

    it("Trainer B cannot SELECT Trainer A client workout session", async () => {
      const { data, error } = await trainerB.client.from("workout_sessions").select("id").eq("id", sessionAId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("INSERT", () => {
    it("Trainer B cannot INSERT workout session on Trainer A client plan", async () => {
      const { data, error } = await trainerB.client
        .from("workout_sessions")
        .insert({
          client_plan_id: planAId,
          scheduled_date: "2026-06-08",
          name: "Hacked session",
        })
        .select("id");

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe("UPDATE", () => {
    it("Trainer B cannot UPDATE Trainer A client workout session", async () => {
      const { data, error } = await trainerB.client
        .from("workout_sessions")
        .update({ name: "Hacked by B" })
        .eq("id", sessionAId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("Client can UPDATE own workout session status", async () => {
      const { data, error } = await clientA.client
        .from("workout_sessions")
        .update({ status: "finished" })
        .eq("id", sessionAId)
        .select("id, status");

      expect(error).toBeNull();
      expect(data).toEqual([{ id: sessionAId, status: "finished" }]);
    });
  });

  describe("DELETE", () => {
    it("Trainer B cannot DELETE Trainer A client workout session", async () => {
      const { data, error } = await trainerB.client.from("workout_sessions").delete().eq("id", sessionAId).select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("Client cannot DELETE own workout session", async () => {
      const { data, error } = await clientA.client.from("workout_sessions").delete().eq("id", sessionAId).select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });
});
