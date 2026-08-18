import { CursorAgentError } from "@cursor/sdk";
import { describe, expect, it, vi } from "vitest";
import type { AgentOptions, RunResult } from "@cursor/sdk";
import {
  AgentRunFailedError,
  AgentStartupError,
  buildReviewAgentOptions,
  REVIEW_MODEL_ID,
  runReviewAgent,
} from "./agent.ts";
import type { Review } from "./schema.ts";

const validReview: Review = {
  implementationCorrectness: 3,
  idiomaticity: 4,
  complexity: 5,
  testRiskCoverage: 2,
  documentation: 4,
  securitySafety: 1,
  verdict: "fail",
  summary: "Hardcoded secret and off-by-one in add().",
};

function finishedResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    id: "run-1",
    status: "finished",
    result: JSON.stringify(validReview),
    ...overrides,
  };
}

describe("buildReviewAgentOptions", () => {
  it("uses a local runtime, empty setting sources, and disallowed mutating tools", () => {
    const options = buildReviewAgentOptions({
      apiKey: "cursor_test",
      cwd: "/tmp/review",
    });

    expect(options.apiKey).toBe("cursor_test");
    expect(options.agentId).toBeUndefined();
    expect(options.model).toEqual({ id: REVIEW_MODEL_ID });
    expect(options.tools).toBeUndefined();
    expect(options.disallowedTools).toEqual([
      "shell",
      "edit",
      "delete",
      "applyAgentDiff",
      "task",
      "mcp",
    ]);
    expect(options.local?.cwd).toBe("/tmp/review");
    expect(options.local?.settingSources).toEqual([]);
    expect(options.local?.store).toBeDefined();
  });

  it("uses a no-repo cloud runtime without local tools", () => {
    const options = buildReviewAgentOptions({
      apiKey: "cursor_test",
      cwd: "/tmp/review",
      runtime: "cloud",
    });

    expect(options.local).toBeUndefined();
    expect(options.disallowedTools).toBeUndefined();
    expect(options.cloud).toEqual({});
  });
});

describe("runReviewAgent", () => {
  it("fails fast when CURSOR_API_KEY is missing", async () => {
    await expect(runReviewAgent("prompt", { apiKey: "", cwd: "/tmp" })).rejects.toBeInstanceOf(AgentStartupError);
    await expect(runReviewAgent("prompt", { apiKey: "  ", cwd: "/tmp" })).rejects.toThrow(/CURSOR_API_KEY is required/);
  });

  it("maps CursorAgentError to exit 1", async () => {
    const prompt = vi.fn(async () => {
      throw new CursorAgentError("auth failed");
    });

    await expect(runReviewAgent("score this diff", { apiKey: "cursor_test", prompt, cwd: "/tmp" })).rejects.toMatchObject(
      {
        name: "AgentStartupError",
        exitCode: 1,
      },
    );
    expect(prompt).toHaveBeenCalledOnce();
  });

  it("maps status error to exit 2", async () => {
    const prompt = vi.fn(async (): Promise<RunResult> => ({
      id: "run-err",
      status: "error",
      error: { message: "executor crashed" },
    }));

    await expect(runReviewAgent("score this diff", { apiKey: "cursor_test", prompt, cwd: "/tmp" })).rejects.toMatchObject(
      {
        name: "AgentRunFailedError",
        exitCode: 2,
        runId: "run-err",
      },
    );
  });

  it("parses finished result text and logs ids on stderr", async () => {
    const prompt = vi.fn(async (_message: string, _options?: AgentOptions): Promise<RunResult> => finishedResult());

    const { review, stderr } = await runReviewAgent("score this diff", {
      apiKey: "cursor_test",
      prompt,
      cwd: "/tmp/review",
    });

    expect(review).toEqual(validReview);
    expect(stderr).toContain("starting local review cwd=/tmp/review");
    expect(stderr).toContain("runId=run-1");
    expect(stderr).toContain("status=finished");
    expect(prompt.mock.calls[0]?.[0]).toBe("score this diff");
    expect(prompt.mock.calls[0]?.[1]?.tools).toBeUndefined();
    expect(prompt.mock.calls[0]?.[1]?.disallowedTools).toEqual([
      "shell",
      "edit",
      "delete",
      "applyAgentDiff",
      "task",
      "mcp",
    ]);
    expect(prompt.mock.calls[0]?.[1]?.local?.settingSources).toEqual([]);
  });

  it("uses a no-repo cloud runtime when runtime is cloud", async () => {
    const prompt = vi.fn(async (_message: string, _options?: AgentOptions): Promise<RunResult> => finishedResult());

    const { stderr } = await runReviewAgent("score this diff", {
      apiKey: "cursor_test",
      prompt,
      cwd: "/tmp/review",
      runtime: "cloud",
    });

    expect(stderr).toContain("starting cloud review cwd=/tmp/review");
    expect(prompt.mock.calls[0]?.[1]?.cloud).toEqual({});
    expect(prompt.mock.calls[0]?.[1]?.local).toBeUndefined();
    expect(prompt.mock.calls[0]?.[1]?.disallowedTools).toBeUndefined();
  });

  it("logs token usage on stderr when the run reports it", async () => {
    const prompt = vi.fn(async (): Promise<RunResult> =>
      finishedResult({
        usage: {
          inputTokens: 10,
          outputTokens: 20,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 30,
        },
      }),
    );

    const { stderr } = await runReviewAgent("score this diff", {
      apiKey: "cursor_test",
      prompt,
      cwd: "/tmp",
    });

    expect(stderr).toContain("tokens=30 in=10 out=20");
  });

  it("maps unparseable finished output to exit 2", async () => {
    const prompt = vi.fn(async (): Promise<RunResult> => finishedResult({ result: "not json" }));

    await expect(
      runReviewAgent("score this diff", { apiKey: "cursor_test", prompt, cwd: "/tmp" }),
    ).rejects.toBeInstanceOf(AgentRunFailedError);
  });
});
