import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getSupabaseAnonKey, getSupabaseUrl } from "../helpers/env.js";
import { createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";

describe("invite_links", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let inviteAId: string;
  let inviteAToken: string;

  beforeAll(async () => {
    trainerA = await createTrainer();
    trainerB = await createTrainer();

    inviteAToken = crypto.randomUUID();

    const { data, error } = await trainerA.client
      .from("invite_links")
      .insert({
        trainer_id: trainerA.id,
        token: inviteAToken,
      })
      .select("id")
      .single<{ id: string }>();

    if (error) {
      throw new Error(`Failed to seed invite link: ${error.message}`);
    }

    inviteAId = data.id;
  });

  afterAll(async () => {
    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
  });

  describe("SELECT", () => {
    it("Trainer A sees own invite link", async () => {
      const { data, error } = await trainerA.client.from("invite_links").select("id").eq("id", inviteAId);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: inviteAId }]);
    });

    it("Trainer B cannot SELECT Trainer A invite link", async () => {
      const { data, error } = await trainerB.client.from("invite_links").select("id").eq("id", inviteAId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("unauthenticated client cannot SELECT invite links", async () => {
      const anonClient = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const { data, error } = await anonClient.from("invite_links").select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("INSERT", () => {
    it("Trainer B cannot INSERT an invite link with Trainer A trainer_id", async () => {
      const { data, error } = await trainerB.client
        .from("invite_links")
        .insert({
          trainer_id: trainerA.id,
          token: crypto.randomUUID(),
        })
        .select("id");

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe("UPDATE", () => {
    it("Trainer B cannot UPDATE Trainer A invite link", async () => {
      const { data, error } = await trainerB.client
        .from("invite_links")
        .update({ token: crypto.randomUUID() })
        .eq("id", inviteAId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("DELETE", () => {
    it("Trainer B cannot DELETE Trainer A invite link", async () => {
      const { data, error } = await trainerB.client.from("invite_links").delete().eq("id", inviteAId).select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });
});
