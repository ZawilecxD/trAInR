import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createBareClient, createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";

describe("complete_client_invite", () => {
  let trainer: TestUser;
  let clientA: TestUser;
  let clientB: TestUser;
  let inviteToken: string;

  beforeAll(async () => {
    trainer = await createTrainer();
    clientA = await createBareClient("client");
    clientB = await createBareClient("client");

    inviteToken = crypto.randomUUID();

    const { error } = await trainer.client.from("invite_links").insert({
      trainer_id: trainer.id,
      token: inviteToken,
    });

    if (error) {
      throw new Error(`Failed to seed invite link: ${error.message}`);
    }
  });

  afterAll(async () => {
    await deleteUser(trainer.id);
    await deleteUser(clientA.id);
    await deleteUser(clientB.id);
  });

  describe("SECURITY DEFINER p_client_id mismatch", () => {
    it("KNOWN GAP: signed-in client can complete invite for a different client_id", async () => {
      // KNOWN GAP: p_client_id is caller-supplied with no auth.uid() check.
      // Lower risk than replace_exercise_muscle_groups — requires a valid unused token.
      const { error } = await clientA.client.rpc("complete_client_invite", {
        p_token: inviteToken,
        p_client_id: clientB.id,
      });

      expect(error).toBeNull();

      const { data: assignment, error: assignmentError } = await trainer.client
        .from("trainer_clients")
        .select("client_id")
        .eq("client_id", clientB.id);

      expect(assignmentError).toBeNull();
      expect(assignment).toEqual([{ client_id: clientB.id }]);

      const { data: clientAAssignment, error: clientAAssignmentError } = await trainer.client
        .from("trainer_clients")
        .select("client_id")
        .eq("client_id", clientA.id);

      expect(clientAAssignmentError).toBeNull();
      expect(clientAAssignment).toEqual([]);
    });
  });
});
