import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";

describe("replace_exercise_muscle_groups", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let exerciseAId: string;

  beforeAll(async () => {
    trainerA = await createTrainer();
    trainerB = await createTrainer();

    const { data: muscleGroup, error: muscleError } = await trainerA.client
      .from("muscle_groups")
      .select("id")
      .limit(1)
      .single<{ id: string }>();

    if (muscleError) {
      throw new Error(`Failed to load muscle group: ${muscleError.message}`);
    }

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

    const { error: linkError } = await trainerA.client.from("exercise_muscle_groups").insert({
      exercise_id: exerciseAId,
      muscle_group_id: muscleGroup.id,
      role: "primary",
    });

    if (linkError) {
      throw new Error(`Failed to seed exercise muscle group link: ${linkError.message}`);
    }
  });

  afterAll(async () => {
    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
  });

  describe("SECURITY DEFINER cross-tenant call", () => {
    it("KNOWN GAP: Trainer B can call replace_exercise_muscle_groups on Trainer A exercise", async () => {
      // KNOWN GAP: this call should be rejected — harden in a follow-up PR
      const { error } = await trainerB.client.rpc("replace_exercise_muscle_groups", {
        p_exercise_id: exerciseAId,
        p_muscle_groups: [],
      });

      expect(error).toBeNull();
    });
  });
});
