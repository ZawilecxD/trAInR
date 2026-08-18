import { describe, expect, it } from "vitest";
import { buildReviewPrompt } from "./prompt.ts";
import { reviewCriteria } from "./schema.ts";

describe("buildReviewPrompt", () => {
  it("includes the title, diff, and all six criterion names", () => {
    const title = "Add nested code-reviewer package";
    const diff = "diff --git a/src/cli.ts b/src/cli.ts\n+console.log('hi')\n";
    const prompt = buildReviewPrompt({ title, diff });

    expect(prompt).toContain(title);
    expect(prompt).toContain(diff);
    for (const criterion of reviewCriteria) {
      expect(prompt).toContain(criterion);
    }
  });
});
