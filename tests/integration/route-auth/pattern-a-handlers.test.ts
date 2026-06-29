import type { APIContext } from "astro";
import { describe, expect, it } from "vitest";

import { invokeHandler, makeApiContext } from "./helpers/api-context.js";
import { PATTERN_A_HANDLERS } from "./inventory.js";

function wrongRoleFor(required: "trainer" | "client"): APIContext["locals"] {
  if (required === "trainer") {
    return {
      user: { id: "client-user" } as APIContext["locals"]["user"],
      role: "client",
    };
  }

  return {
    user: { id: "trainer-user" } as APIContext["locals"]["user"],
    role: "trainer",
  };
}

describe("Pattern A route authorization", () => {
  describe.each(PATTERN_A_HANDLERS)("$method $path ($id)", (entry) => {
    it("returns 401 when unauthenticated", async () => {
      const handler = await entry.loadHandler();
      const context = makeApiContext({
        method: entry.method,
        url: entry.path,
        params: entry.params,
        body: entry.invalidBody,
        locals: { user: null, role: null },
      });

      const response = await invokeHandler(handler, context);
      expect(response.status).toBe(401);
    });

    it("returns 403 for the wrong role", async () => {
      const handler = await entry.loadHandler();
      const context = makeApiContext({
        method: entry.method,
        url: entry.path,
        params: entry.params,
        body: entry.invalidBody,
        locals: wrongRoleFor(entry.role),
      });

      const response = await invokeHandler(handler, context);
      expect(response.status).toBe(403);
    });

    if (entry.invalidBody) {
      it("returns 401/403 before parsing invalid body", async () => {
        const handler = await entry.loadHandler();
        const context = makeApiContext({
          method: entry.method,
          url: entry.path,
          params: entry.params,
          body: entry.invalidBody,
          locals: { user: null, role: null },
        });

        const response = await invokeHandler(handler, context);
        expect([401, 403]).toContain(response.status);
        expect(response.status).not.toBe(400);
      });
    }
  });
});
