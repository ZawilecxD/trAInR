import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCli } from "./cli.ts";
import { emptyDiffReview, type Review } from "./schema.ts";

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const assistantFixture = path.join(fixtureDir, "assistant-pass.json");

describe("runCli", () => {
  it("prints the skip payload for an empty diff without requiring an agent", async () => {
    const result = await runCli(["--title", "Empty"], { stdinText: "  \n" });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout) as Review).toEqual(emptyDiffReview);
    expect(result.stderr).toBe("");
  });

  it("prints the skip payload for an empty --diff-file", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "code-reviewer-"));
    const diffFile = path.join(dir, "empty.diff");
    await writeFile(diffFile, "");

    const result = await runCli(["--title", "Empty file", "--diff-file", diffFile]);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout) as Review).toEqual(emptyDiffReview);
  });

  it("parses a fixture assistant payload for a non-empty diff", async () => {
    const result = await runCli(
      ["--title", "Fixture PR", "--fixture-assistant", assistantFixture],
      { stdinText: "diff --git a/foo.ts b/foo.ts\n+export const x = 1;\n" },
    );

    expect(result.exitCode).toBe(0);
    const review = JSON.parse(result.stdout) as Review;
    expect(review.verdict).toBe("pass");
    expect(review.summary).toContain("Fixture assistant");
  });

  it("exits with agent not wired when the adapter is missing", async () => {
    const result = await runCli(["--title", "Live PR"], {
      stdinText: "diff --git a/foo.ts b/foo.ts\n+export const x = 1;\n",
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/agent not wired/i);
    expect(result.stdout).toBe("");
  });

  it("requires --title", async () => {
    const result = await runCli([], { stdinText: "" });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/--title is required/);
  });
});
