#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const PLANS_DIR = path.join(process.cwd(), ".cursor", "plans");
const MIN_LENGTH = 300;
const MIN_HEADERS = 3;

function readStdin() {
  return new Promise((resolve) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (buf += chunk));
    process.stdin.on("end", () => resolve(buf));
    setTimeout(() => resolve(buf), 3000);
  });
}

function extractContent(data) {
  if (typeof data === "string") return data;

  for (const key of ["response", "message", "content", "text", "output"]) {
    const val = data[key];
    if (typeof val === "string" && val.length > 0) return val;
    if (val && typeof val === "object") {
      const nested = val.content || val.text || val.message;
      if (typeof nested === "string" && nested.length > 0) return nested;
    }
  }

  return "";
}

function looksLikePlan(text) {
  if (text.length < MIN_LENGTH) return false;

  const headers = (text.match(/^#{1,4}\s+.+/gm) || []).length;
  if (headers < MIN_HEADERS) return false;

  const hasLists = /^[\s]*[-*]\s+.+/m.test(text) || /^\s*\d+\.\s+.+/m.test(text);
  if (!hasLists) return false;

  return true;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function extractTitle(text) {
  const match = text.match(/^#{1,3}\s+(.+)/m);
  return match ? slugify(match[1]) : "untitled-plan";
}

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "_",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

async function main() {
  try {
    const raw = await readStdin();
    if (!raw.trim()) return;

    const data = JSON.parse(raw);
    const content = extractContent(data);
    if (!content || !looksLikePlan(content)) return;

    fs.mkdirSync(PLANS_DIR, { recursive: true });

    const now = new Date();
    const ts = formatTimestamp(now);
    const title = extractTitle(content);
    const filename = `${ts}_${title}.md`;
    const filepath = path.join(PLANS_DIR, filename);

    const frontmatter = [
      "---",
      `saved_at: "${now.toISOString()}"`,
      "---",
      "",
      "",
    ].join("\n");

    fs.writeFileSync(filepath, frontmatter + content, "utf8");
  } catch {
    // fail open
  }
}

main();
