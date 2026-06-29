import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createBareClient, createTrainer, deleteUser, type TestUser } from "../helpers/fixtures.js";
import { invokeHandler, makeApiContext } from "./helpers/api-context.js";
import { wireAppSupabaseEnv } from "./helpers/app-env.js";
import { buildAuthenticatedRequest } from "./helpers/session-request.js";
import { DUMMY_UUID, PATTERN_B_HANDLERS } from "./inventory.js";

wireAppSupabaseEnv();

describe("Pattern B inline route authorization", () => {
  let trainer: TestUser;
  let client: TestUser;

  beforeAll(async () => {
    trainer = await createTrainer();
    client = await createBareClient("client");
  });

  afterAll(async () => {
    await deleteUser(client.id);
    await deleteUser(trainer.id);
  });

  describe.each(PATTERN_B_HANDLERS)("$method $path ($id)", (entry) => {
    it("returns 401 when unauthenticated", async () => {
      const handler = await entry.loadHandler();
      const context = makeApiContext({
        method: entry.method,
        url: entry.path,
        params: entry.params,
        locals: { user: null, role: null },
      });

      const response = await invokeHandler(handler, context);
      expect(response.status).toBe(401);
    });

    it("returns 403 for the wrong role", async () => {
      const handler = await entry.loadHandler();
      const { data: sessionData } = await client.client.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        throw new Error("Expected client session");
      }

      const { request, cookies } = await buildAuthenticatedRequest(
        {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        },
        { method: entry.method, url: entry.path },
      );

      const context = makeApiContext({
        method: entry.method,
        url: entry.path,
        params: entry.params,
        request,
        cookies,
      });

      const response = await invokeHandler(handler, context);
      expect(response.status).toBe(403);
    });
  });

  it("trainer can reach invites guard (not 401/403)", async () => {
    const invitesEntry = PATTERN_B_HANDLERS.find((entry) => entry.id === "invites-post");
    if (!invitesEntry) {
      throw new Error("Missing invites-post inventory entry");
    }

    const loadedHandler = await invitesEntry.loadHandler();
    const { data: sessionData } = await trainer.client.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      throw new Error("Expected trainer session");
    }

    const { request, cookies } = await buildAuthenticatedRequest(
      {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
      { method: "POST", url: `http://localhost/api/invites` },
    );

    const context = makeApiContext({
      method: "POST",
      url: "http://localhost/api/invites",
      request,
      cookies,
    });

    const response = await invokeHandler(loadedHandler, context);
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  it("trainer-clients delete returns 404 (not 401/403) for valid trainer with unknown assignment", async () => {
    const deleteEntry = PATTERN_B_HANDLERS.find((entry) => entry.id === "trainer-clients-id-delete");
    if (!deleteEntry) {
      throw new Error("Missing trainer-clients-id-delete inventory entry");
    }

    const loadedHandler = await deleteEntry.loadHandler();
    const { data: sessionData } = await trainer.client.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      throw new Error("Expected trainer session");
    }

    const url = `http://localhost/api/trainer-clients/${DUMMY_UUID}`;
    const { request, cookies } = await buildAuthenticatedRequest(
      {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
      { method: "DELETE", url },
    );

    const context = makeApiContext({
      method: "DELETE",
      url,
      params: { id: DUMMY_UUID },
      request,
      cookies,
    });

    const response = await invokeHandler(loadedHandler, context);
    expect(response.status).toBe(404);
  });
});
