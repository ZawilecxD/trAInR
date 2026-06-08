import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import { getAdmin } from "./helpers/admin.js";
import { getSupabaseAnonKey, getSupabaseUrl } from "./helpers/env.js";
import { createTrainer, deleteUser } from "./helpers/fixtures.js";

describe("smoke", () => {
  let trainerId: string | undefined;

  afterAll(async () => {
    if (trainerId) {
      await deleteUser(trainerId);
    }
  });

  it("admin can call auth.admin.listUsers()", async () => {
    const { data, error } = await getAdmin().auth.admin.listUsers();
    expect(error).toBeNull();
    expect(data.users).toBeDefined();
  });

  it("a provisioned trainer anon-key client returns an authenticated getUser()", async () => {
    const trainer = await createTrainer();
    trainerId = trainer.id;

    const {
      data: { user },
      error,
    } = await trainer.client.auth.getUser();

    expect(error).toBeNull();
    expect(user?.id).toBe(trainer.id);
  });

  it("an unauthenticated client gets no rows from exercises", async () => {
    const client = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await client.from("exercises").select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
