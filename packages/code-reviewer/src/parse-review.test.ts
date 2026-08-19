import { describe, expect, it } from "vitest";
import { parseReview, ReviewParseError } from "./parse-review.ts";
import type { Review } from "./schema.ts";

const validReview: Review = {
  implementationCorrectness: 8,
  idiomaticity: 7,
  complexity: 9,
  testRiskCoverage: 6,
  documentation: 5,
  securitySafety: 8,
  verdict: "pass",
  summary: "Looks good overall.",
};

describe("parseReview", () => {
  it("parses raw JSON", () => {
    expect(parseReview(JSON.stringify(validReview))).toEqual(validReview);
  });

  it("parses fenced JSON", () => {
    const fenced = `\`\`\`json\n${JSON.stringify(validReview, null, 2)}\n\`\`\``;
    expect(parseReview(fenced)).toEqual(validReview);
  });

  it("extracts the first JSON object when extra prose surrounds it", () => {
    const wrapped = `Here is the review:\n${JSON.stringify(validReview)}\nThanks.`;
    expect(parseReview(wrapped)).toEqual(validReview);
  });

  it("throws on truncated JSON", () => {
    expect(() => parseReview('{"verdict": "pass", "summary":')).toThrow(ReviewParseError);
    expect(() => parseReview('{"verdict": "pass", "summary":')).toThrow(/Truncated JSON|not valid JSON/);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseReview("not json at all")).toThrow(ReviewParseError);
    expect(() => parseReview("not json at all")).toThrow(/No JSON object/);
  });
});
