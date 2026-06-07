import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";

describe("template_exercises", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let templateAId: string;
  let exerciseAId: string;
  let templateExerciseAId: string;
  let templateExerciseSetAId: string;

  beforeAll(async () => {
    trainerA = await createTrainer();
    trainerB = await createTrainer();

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

    const { data: template, error: templateError } = await trainerA.client
      .from("session_templates")
      .insert({
        trainer_id: trainerA.id,
        name: "Trainer A Template",
      })
      .select("id")
      .single<{ id: string }>();

    if (templateError) {
      throw new Error(`Failed to seed session template: ${templateError.message}`);
    }

    templateAId = template.id;

    const { data: templateExercise, error: templateExerciseError } = await trainerA.client
      .from("template_exercises")
      .insert({
        template_id: templateAId,
        exercise_id: exerciseAId,
        phase: "main",
        sort_order: 1,
      })
      .select("id")
      .single<{ id: string }>();

    if (templateExerciseError) {
      throw new Error(`Failed to seed template exercise: ${templateExerciseError.message}`);
    }

    templateExerciseAId = templateExercise.id;

    const { data: templateExerciseSet, error: templateExerciseSetError } = await trainerA.client
      .from("template_exercise_sets")
      .insert({
        template_exercise_id: templateExerciseAId,
        set_number: 1,
        prescribed_reps: 10,
      })
      .select("id")
      .single<{ id: string }>();

    if (templateExerciseSetError) {
      throw new Error(`Failed to seed template exercise set: ${templateExerciseSetError.message}`);
    }

    templateExerciseSetAId = templateExerciseSet.id;
  });

  afterAll(async () => {
    // template_exercises references exercises with ON DELETE RESTRICT — drop template graph first
    await trainerA.client.from("session_templates").delete().eq("id", templateAId);
    await trainerA.client.from("exercises").delete().eq("id", exerciseAId);
    await trainerB.client.from("exercises").delete().eq("trainer_id", trainerB.id);

    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
  });

  describe("template_exercises SELECT", () => {
    it("Trainer A sees own template exercise", async () => {
      const { data, error } = await trainerA.client
        .from("template_exercises")
        .select("id")
        .eq("id", templateExerciseAId);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: templateExerciseAId }]);
    });

    it("Trainer B cannot SELECT Trainer A template exercise", async () => {
      const { data, error } = await trainerB.client
        .from("template_exercises")
        .select("id")
        .eq("id", templateExerciseAId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("template_exercises INSERT", () => {
    it("Trainer B cannot INSERT template exercise on Trainer A template", async () => {
      const { data: exerciseB, error: exerciseBError } = await trainerB.client
        .from("exercises")
        .insert({
          trainer_id: trainerB.id,
          name: "Trainer B Exercise",
          exercise_type: "strength",
          default_metric: "reps_weight",
        })
        .select("id")
        .single<{ id: string }>();

      if (exerciseBError) {
        throw new Error(`Failed to seed Trainer B exercise: ${exerciseBError.message}`);
      }

      const { data, error } = await trainerB.client
        .from("template_exercises")
        .insert({
          template_id: templateAId,
          exercise_id: exerciseB.id,
          phase: "main",
          sort_order: 1,
        })
        .select("id");

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe("template_exercises UPDATE", () => {
    it("Trainer B cannot UPDATE Trainer A template exercise", async () => {
      const { data, error } = await trainerB.client
        .from("template_exercises")
        .update({ sort_order: 99 })
        .eq("id", templateExerciseAId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("template_exercises DELETE", () => {
    it("Trainer B cannot DELETE Trainer A template exercise", async () => {
      const { data, error } = await trainerB.client
        .from("template_exercises")
        .delete()
        .eq("id", templateExerciseAId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("template_exercise_sets SELECT", () => {
    it("Trainer A sees own template exercise set", async () => {
      const { data, error } = await trainerA.client
        .from("template_exercise_sets")
        .select("id")
        .eq("id", templateExerciseSetAId);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: templateExerciseSetAId }]);
    });

    it("Trainer B cannot SELECT Trainer A template exercise set", async () => {
      const { data, error } = await trainerB.client
        .from("template_exercise_sets")
        .select("id")
        .eq("id", templateExerciseSetAId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("template_exercise_sets INSERT", () => {
    it("Trainer B cannot INSERT template exercise set on Trainer A template exercise", async () => {
      const { data, error } = await trainerB.client
        .from("template_exercise_sets")
        .insert({
          template_exercise_id: templateExerciseAId,
          set_number: 2,
          prescribed_reps: 8,
        })
        .select("id");

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe("template_exercise_sets UPDATE", () => {
    it("Trainer B cannot UPDATE Trainer A template exercise set", async () => {
      const { data, error } = await trainerB.client
        .from("template_exercise_sets")
        .update({ prescribed_reps: 99 })
        .eq("id", templateExerciseSetAId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("template_exercise_sets DELETE", () => {
    it("Trainer B cannot DELETE Trainer A template exercise set", async () => {
      const { data, error } = await trainerB.client
        .from("template_exercise_sets")
        .delete()
        .eq("id", templateExerciseSetAId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });
});
