import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";

describe("exercise_muscle_groups", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let exerciseAId: string;
  let muscleGroupId: string;

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

    muscleGroupId = muscleGroup.id;

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
      muscle_group_id: muscleGroupId,
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

  describe("SELECT", () => {
    it("Trainer A can SELECT own exercise muscle group links", async () => {
      const { data, error } = await trainerA.client
        .from("exercise_muscle_groups")
        .select("exercise_id, muscle_group_id, role")
        .eq("exercise_id", exerciseAId);

      expect(error).toBeNull();
      expect(data).toEqual([
        {
          exercise_id: exerciseAId,
          muscle_group_id: muscleGroupId,
          role: "primary",
        },
      ]);
    });

    it("Trainer B can SELECT all exercise muscle group links (global catalog)", async () => {
      const { data, error } = await trainerB.client
        .from("exercise_muscle_groups")
        .select("exercise_id")
        .eq("exercise_id", exerciseAId);

      expect(error).toBeNull();
      expect(data).toEqual([{ exercise_id: exerciseAId }]);
    });
  });

  describe("INSERT", () => {
    it("Trainer B cannot INSERT a muscle group link on Trainer A exercise", async () => {
      const { data, error } = await trainerB.client.from("exercise_muscle_groups").insert({
        exercise_id: exerciseAId,
        muscle_group_id: muscleGroupId,
        role: "secondary",
      });

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe("UPDATE", () => {
    it("Trainer B cannot UPDATE muscle group link on Trainer A exercise", async () => {
      const { data, error } = await trainerB.client
        .from("exercise_muscle_groups")
        .update({ role: "secondary" })
        .eq("exercise_id", exerciseAId)
        .eq("muscle_group_id", muscleGroupId)
        .eq("role", "primary")
        .select("role");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("DELETE", () => {
    it("Trainer B cannot DELETE muscle group link on Trainer A exercise", async () => {
      const { data, error } = await trainerB.client
        .from("exercise_muscle_groups")
        .delete()
        .eq("exercise_id", exerciseAId)
        .eq("muscle_group_id", muscleGroupId)
        .eq("role", "primary")
        .select("exercise_id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });
});
