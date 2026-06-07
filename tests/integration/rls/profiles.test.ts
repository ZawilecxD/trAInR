import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClient_, createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";

describe("profiles", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let clientA: TestUser;
  let clientB: TestUser;

  beforeAll(async () => {
    trainerA = await createTrainer();
    trainerB = await createTrainer();
    clientA = await createClient_(trainerA);
    clientB = await createClient_(trainerB);
  });

  afterAll(async () => {
    await deleteUser(clientA.id);
    await deleteUser(clientB.id);
    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
  });

  describe("SELECT", () => {
    it("Trainer A can SELECT own profile", async () => {
      const { data, error } = await trainerA.client.from("profiles").select("id").eq("id", trainerA.id);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: trainerA.id }]);
    });

    it("Trainer A cannot SELECT Trainer B profile directly", async () => {
      const { data, error } = await trainerA.client.from("profiles").select("id").eq("id", trainerB.id);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("Trainer A can SELECT active client profile via assignment", async () => {
      const { data, error } = await trainerA.client.from("profiles").select("id").eq("id", clientA.id);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: clientA.id }]);
    });

    it("Trainer A cannot SELECT Trainer B client profile", async () => {
      const { data, error } = await trainerA.client.from("profiles").select("id").eq("id", clientB.id);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });
});
