import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";

describe("exercises", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let exerciseA1Id: string;
  let exerciseA2Id: string;
  let exerciseB1Id: string;

  beforeAll(async () => {
    trainerA = await createTrainer();
    trainerB = await createTrainer();

    const seedExercise = async (trainer: TestUser, name: string) => {
      const { data, error } = await trainer.client
        .from("exercises")
        .insert({
          trainer_id: trainer.id,
          name,
          exercise_type: "strength",
          default_metric: "reps_weight",
        })
        .select("id")
        .single<{ id: string }>();

      if (error) {
        throw new Error(`Failed to seed exercise ${name}: ${error.message}`);
      }

      return data.id;
    };

    exerciseA1Id = await seedExercise(trainerA, "Trainer A Exercise 1");
    exerciseA2Id = await seedExercise(trainerA, "Trainer A Exercise 2");
    exerciseB1Id = await seedExercise(trainerB, "Trainer B Exercise 1");
  });

  afterAll(async () => {
    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
  });

  describe("SELECT", () => {
    it("Trainer A sees own exercises", async () => {
      const { data, error } = await trainerA.client
        .from("exercises")
        .select("id")
        .in("id", [exerciseA1Id, exerciseA2Id]);

      expect(error).toBeNull();
      expect(data?.map((row: { id: string }) => row.id).sort()).toEqual([exerciseA1Id, exerciseA2Id].sort());
    });

    it("Trainer B sees own exercises", async () => {
      const { data, error } = await trainerB.client.from("exercises").select("id").eq("id", exerciseB1Id);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: exerciseB1Id }]);
    });

    it("Trainer B cannot SELECT Trainer A exercises", async () => {
      const { data, error } = await trainerB.client
        .from("exercises")
        .select("id")
        .in("id", [exerciseA1Id, exerciseA2Id]);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("Trainer A cannot SELECT Trainer B exercises", async () => {
      const { data, error } = await trainerA.client.from("exercises").select("id").eq("id", exerciseB1Id);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("INSERT", () => {
    it("Trainer B cannot INSERT an exercise with Trainer A trainer_id", async () => {
      const { data, error } = await trainerB.client
        .from("exercises")
        .insert({
          trainer_id: trainerA.id,
          name: "Cross-tenant insert",
          exercise_type: "strength",
          default_metric: "reps_weight",
        })
        .select("id");

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe("UPDATE", () => {
    it("Trainer B cannot UPDATE Trainer A exercise", async () => {
      const { data, error } = await trainerB.client
        .from("exercises")
        .update({ name: "Hacked by B" })
        .eq("id", exerciseA1Id)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("Trainer A cannot UPDATE Trainer B exercise", async () => {
      const { data, error } = await trainerA.client
        .from("exercises")
        .update({ name: "Hacked by A" })
        .eq("id", exerciseB1Id)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("DELETE", () => {
    it("Trainer B cannot DELETE Trainer A exercise", async () => {
      const { data, error } = await trainerB.client.from("exercises").delete().eq("id", exerciseA1Id).select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("Trainer A cannot DELETE Trainer B exercise", async () => {
      const { data, error } = await trainerA.client.from("exercises").delete().eq("id", exerciseB1Id).select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });
});
