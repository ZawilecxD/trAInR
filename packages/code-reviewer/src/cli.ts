import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReviewPrompt } from "./prompt.ts";
import { parseReview } from "./parse-review.ts";
import { emptyDiffReview, type Review } from "./schema.ts";

const USAGE = `Usage: tsx src/cli.ts --title <title> [--diff-file <path>] [--fixture-assistant <path>]

Reads a git diff from stdin when --diff-file is omitted.
Empty diffs print a skip JSON object and exit 0.
Until the SDK adapter is wired, pass --fixture-assistant or get "agent not wired".
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
};

export function parseCliArgs(argv: string[]): CliArgs {
  let title: string | undefined;
  let diffFile: string | undefined;
  let fixtureAssistant: string | undefined;

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

  return { title, diffFile, fixtureAssistant };
}

export type RunCliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
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

export async function runCli(
  argv: string[],
  options: { stdinText?: string; stdin?: NodeJS.ReadableStream } = {},
): Promise<RunCliResult> {
  try {
    const args = parseCliArgs(argv);
    const diff =
      args.diffFile !== undefined
        ? await readFile(args.diffFile, "utf8")
        : (options.stdinText ?? (options.stdin !== undefined ? await readStdin(options.stdin) : ""));

    if (diff.trim() === "") {
      return { exitCode: 0, stdout: formatReview(emptyDiffReview), stderr: "" };
    }

    buildReviewPrompt({ title: args.title, diff });

    if (args.fixtureAssistant === undefined) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: "agent not wired (phase 1); pass --fixture-assistant <file> or wait for the SDK adapter\n",
      };
    }

    const assistantText = await readFile(args.fixtureAssistant, "utf8");
    const review = parseReview(assistantText);
    return { exitCode: 0, stdout: formatReview(review), stderr: "" };
  } catch (error) {
    if (error instanceof CliError) {
      const stream = error.exitCode === 0 ? "stdout" : "stderr";
      const text = `${error.message}\n`;
      return stream === "stdout"
        ? { exitCode: 0, stdout: text, stderr: "" }
        : { exitCode: error.exitCode, stdout: "", stderr: text };
    }

    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 1, stdout: "", stderr: `${message}\n` };
  }
}

async function main(): Promise<void> {
  const stdinText = process.stdin.isTTY ? "" : await readStdin(process.stdin);
  const result = await runCli(process.argv.slice(2), { stdinText });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exitCode = result.exitCode;
}

const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  void main();
}
