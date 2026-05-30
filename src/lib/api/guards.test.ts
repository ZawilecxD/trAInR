import type { APIContext } from "astro";
import { describe, expect, it } from "vitest";
import { requireTrainer } from "@/lib/api/guards";

function makeContext(overrides: Partial<APIContext["locals"]>): APIContext {
  return {
    locals: {
      user: null,
      role: null,
      ...overrides,
    },
  } as APIContext;
}

describe("requireTrainer", () => {
  it("returns 401 when unauthenticated", () => {
    const result = requireTrainer(makeContext({ user: null, role: null }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns 403 for non-trainer roles", () => {
    const result = requireTrainer(
      makeContext({
        user: { id: "user-1" } as APIContext["locals"]["user"],
        role: "client",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("allows trainers", () => {
    const result = requireTrainer(
      makeContext({
        user: { id: "trainer-1" } as APIContext["locals"]["user"],
        role: "trainer",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe("trainer-1");
    }
  });
});
