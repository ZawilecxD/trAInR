const fs = require("fs");
const path = require("path");

const LINTABLE_EXT = new Set([
  ".ts",
  ".tsx",
  ".astro",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);
const TYPECHECK_EXT = new Set([".ts", ".tsx", ".astro"]);

const SKIP_DIR_PARTS = new Set([
  "node_modules",
  "dist",
  ".vercel",
  ".git",
  "coverage",
]);

function readStdin() {
  return new Promise((resolve) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (buf += chunk));
    process.stdin.on("end", () => resolve(buf));
    setTimeout(() => resolve(buf), 3000);
  });
}

function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function extractFilePath(data) {
  if (typeof data.file_path === "string" && data.file_path.length > 0) {
    return data.file_path;
  }

  const toolInput = parseJson(data.tool_input, data.tool_input);
  if (toolInput && typeof toolInput === "object") {
    if (typeof toolInput.path === "string") return toolInput.path;
    if (typeof toolInput.target_notebook === "string") return toolInput.target_notebook;
  }

  return null;
}

function resolveProjectFile(filePath, rootDir = process.cwd()) {
  const absolutePath = path.isAbsolute(filePath)
    ? path.normalize(filePath)
    : path.normalize(path.join(rootDir, filePath));

  const relativeRoot = path.normalize(rootDir);
  if (!absolutePath.startsWith(relativeRoot + path.sep) && absolutePath !== relativeRoot) {
    return null;
  }

  const parts = path.relative(relativeRoot, absolutePath).split(path.sep);
  if (parts.some((part) => SKIP_DIR_PARTS.has(part))) {
    return null;
  }

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return null;
  }

  return { absolutePath, relativePath: path.relative(relativeRoot, absolutePath) };
}

function extensionOf(filePath) {
  return path.extname(filePath).toLowerCase();
}

function isLintable(filePath) {
  return LINTABLE_EXT.has(extensionOf(filePath));
}

function isTypecheckable(filePath) {
  return TYPECHECK_EXT.has(extensionOf(filePath));
}

function emitAdditionalContext(message) {
  process.stdout.write(JSON.stringify({ additional_context: message }));
}

module.exports = {
  readStdin,
  parseJson,
  extractFilePath,
  resolveProjectFile,
  isLintable,
  isTypecheckable,
  emitAdditionalContext,
};
