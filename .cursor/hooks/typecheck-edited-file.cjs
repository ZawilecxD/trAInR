#!/usr/bin/env node

const { execFileSync } = require("child_process");
const path = require("path");
const {
  readStdin,
  parseJson,
  extractFilePath,
  resolveProjectFile,
  isTypecheckable,
  emitAdditionalContext,
} = require("./lib/edited-file.cjs");

const ROOT = process.cwd();
const TSC = path.join(ROOT, "node_modules", "typescript", "bin", "tsc");
const ESLINT = path.join(ROOT, "node_modules", "eslint", "bin", "eslint.js");
const TIMEOUT_MS = 60000;

function filterTscOutput(output, relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  const lines = output.split("\n");
  const matched = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    return trimmed.startsWith(normalized) || trimmed.startsWith(relativePath);
  });

  return matched.join("\n").trim();
}

function runEslint(relativePath) {
  try {
    execFileSync(
      process.execPath,
      [ESLINT, "--max-warnings", "0", relativePath],
      {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: TIMEOUT_MS,
      },
    );
    return null;
  } catch (error) {
    const stderr = error.stderr?.toString().trim() ?? "";
    const stdout = error.stdout?.toString().trim() ?? "";
    return [stdout, stderr].filter(Boolean).join("\n").trim();
  }
}

function runTscForFile(relativePath) {
  try {
    execFileSync(
      process.execPath,
      [TSC, "-p", "tsconfig.json", "--noEmit", "--pretty", "false"],
      {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: TIMEOUT_MS,
      },
    );
    return null;
  } catch (error) {
    const stderr = error.stderr?.toString().trim() ?? "";
    const stdout = error.stdout?.toString().trim() ?? "";
    const output = filterTscOutput([stdout, stderr].filter(Boolean).join("\n"), relativePath);
    return output || null;
  }
}

async function main() {
  try {
    const raw = await readStdin();
    if (!raw.trim()) return;

    const data = parseJson(raw, {});
    const filePath = extractFilePath(data);
    if (!filePath) return;

    const resolved = resolveProjectFile(filePath, ROOT);
    if (!resolved || !isTypecheckable(resolved.absolutePath)) return;

    const ext = path.extname(resolved.absolutePath).toLowerCase();
    let output = null;
    let mode = "";

    if (ext === ".astro") {
      output = runEslint(resolved.relativePath);
      mode =
        "eslint type-aware checks on the edited .astro file only (full astro check is project-wide)";
    } else {
      output = runTscForFile(resolved.relativePath);
      mode = "tsc project check, reporting only errors in the edited file";
    }

    if (!output) return;

    emitAdditionalContext(
      [
        `Typecheck failed for ${resolved.relativePath} (${mode}). Fix before continuing:`,
        output,
      ].join("\n\n"),
    );
  } catch {
    // fail open
  }
}

main();
