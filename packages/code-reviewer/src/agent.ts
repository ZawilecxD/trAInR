import { randomUUID } from "node:crypto";
import path from "node:path";
import { tmpdir } from "node:os";
import { Agent, CursorAgentError, JsonlLocalAgentStore } from "@cursor/sdk";
import type { AgentOptions, LocalAgentStore, RunResult } from "@cursor/sdk";
import { parseReview, ReviewParseError } from "./parse-review.ts";
import type { Review } from "./schema.ts";

export const REVIEW_MODEL_ID = "composer-2.5";

export type ReviewRuntime = "local" | "cloud";

/** Mutating tools the scorer must not get. `tools: []` segfaults the local runtime on Linux (exit 139). */
export const DISALLOWED_REVIEW_TOOLS = [
  "shell",
  "edit",
  "delete",
  "applyAgentDiff",
  "task",
  "mcp",
] as const;

export type ReviewPromptFn = (message: string, options?: AgentOptions) => Promise<RunResult>;

export class AgentStartupError extends Error {
  readonly exitCode = 1 as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AgentStartupError";
  }
}

export class AgentRunFailedError extends Error {
  readonly exitCode = 2 as const;
  readonly runId?: string;

  constructor(message: string, runId?: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AgentRunFailedError";
    this.runId = runId;
  }
}

export type RunReviewAgentOptions = {
  apiKey?: string;
  cwd?: string;
  prompt?: ReviewPromptFn;
  store?: LocalAgentStore;
  runtime?: ReviewRuntime;
};

export type RunReviewAgentResult = {
  review: Review;
  stderr: string;
};

function requireApiKey(apiKey: string | undefined): string {
  const trimmed = apiKey?.trim() ?? "";
  if (trimmed === "") {
    throw new AgentStartupError("CURSOR_API_KEY is required to run the reviewer");
  }
  return trimmed;
}

export function resolveReviewRuntime(raw?: string): ReviewRuntime {
  const value = (raw ?? process.env.CURSOR_SDK_RUNTIME ?? "local").trim();
  if (value === "local" || value === "cloud") {
    return value;
  }
  throw new AgentStartupError(`Unknown runtime "${value}" (use local or cloud)`);
}

export function createEphemeralAgentStore(runId = randomUUID()): JsonlLocalAgentStore {
  return new JsonlLocalAgentStore(path.join(tmpdir(), `code-reviewer-${runId}`));
}

export function buildReviewAgentOptions(input: {
  apiKey: string;
  cwd: string;
  store?: LocalAgentStore;
  runtime?: ReviewRuntime;
}): AgentOptions {
  const runtime = input.runtime ?? "local";
  if (runtime === "cloud") {
    // Empty cloud config = no-repo VM (diff is already in the prompt). Do not
    // pass local-only `disallowedTools` / `tools` here — the SDK throws.
    return {
      apiKey: input.apiKey,
      model: { id: REVIEW_MODEL_ID },
      cloud: {},
    };
  }

  return {
    apiKey: input.apiKey,
    model: { id: REVIEW_MODEL_ID },
    disallowedTools: [...DISALLOWED_REVIEW_TOOLS],
    local: {
      cwd: input.cwd,
      settingSources: [],
      store: input.store ?? createEphemeralAgentStore(),
    },
  };
}

export async function runReviewAgent(
  userPrompt: string,
  options: RunReviewAgentOptions = {},
): Promise<RunReviewAgentResult> {
  const apiKey = requireApiKey(options.apiKey ?? process.env.CURSOR_API_KEY);
  const cwd = options.cwd ?? process.cwd();
  const runtime = resolveReviewRuntime(options.runtime);
  const promptFn = options.prompt;
  const agentOptions = buildReviewAgentOptions({ apiKey, cwd, store: options.store, runtime });
  const stderrLines: string[] = [];

  const log = (line: string) => {
    stderrLines.push(line);
    // Live CLI streams progress; injected `prompt` (unit tests) only collects.
    if (promptFn === undefined) {
      process.stderr.write(`${line}\n`);
    }
  };

  log(`starting ${runtime} review cwd=${cwd} node=${process.version}`);

  let result: RunResult;
  try {
    if (promptFn !== undefined) {
      result = await promptFn(userPrompt, agentOptions);
    } else {
      await using agent = await Agent.create(agentOptions);
      log(`agentId=${agent.agentId}`);
      log("calling send");
      const run = await agent.send(userPrompt);
      log(`runId=${run.id} (waiting)`);
      result = await run.wait();
    }
  } catch (error) {
    if (error instanceof CursorAgentError) {
      throw new AgentStartupError(`Cursor agent failed to start: ${error.message}`, { cause: error });
    }
    throw error;
  }

  log(`runId=${result.id} status=${result.status}`);
  if (result.usage) {
    log(`tokens=${result.usage.totalTokens} in=${result.usage.inputTokens} out=${result.usage.outputTokens}`);
  }

  if (result.status === "error" || result.status === "cancelled") {
    const detail = result.error?.message ?? result.status;
    throw new AgentRunFailedError(`Cursor agent run ${result.status}: ${detail}`, result.id);
  }

  try {
    const review = parseReview(result.result ?? "");
    return { review, stderr: `${stderrLines.join("\n")}\n` };
  } catch (error) {
    const message = error instanceof ReviewParseError ? error.message : String(error);
    throw new AgentRunFailedError(`Cursor agent finished but output was not valid review JSON: ${message}`, result.id, {
      cause: error,
    });
  }
}
