import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClient_, createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";

describe("client_plans", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let clientA: TestUser;
  let planAId: string;
  let assignmentAId: string;

  beforeAll(async () => {
    trainerA = await createTrainer();
    trainerB = await createTrainer();
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
  });

  afterAll(async () => {
    await deleteUser(clientA.id);
    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
  });

  describe("SELECT", () => {
    it("Trainer A sees own client plan while assignment is active", async () => {
      const { data, error } = await trainerA.client.from("client_plans").select("id").eq("id", planAId);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: planAId }]);
    });

    it("Trainer B cannot SELECT Trainer A client plan", async () => {
      const { data, error } = await trainerB.client.from("client_plans").select("id").eq("id", planAId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("UPDATE", () => {
    it("Trainer B cannot UPDATE Trainer A client plan", async () => {
      const { data, error } = await trainerB.client
        .from("client_plans")
        .update({ name: "Hacked by B" })
        .eq("id", planAId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("DELETE", () => {
    it("Trainer B cannot DELETE Trainer A client plan", async () => {
      const { data, error } = await trainerB.client.from("client_plans").delete().eq("id", planAId).select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("post-removal", () => {
    it("Trainer A loses SELECT access after remove_trainer_client", async () => {
      const { error: removeError } = await trainerA.client.rpc("remove_trainer_client", {
        p_assignment_id: assignmentAId,
      });

      expect(removeError).toBeNull();

      const { data, error } = await trainerA.client.from("client_plans").select("id").eq("id", planAId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });
});
