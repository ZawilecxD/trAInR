import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getAdmin } from "./helpers/admin.js";
import { createBareClient, createTrainer, deleteUser, type TestUser } from "./helpers/fixtures.js";

const STARTER_EXERCISE_COUNT = 20;

describe("starter exercise seed", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let client: TestUser;

  beforeAll(async () => {
    trainerA = await createTrainer();
    trainerB = await createTrainer();
    client = await createBareClient("client");
  });

  afterAll(async () => {
    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
    await deleteUser(client.id);
  });

  it("provisions starter exercises for a new trainer on signup", async () => {
    const { data: profile, error: profileError } = await getAdmin()
      .from("profiles")
      .select("role, starter_exercises_seeded_at")
      .eq("id", trainerA.id)
      .single<{ role: string; starter_exercises_seeded_at: string | null }>();

    expect(profileError).toBeNull();
    expect(profile?.role).toBe("trainer");
    expect(profile?.starter_exercises_seeded_at).not.toBeNull();

    const { data: exercises, error: exerciseError } = await trainerA.client
      .from("exercises")
      .select("id, name, exercise_type, default_metric, notes, trainer_id")
      .order("name");

    expect(exerciseError).toBeNull();
    expect(exercises).toHaveLength(STARTER_EXERCISE_COUNT);
    expect(
      exercises?.every(
        (row: { trainer_id: string; name: string }) => row.trainer_id === trainerA.id && row.name.length > 0,
      ),
    ).toBe(true);

    const exerciseIds = exercises?.map((row: { id: string }) => row.id) ?? [];
    const { data: links, error: linkError } = await trainerA.client
      .from("exercise_muscle_groups")
      .select("exercise_id, muscle_group_id, role")
      .in("exercise_id", exerciseIds);

    expect(linkError).toBeNull();
    expect(links?.length).toBe(STARTER_EXERCISE_COUNT);
    expect(links?.every((row: { role: string }) => row.role === "primary")).toBe(true);
  });

  it("does not provision starter exercises for a new client on signup", async () => {
    const { data: profile, error: profileError } = await getAdmin()
      .from("profiles")
      .select("role, starter_exercises_seeded_at")
      .eq("id", client.id)
      .single<{ role: string; starter_exercises_seeded_at: string | null }>();

    expect(profileError).toBeNull();
    expect(profile?.role).toBe("client");
    expect(profile?.starter_exercises_seeded_at).toBeNull();

    const { data: exercises, error: exerciseError } = await getAdmin()
      .from("exercises")
      .select("id")
      .eq("trainer_id", client.id);

    expect(exerciseError).toBeNull();
    expect(exercises).toEqual([]);
  });

  it("is idempotent when seed_starter_exercises_for_trainer is called again", async () => {
    const { count: beforeCount, error: beforeError } = await getAdmin()
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", trainerA.id);

    expect(beforeError).toBeNull();
    expect(beforeCount).toBe(STARTER_EXERCISE_COUNT);

    const { error: reseedError } = await getAdmin().rpc("seed_starter_exercises_for_trainer", {
      p_trainer_id: trainerA.id,
    });

    expect(reseedError).toBeNull();

    const { count: afterCount, error: afterError } = await getAdmin()
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", trainerA.id);

    expect(afterError).toBeNull();
    expect(afterCount).toBe(STARTER_EXERCISE_COUNT);
  });

  describe("RLS isolation", () => {
    it("trainer A can list only their seeded exercises", async () => {
      const { data, error } = await trainerA.client.from("exercises").select("id");

      expect(error).toBeNull();
      expect(data?.length).toBe(STARTER_EXERCISE_COUNT);
    });

    it("trainer B cannot SELECT trainer A seeded exercises", async () => {
      const { data: trainerAExercises, error: trainerAError } = await trainerA.client.from("exercises").select("id");

      expect(trainerAError).toBeNull();
      const trainerAIds = trainerAExercises?.map((row: { id: string }) => row.id) ?? [];

      const { data, error } = await trainerB.client.from("exercises").select("id").in("id", trainerAIds);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("trainer B cannot UPDATE trainer A seeded exercise", async () => {
      const { data: trainerAExercise, error: trainerAError } = await trainerA.client
        .from("exercises")
        .select("id")
        .limit(1)
        .single<{ id: string }>();

      expect(trainerAError).toBeNull();

      const { data, error } = await trainerB.client
        .from("exercises")
        .update({ name: "Hacked by B" })
        .eq("id", trainerAExercise.id)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("trainer B cannot DELETE trainer A seeded exercise", async () => {
      const { data: trainerAExercise, error: trainerAError } = await trainerA.client
        .from("exercises")
        .select("id")
        .limit(1)
        .single<{ id: string }>();

      expect(trainerAError).toBeNull();

      const { data, error } = await trainerB.client
        .from("exercises")
        .delete()
        .eq("id", trainerAExercise.id)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });
});
