import { describe, expect, it } from "vitest";

import { PATTERN_A_HANDLERS, PATTERN_B_HANDLERS, PROTECTED_ROUTE_HANDLERS } from "./inventory.js";

describe("protected route inventory", () => {
  it("lists 22 protected handlers", () => {
    expect(PROTECTED_ROUTE_HANDLERS).toHaveLength(22);
  });

  it("covers 20 Pattern A and 2 Pattern B handlers", () => {
    expect(PATTERN_A_HANDLERS).toHaveLength(20);
    expect(PATTERN_B_HANDLERS).toHaveLength(2);
  });

  it("has 16 trainer and 6 client handlers", () => {
    const trainers = PROTECTED_ROUTE_HANDLERS.filter((entry) => entry.role === "trainer");
    const clients = PROTECTED_ROUTE_HANDLERS.filter((entry) => entry.role === "client");
    expect(trainers).toHaveLength(16);
    expect(clients).toHaveLength(6);
  });
});
