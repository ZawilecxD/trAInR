import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";

describe("exercise favourites", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let favouriteId: string;
  let otherId: string;
  let trainerBExerciseId: string;

  beforeAll(async () => {
    trainerA = await createTrainer();
    trainerB = await createTrainer();

    const seedExercise = async (trainer: TestUser, name: string, isFavourite = false) => {
      const { data, error } = await trainer.client
        .from("exercises")
        .insert({
          trainer_id: trainer.id,
          name,
          exercise_type: "strength",
          default_metric: "reps_weight",
          is_favourite: isFavourite,
        })
        .select("id")
        .single<{ id: string }>();

      if (error) {
        throw new Error(`Failed to seed exercise ${name}: ${error.message}`);
      }

      return data.id;
    };

    favouriteId = await seedExercise(trainerA, "Favourite Lift", true);
    otherId = await seedExercise(trainerA, "Other Lift", false);
    trainerBExerciseId = await seedExercise(trainerB, "Trainer B Lift", true);
  });

  afterAll(async () => {
    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
  });

  it("lists only favourited exercises when favourites filter is applied", async () => {
    const { data, error } = await trainerA.client
      .from("exercises")
      .select("id")
      .eq("is_archived", false)
      .eq("is_favourite", true);

    expect(error).toBeNull();
    expect(data?.map((row: { id: string }) => row.id)).toEqual([favouriteId]);
  });

  it("allows trainer to toggle favourite on own exercise", async () => {
    const { error } = await trainerA.client.from("exercises").update({ is_favourite: true }).eq("id", otherId);

    expect(error).toBeNull();

    const { data } = await trainerA.client.from("exercises").select("is_favourite").eq("id", otherId).single<{
      is_favourite: boolean;
    }>();

    expect(data?.is_favourite).toBe(true);
  });

  it("prevents trainer from toggling another trainer's favourite flag", async () => {
    const { data, error } = await trainerA.client
      .from("exercises")
      .update({ is_favourite: false })
      .eq("id", trainerBExerciseId)
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
