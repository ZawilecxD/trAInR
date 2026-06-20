#!/usr/bin/env node

const { execFileSync } = require("child_process");
const path = require("path");
const {
  readStdin,
  parseJson,
  extractFilePath,
  resolveProjectFile,
  isLintable,
  emitAdditionalContext,
} = require("./lib/edited-file.cjs");

const ROOT = process.cwd();
const ESLINT = path.join(ROOT, "node_modules", "eslint", "bin", "eslint.js");
const TIMEOUT_MS = 45000;

async function main() {
  try {
    const raw = await readStdin();
    if (!raw.trim()) return;

    const data = parseJson(raw, {});
    const filePath = extractFilePath(data);
    if (!filePath) return;

    const resolved = resolveProjectFile(filePath, ROOT);
    if (!resolved || !isLintable(resolved.absolutePath)) return;

    try {
      execFileSync(
        process.execPath,
        [ESLINT, "--max-warnings", "0", resolved.relativePath],
        {
          cwd: ROOT,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: TIMEOUT_MS,
        },
      );
    } catch (error) {
      const stderr = error.stderr?.toString().trim() ?? "";
      const stdout = error.stdout?.toString().trim() ?? "";
      const output = [stdout, stderr].filter(Boolean).join("\n").trim();
      if (!output) return;

      emitAdditionalContext(
        [
          `Lint failed for ${resolved.relativePath} (eslint on edited file only). Fix before continuing:`,
          output,
        ].join("\n\n"),
      );
    }
  } catch {
    // fail open
  }
}

main();
