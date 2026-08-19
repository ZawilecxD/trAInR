import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AgentRunFailedError, AgentStartupError, runReviewAgent, type ReviewRuntime } from "./agent.ts";
import { parseReview, ReviewParseError } from "./parse-review.ts";
import { buildReviewPrompt } from "./prompt.ts";
import { emptyDiffReview, type Review } from "./schema.ts";

const USAGE = `Usage: tsx src/cli.ts --title <title> [--diff-file <path>] [--runtime local|cloud] [--fixture-assistant <path>]

Reads a git diff from stdin when --diff-file is omitted.
Empty diffs print a skip JSON object and exit 0.
Live scoring requires CURSOR_API_KEY. --fixture-assistant stays available for offline tests.
On this Linux host the local SDK runtime currently SIGSEGVs at send(); use --runtime cloud for live scoring.
`;

export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

export type CliArgs = {
  title: string;
  diffFile?: string;
  fixtureAssistant?: string;
  runtime?: ReviewRuntime;
};

export function parseCliArgs(argv: string[]): CliArgs {
  let title: string | undefined;
  let diffFile: string | undefined;
  let fixtureAssistant: string | undefined;
  let runtime: ReviewRuntime | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--help" || arg === "-h") {
      throw new CliError(USAGE.trimEnd(), 0);
    }

    if (arg === "--title") {
      if (next === undefined || next.startsWith("--")) {
        throw new CliError("--title requires a value");
      }
      title = next;
      i += 1;
      continue;
    }

    if (arg === "--diff-file") {
      if (next === undefined || next.startsWith("--")) {
        throw new CliError("--diff-file requires a path");
      }
      diffFile = next;
      i += 1;
      continue;
    }

    if (arg === "--runtime") {
      if (next !== "local" && next !== "cloud") {
        throw new CliError("--runtime must be local or cloud");
      }
      runtime = next;
      i += 1;
      continue;
    }

    if (arg === "--fixture-assistant") {
      if (next === undefined || next.startsWith("--")) {
        throw new CliError("--fixture-assistant requires a path");
      }
      fixtureAssistant = next;
      i += 1;
      continue;
    }

    throw new CliError(`Unknown argument: ${arg ?? ""}`);
  }

  if (title === undefined || title.trim() === "") {
    throw new CliError("--title is required");
  }

  return { title, diffFile, fixtureAssistant, runtime };
}

export type RunCliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type RunCliOptions = {
  stdinText?: string;
  stdin?: NodeJS.ReadableStream;
  apiKey?: string;
  cwd?: string;
  runAgent?: typeof runReviewAgent;
};

function formatReview(review: Review): string {
  return `${JSON.stringify(review, null, 2)}\n`;
}

async function readStdin(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function errorResult(error: unknown): RunCliResult {
  if (error instanceof CliError) {
    const text = `${error.message}\n`;
    return error.exitCode === 0
      ? { exitCode: 0, stdout: text, stderr: "" }
      : { exitCode: error.exitCode, stdout: "", stderr: text };
  }

  if (error instanceof AgentStartupError) {
    return { exitCode: 1, stdout: "", stderr: `${error.message}\n` };
  }

  if (error instanceof AgentRunFailedError || error instanceof ReviewParseError) {
    return { exitCode: 2, stdout: "", stderr: `${error.message}\n` };
  }

  const message = error instanceof Error ? error.message : String(error);
  return { exitCode: 1, stdout: "", stderr: `${message}\n` };
}

export async function runCli(argv: string[], options: RunCliOptions = {}): Promise<RunCliResult> {
  try {
    const args = parseCliArgs(argv);
    const diff =
      args.diffFile !== undefined
        ? await readFile(args.diffFile, "utf8")
        : (options.stdinText ?? (options.stdin !== undefined ? await readStdin(options.stdin) : ""));

    if (diff.trim() === "") {
      return { exitCode: 0, stdout: formatReview(emptyDiffReview), stderr: "" };
    }

    const prompt = buildReviewPrompt({ title: args.title, diff });

    if (args.fixtureAssistant !== undefined) {
      const assistantText = await readFile(args.fixtureAssistant, "utf8");
      return { exitCode: 0, stdout: formatReview(parseReview(assistantText)), stderr: "" };
    }

    const runAgent = options.runAgent ?? runReviewAgent;
    const { review, stderr } = await runAgent(prompt, {
      apiKey: options.apiKey ?? process.env.CURSOR_API_KEY,
      cwd: options.cwd ?? process.cwd(),
      runtime: args.runtime,
    });
    return { exitCode: 0, stdout: formatReview(review), stderr };
  } catch (error) {
    return errorResult(error);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const hasDiffFile = argv.includes("--diff-file");
  const stdinText = hasDiffFile || process.stdin.isTTY ? "" : await readStdin(process.stdin);
  const result = await runCli(argv, { stdinText });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  // Live agent runs already streamed progress to stderr. Re-emit only on failure.
  if (result.stderr && result.exitCode !== 0) {
    process.stderr.write(result.stderr);
  }
  process.exitCode = result.exitCode;
}

function isCliEntry(): boolean {
  const self = fileURLToPath(import.meta.url);
  return process.argv.some((arg) => path.resolve(arg) === self);
}

if (isCliEntry()) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
