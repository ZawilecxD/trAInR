import { z } from "zod";

export const reviewCriteria = [
  "implementationCorrectness",
  "idiomaticity",
  "complexity",
  "testRiskCoverage",
  "documentation",
  "securitySafety",
] as const;

export type ReviewCriterion = (typeof reviewCriteria)[number];

export const reviewSchema = z.object({
  implementationCorrectness: z.number(),
  idiomaticity: z.number(),
  complexity: z.number(),
  testRiskCoverage: z.number(),
  documentation: z.number(),
  securitySafety: z.number(),
  verdict: z.enum(["pass", "fail"]),
  summary: z.string(),
});

export type Review = z.infer<typeof reviewSchema>;

export const emptyDiffReview: Review = {
  implementationCorrectness: 10,
  idiomaticity: 10,
  complexity: 10,
  testRiskCoverage: 10,
  documentation: 10,
  securitySafety: 10,
  verdict: "pass",
  summary: "No file changes in the diff; skipped the model. Verdict is pass.",
};
