import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";

describe("session_templates", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let templateAId: string;
  let templateBId: string;

  beforeAll(async () => {
    trainerA = await createTrainer();
    trainerB = await createTrainer();

    const seedTemplate = async (trainer: TestUser, name: string) => {
      const { data, error } = await trainer.client
        .from("session_templates")
        .insert({
          trainer_id: trainer.id,
          name,
        })
        .select("id")
        .single<{ id: string }>();

      if (error) {
        throw new Error(`Failed to seed session template ${name}: ${error.message}`);
      }

      return data.id;
    };

    templateAId = await seedTemplate(trainerA, "Trainer A Template");
    templateBId = await seedTemplate(trainerB, "Trainer B Template");
  });

  afterAll(async () => {
    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
  });

  describe("SELECT", () => {
    it("Trainer A sees own session template", async () => {
      const { data, error } = await trainerA.client.from("session_templates").select("id").eq("id", templateAId);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: templateAId }]);
    });

    it("Trainer B sees own session template", async () => {
      const { data, error } = await trainerB.client.from("session_templates").select("id").eq("id", templateBId);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: templateBId }]);
    });

    it("Trainer B cannot SELECT Trainer A session template", async () => {
      const { data, error } = await trainerB.client.from("session_templates").select("id").eq("id", templateAId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("Trainer A cannot SELECT Trainer B session template", async () => {
      const { data, error } = await trainerA.client.from("session_templates").select("id").eq("id", templateBId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("INSERT", () => {
    it("Trainer B cannot INSERT a session template with Trainer A trainer_id", async () => {
      const { data, error } = await trainerB.client
        .from("session_templates")
        .insert({
          trainer_id: trainerA.id,
          name: "Cross-tenant template",
        })
        .select("id");

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe("UPDATE", () => {
    it("Trainer B cannot UPDATE Trainer A session template", async () => {
      const { data, error } = await trainerB.client
        .from("session_templates")
        .update({ name: "Hacked by B" })
        .eq("id", templateAId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("Trainer A cannot UPDATE Trainer B session template", async () => {
      const { data, error } = await trainerA.client
        .from("session_templates")
        .update({ name: "Hacked by A" })
        .eq("id", templateBId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("DELETE", () => {
    it("Trainer B cannot DELETE Trainer A session template", async () => {
      const { data, error } = await trainerB.client
        .from("session_templates")
        .delete()
        .eq("id", templateAId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("Trainer A cannot DELETE Trainer B session template", async () => {
      const { data, error } = await trainerA.client
        .from("session_templates")
        .delete()
        .eq("id", templateBId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });
});
