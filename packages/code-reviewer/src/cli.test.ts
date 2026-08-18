import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { AgentStartupError } from "./agent.ts";
import { runCli } from "./cli.ts";
import { emptyDiffReview, type Review } from "./schema.ts";

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const assistantFixture = path.join(fixtureDir, "assistant-pass.json");
const flawDiff = path.join(fixtureDir, "intentional-flaw.diff");

const sampleReview: Review = {
  implementationCorrectness: 8,
  idiomaticity: 7,
  complexity: 8,
  testRiskCoverage: 6,
  documentation: 7,
  securitySafety: 9,
  verdict: "pass",
  summary: "Mocked agent review.",
};

describe("runCli", () => {
  it("prints the skip payload for an empty diff without requiring an agent", async () => {
    const runAgent = vi.fn();
    const result = await runCli(["--title", "Empty"], { stdinText: "  \n", runAgent });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout) as Review).toEqual(emptyDiffReview);
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("prints the skip payload for an empty --diff-file", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "code-reviewer-"));
    const diffFile = path.join(dir, "empty.diff");
    await writeFile(diffFile, "");

    const result = await runCli(["--title", "Empty file", "--diff-file", diffFile], { apiKey: "" });

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

  it("exits 1 with a clear message when CURSOR_API_KEY is missing", async () => {
    const result = await runCli(["--title", "Live PR", "--diff-file", flawDiff], { apiKey: "" });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/CURSOR_API_KEY is required/);
    expect(result.stdout).toBe("");
  });

  it("prints JSON from a mocked agent on a non-empty diff", async () => {
    const runAgent = vi.fn(async () => ({ review: sampleReview, stderr: "agentId=test\n" }));
    const result = await runCli(["--title", "Mocked PR", "--diff-file", flawDiff], { runAgent });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout) as Review).toEqual(sampleReview);
    expect(result.stderr).toContain("agentId=test");
    expect(runAgent).toHaveBeenCalledOnce();
    expect(runAgent).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ runtime: undefined }));
  });

  it("passes --runtime cloud to the agent", async () => {
    const runAgent = vi.fn(async () => ({ review: sampleReview, stderr: "agentId=test\n" }));
    const result = await runCli(["--title", "Cloud PR", "--diff-file", flawDiff, "--runtime", "cloud"], { runAgent });

    expect(result.exitCode).toBe(0);
    expect(runAgent).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ runtime: "cloud" }));
  });

  it("maps agent startup failures to exit 1", async () => {
    const runAgent = vi.fn(async () => {
      throw new AgentStartupError("Cursor agent failed to start: boom");
    });
    const result = await runCli(["--title", "Broken", "--diff-file", flawDiff], { runAgent });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/failed to start/);
  });

  it("requires --title", async () => {
    const result = await runCli([], { stdinText: "" });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/--title is required/);
  });
});
