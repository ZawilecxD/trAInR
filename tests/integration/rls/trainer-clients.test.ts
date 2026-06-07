import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClient_, createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";

describe("trainer_clients", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let clientA: TestUser;
  let clientB: TestUser;
  let assignmentAId: string;

  beforeAll(async () => {
    trainerA = await createTrainer();
    trainerB = await createTrainer();
    clientA = await createClient_(trainerA);
    clientB = await createClient_(trainerB);

    const loadAssignmentId = async (trainer: TestUser, client: TestUser) => {
      const { data, error } = await trainer.client
        .from("trainer_clients")
        .select("id")
        .eq("client_id", client.id)
        .single<{ id: string }>();

      if (error) {
        throw new Error(`Failed to load assignment for ${client.email}: ${error.message}`);
      }

      return data.id;
    };

    assignmentAId = await loadAssignmentId(trainerA, clientA);
    await loadAssignmentId(trainerB, clientB);
  });

  afterAll(async () => {
    await deleteUser(clientA.id);
    await deleteUser(clientB.id);
    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
  });

  describe("SELECT", () => {
    it("Trainer A sees own active assignment", async () => {
      const { data, error } = await trainerA.client.from("trainer_clients").select("id").eq("id", assignmentAId);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: assignmentAId }]);
    });

    it("Trainer B cannot SELECT Trainer A assignments", async () => {
      const { data, error } = await trainerB.client.from("trainer_clients").select("id").eq("trainer_id", trainerA.id);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("Client A can SELECT own assignment row", async () => {
      const { data, error } = await clientA.client.from("trainer_clients").select("id").eq("client_id", clientA.id);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: assignmentAId }]);
    });

    it("Client A cannot SELECT Client B assignment row", async () => {
      const { data, error } = await clientA.client.from("trainer_clients").select("id").eq("client_id", clientB.id);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("UPDATE", () => {
    it("Trainer B cannot UPDATE Trainer A assignment", async () => {
      const { data, error } = await trainerB.client
        .from("trainer_clients")
        .update({ status: "removed" })
        .eq("id", assignmentAId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });
});
