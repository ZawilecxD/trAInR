import { describe, expect, it } from "vitest";
import { reviewSchema } from "./schema.ts";

const valid = {
  implementationCorrectness: 8,
  idiomaticity: 7,
  complexity: 9,
  testRiskCoverage: 6,
  documentation: 5,
  securitySafety: 8,
  verdict: "pass",
  summary: "Looks good overall.",
};

describe("reviewSchema", () => {
  it("accepts a complete review", () => {
    expect(reviewSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a missing verdict", () => {
    const { verdict: _verdict, ...rest } = valid;
    expect(reviewSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a non-enum verdict", () => {
    expect(reviewSchema.safeParse({ ...valid, verdict: "maybe" }).success).toBe(false);
  });

  it("rejects a missing criterion", () => {
    const { documentation: _documentation, ...rest } = valid;
    expect(reviewSchema.safeParse(rest).success).toBe(false);
  });
});
