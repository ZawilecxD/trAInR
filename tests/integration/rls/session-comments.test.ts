import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClient_, createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";

describe("session_comments", () => {
  let trainerA: TestUser;
  let trainerB: TestUser;
  let clientA: TestUser;
  let sessionAId: string;
  let trainerCommentId: string;
  let clientCommentId: string;

  beforeAll(async () => {
    trainerA = await createTrainer();
    trainerB = await createTrainer();
    clientA = await createClient_(trainerA);

    const { data: plan, error: planError } = await trainerA.client
      .from("client_plans")
      .insert({
        trainer_id: trainerA.id,
        client_id: clientA.id,
        name: "Trainer A Client Plan",
      })
      .select("id")
      .single<{ id: string }>();

    if (planError) {
      throw new Error(`Failed to seed client plan: ${planError.message}`);
    }

    const { data: session, error: sessionError } = await trainerA.client
      .from("workout_sessions")
      .insert({
        client_plan_id: plan.id,
        scheduled_date: "2026-06-07",
        name: "Trainer A Session",
      })
      .select("id")
      .single<{ id: string }>();

    if (sessionError) {
      throw new Error(`Failed to seed workout session: ${sessionError.message}`);
    }

    sessionAId = session.id;

    const { data: trainerComment, error: trainerCommentError } = await trainerA.client
      .from("session_comments")
      .insert({
        session_id: sessionAId,
        author_id: trainerA.id,
        body: "Trainer feedback",
      })
      .select("id")
      .single<{ id: string }>();

    if (trainerCommentError) {
      throw new Error(`Failed to seed trainer comment: ${trainerCommentError.message}`);
    }

    trainerCommentId = trainerComment.id;

    const { data: clientComment, error: clientCommentError } = await clientA.client
      .from("session_comments")
      .insert({
        session_id: sessionAId,
        author_id: clientA.id,
        body: "Client note",
      })
      .select("id")
      .single<{ id: string }>();

    if (clientCommentError) {
      throw new Error(`Failed to seed client comment: ${clientCommentError.message}`);
    }

    clientCommentId = clientComment.id;
  });

  afterAll(async () => {
    await deleteUser(clientA.id);
    await deleteUser(trainerA.id);
    await deleteUser(trainerB.id);
  });

  describe("SELECT", () => {
    it("Trainer A sees comments on own client session", async () => {
      const { data, error } = await trainerA.client
        .from("session_comments")
        .select("id")
        .in("id", [trainerCommentId, clientCommentId]);

      expect(error).toBeNull();
      const commentIds = (data ?? []).map((row: { id: string }) => row.id).sort();
      expect(commentIds).toEqual([clientCommentId, trainerCommentId].sort());
    });

    it("Trainer B cannot SELECT Trainer A session comments", async () => {
      const { data, error } = await trainerB.client
        .from("session_comments")
        .select("id")
        .in("id", [trainerCommentId, clientCommentId]);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("INSERT", () => {
    it("Trainer B cannot INSERT comment on Trainer A session", async () => {
      const { data, error } = await trainerB.client
        .from("session_comments")
        .insert({
          session_id: sessionAId,
          author_id: trainerB.id,
          body: "Hacked comment",
        })
        .select("id");

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe("UPDATE", () => {
    it("Trainer A cannot UPDATE client-authored comment", async () => {
      const { data, error } = await trainerA.client
        .from("session_comments")
        .update({ body: "Trainer override" })
        .eq("id", clientCommentId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("Client can UPDATE own comment", async () => {
      const { data, error } = await clientA.client
        .from("session_comments")
        .update({ body: "Updated client note" })
        .eq("id", clientCommentId)
        .select("id, body");

      expect(error).toBeNull();
      expect(data).toEqual([{ id: clientCommentId, body: "Updated client note" }]);
    });
  });

  describe("DELETE", () => {
    it("Trainer B cannot DELETE Trainer A session comment", async () => {
      const { data, error } = await trainerB.client
        .from("session_comments")
        .delete()
        .eq("id", trainerCommentId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });
});
