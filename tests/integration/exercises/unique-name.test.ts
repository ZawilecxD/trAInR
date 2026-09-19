import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getAdmin } from "../helpers/admin.js";
import { createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";

describe("exercises unique name per trainer", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  const createdExerciseIds: string[] = [];

  beforeAll(async () => {
    trainerA = await createTrainer();
    trainerB = await createTrainer();
  });

  afterAll(async () => {
    const admin = getAdmin();
    // Always restore the unique index in case a test left it dropped.
    await admin.rpc("dedupe_exercise_names_for_unique_index");
    await admin.rpc("create_exercises_trainer_id_name_ci_uidx");

    if (createdExerciseIds.length > 0) {
      await admin.from("exercises").delete().in("id", createdExerciseIds);
    }

    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
  });

  async function insertExercise(
    trainer: TestUser,
    name: string,
    options?: { is_archived?: boolean; created_at?: string },
  ): Promise<{ id: string; name: string }> {
    const admin = getAdmin();
    const row: Record<string, unknown> = {
      trainer_id: trainer.id,
      name,
      exercise_type: "strength",
      default_metric: "reps_weight",
      is_archived: options?.is_archived ?? false,
    };
    if (options?.created_at) {
      row.created_at = options.created_at;
    }

    const { data, error } = await admin
      .from("exercises")
      .insert(row)
      .select("id, name")
      .single<{ id: string; name: string }>();

    // Admin client + single<T> types error as null; still assert at runtime.
    expect(error).toBeNull();
    if (data === null) {
      throw new Error(`Failed to insert exercise ${name}: no data`);
    }

    expect(data.id).toEqual(expect.any(String));
    expect(data.name).toBe(name);

    createdExerciseIds.push(data.id);
    return data;
  }

  it("suffixes case-duplicate names via backfill then enforces the unique index", async () => {
    const admin = getAdmin();
    const token = crypto.randomUUID().slice(0, 8);
    const keeperName = `UniqueCi-${token}`;
    const duplicateName = `uniqueci-${token}`;

    const { error: dropError } = await admin.rpc("drop_exercises_trainer_id_name_ci_uidx");
    expect(dropError).toBeNull();

    const keeper = await insertExercise(trainerA, keeperName, {
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const duplicate = await insertExercise(trainerA, duplicateName, {
      created_at: "2026-01-02T00:00:00.000Z",
    });

    const { error: dedupeError } = await admin.rpc("dedupe_exercise_names_for_unique_index");
    expect(dedupeError).toBeNull();

    const { error: createIndexError } = await admin.rpc("create_exercises_trainer_id_name_ci_uidx");
    expect(createIndexError).toBeNull();

    const { data: rows, error: selectError } = await admin
      .from("exercises")
      .select("id, name")
      .in("id", [keeper.id, duplicate.id]);

    expect(selectError).toBeNull();
    const byId = new Map((rows ?? []).map((row: { id: string; name: string }) => [row.id, row.name]));
    expect(byId.get(keeper.id)).toBe(keeperName);
    expect(byId.get(duplicate.id)).toBe(`${duplicateName} (2)`);

    const { error: thirdInsertError } = await trainerA.client.from("exercises").insert({
      trainer_id: trainerA.id,
      name: keeperName.toUpperCase(),
      exercise_type: "strength",
      default_metric: "reps_weight",
    });
    expect(thirdInsertError?.code).toBe("23505");

    const shared = await insertExercise(trainerB, keeperName);
    expect(shared.name).toBe(keeperName);
  });

  it("rejects a case-variant name that collides with an archived exercise", async () => {
    const token = crypto.randomUUID().slice(0, 8);
    const name = `ArchivedCi-${token}`;

    await insertExercise(trainerA, name, { is_archived: true });

    const { error } = await trainerA.client.from("exercises").insert({
      trainer_id: trainerA.id,
      name: name.toLowerCase(),
      exercise_type: "strength",
      default_metric: "reps_weight",
    });

    expect(error?.code).toBe("23505");
  });

  it("allows two trainers to use the same exercise name", async () => {
    const token = crypto.randomUUID().slice(0, 8);
    const name = `SharedName-${token}`;

    const a = await insertExercise(trainerA, name);
    const b = await insertExercise(trainerB, name);

    expect(a.name).toBe(name);
    expect(b.name).toBe(name);
  });
});
