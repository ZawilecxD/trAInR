#!/usr/bin/env node

/**
 * PR → Linear sync hook (trAInR)
 *
 * postToolUse: detect gh pr create / GitHub MCP create_pull_request → main|master
 * beforeMCPExecution: require user approval before Linear save_issue while sync pending
 * afterMCPExecution: clear pending state after successful save_issue
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROADMAP_PATH = "context/foundation/roadmap.md";
const LINEAR_SKILL = ".cursor/skills/linear-mcp/SKILL.md";
const STATE_DIR = path.join(process.cwd(), ".cursor", "hooks", "state");
const PENDING_PATH = path.join(STATE_DIR, "pr-linear-sync.json");
const MAIN_BRANCHES = new Set(["main", "master"]);

function readStdin() {
  try {
    return Promise.resolve(fs.readFileSync(0, "utf8"));
  } catch {
    return Promise.resolve("");
  }
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

function isPrCreateTool(toolName) {
  return /\bgh\s+pr\s+create\b/.test(toolName) || /create_pull_request/i.test(toolName);
}

function isLinearSaveIssue(toolName) {
  return /save_issue/i.test(toolName || "");
}

function targetsMainBranch(base) {
  if (!base) return true;
  return MAIN_BRANCHES.has(String(base).toLowerCase());
}

function extractBaseFromGhCommand(command) {
  const match = command.match(/(?:--base|-B)\s+(\S+)/);
  return match ? match[1] : null;
}

function extractPrUrl(text) {
  const match = String(text).match(/https:\/\/github\.com\/[^\s"'<>]+\/pull\/\d+/);
  return match ? match[0] : null;
}

function getCurrentBranch(cwd) {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: cwd || process.cwd(),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function gatherCandidates(branch, command, text) {
  const candidates = new Set();
  const haystack = `${branch || ""} ${command || ""} ${text || ""}`;

  for (const match of haystack.matchAll(/\b(ZAW-\d+)\b/gi)) {
    candidates.add(match[1].toUpperCase());
  }

  for (const match of haystack.matchAll(/\b([FS]-\d{2})\b/g)) {
    candidates.add(`slice:${match[1]}`);
  }

  if (branch && branch !== "HEAD") {
    const changeId = branch
      .replace(/^(feat|feature|fix|chore|refactor)\//, "")
      .replace(/_/g, "-");
    if (/^[a-z][a-z0-9-]+$/.test(changeId)) {
      candidates.add(`change-id:${changeId}`);
    }
  }

  try {
    const roadmap = fs.readFileSync(path.join(process.cwd(), ROADMAP_PATH), "utf8");
    for (const candidate of [...candidates]) {
      if (candidate.startsWith("slice:")) {
        const slice = candidate.slice(6);
        const row = roadmap.match(new RegExp(`\\|\\s*${slice}\\s*\\|\\s*([^|]+)\\|`, "i"));
        if (row) candidates.add(`change-id:${row[1].trim()}`);
      }
      if (candidate.startsWith("change-id:")) {
        const changeId = candidate.slice(10);
        const row = roadmap.match(
          new RegExp(`\\|\\s*(F-\\d+|S-\\d+)\\s*\\|\\s*${changeId}\\s*\\|`, "i"),
        );
        if (row) candidates.add(`slice:${row[1]}`);
      }
    }
  } catch {
    // roadmap optional
  }

  return [...candidates];
}

function writePendingState(payload) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(PENDING_PATH, JSON.stringify(truncatedPayload(payload), null, 2), "utf8");
}

function truncatedPayload(payload) {
  return {
    createdAt: new Date().toISOString(),
    prUrl: payload.prUrl,
    branch: payload.branch,
    candidates: payload.candidates,
    command: payload.command,
  };
}

function readPendingState() {
  try {
    return parseJson(fs.readFileSync(PENDING_PATH, "utf8"));
  } catch {
    return null;
  }
}

function clearPendingState() {
  try {
    fs.unlinkSync(PENDING_PATH);
  } catch {
    // ignore
  }
}

function detectShellPrCreate(data) {
  const command = data.tool_input?.command || "";
  if (!/\bgh\s+pr\s+create\b/.test(command)) return null;

  const base = extractBaseFromGhCommand(command);
  if (!targetsMainBranch(base)) return null;

  const toolOutput = parseJson(data.tool_output, {});
  const exitCode = toolOutput.exitCode ?? toolOutput.exit_code;
  if (exitCode != null && exitCode !== 0) return null;

  const stdout = toolOutput.stdout || toolOutput.output || "";
  const combined = `${stdout}\n${command}`;

  return {
    prUrl: extractPrUrl(combined),
    branch: getCurrentBranch(data.cwd),
    command,
    candidates: gatherCandidates(getCurrentBranch(data.cwd), command, combined),
  };
}

function detectMcpPrCreate(data) {
  const toolName = data.tool_name || "";
  if (!/create_pull_request/i.test(toolName)) return null;

  const toolInput = parseJson(data.tool_input, data.tool_input || {});
  const base = toolInput.base || toolInput.baseRefName || toolInput.base_ref || null;
  if (!targetsMainBranch(base)) return null;

  const result = parseJson(data.tool_output, data.tool_output || "");
  const combined = `${JSON.stringify(result)}\n${JSON.stringify(toolInput)}`;

  return {
    prUrl: extractPrUrl(combined),
    branch: toolInput.head || toolInput.headRefName || getCurrentBranch(data.cwd),
    command: JSON.stringify(toolInput),
    candidates: gatherCandidates(
      toolInput.head || toolInput.headRefName || getCurrentBranch(data.cwd),
      combined,
      combined,
    ),
  };
}

function buildAdditionalContext(info) {
  const hints =
    info.candidates.length > 0 ? info.candidates.join(", ") : "none — use branch name and commits";

  return `[pr-linear-sync hook]

A pull request targeting main/master was just created.

PR: ${info.prUrl || "(locate from gh output)"}
Branch: ${info.branch || "(unknown)"}
Search hints: ${hints}

## Required follow-up

Follow \`${LINEAR_SKILL}\`. Use Linear MCP (\`server: user-Linear\`).

1. Search for the related Linear issue (team ZAW, project trAInR MVP) using hints, branch name, and commit messages.
2. **Ask the user to confirm the correct issue** before any update. Show identifier, title, and current status.
3. Only after explicit user confirmation, update via \`save_issue\`:
   - \`links: [{ url: "${info.prUrl || "<PR URL>"}", title: "GitHub PR" }]\`
   - \`state\` → **In Review** (use \`list_issue_statuses\` if the exact name differs)
   - \`save_comment\` with a brief test-plan checklist
4. If no confident match exists, ask the user for the issue ID — do not guess.

Cursor will prompt for approval before Linear \`save_issue\` runs while this PR sync is pending.`;
}

function handlePostToolUse(data) {
  let info = null;

  if (data.tool_name === "Shell") {
    info = detectShellPrCreate(data);
  } else if (isPrCreateTool(data.tool_name || "")) {
    info = detectMcpPrCreate(data);
  }

  if (!info) return;

  writePendingState(info);
  process.stdout.write(
    JSON.stringify({
      additional_context: buildAdditionalContext(info),
    }),
  );
}

function handleBeforeMcpExecution(data) {
  if (!isLinearSaveIssue(data.tool_name)) return;

  const pending = readPendingState();
  if (!pending) return;

  const toolInput = parseJson(data.tool_input, data.tool_input || {});
  const issueId = toolInput.id || toolInput.identifier || null;

  // Creating a new issue (no id) is unrelated to PR sync gating.
  if (!issueId) return;

  const issueLabel = String(issueId);
  const prLabel = pending.prUrl || "the new PR";

  process.stdout.write(
    JSON.stringify({
      permission: "ask",
      user_message: `Approve updating Linear issue ${issueLabel} for PR sync? This should link ${prLabel} and move the issue to In Review. Reject if the agent picked the wrong issue.`,
      agent_message: `PR-linear-sync hook: user must confirm this is the correct Linear issue before save_issue runs. Present issue ${issueLabel}, PR ${prLabel}, and intended status change (In Review + PR link). Wait for user approval or pick a different issue.`,
    }),
  );
}

function handleAfterMcpExecution(data) {
  if (!isLinearSaveIssue(data.tool_name)) return;

  const pending = readPendingState();
  if (!pending) return;

  const result = parseJson(data.result_json, data.result_json || {});
  const failed =
    result?.error ||
    result?.isError === true ||
    (typeof result?.success === "boolean" && !result.success);

  if (failed) return;

  clearPendingState();
}

async function main() {
  try {
    const raw = await readStdin();
    if (!raw.trim()) return;

    const data = parseJson(raw);
    if (!data) return;

    const event = data.hook_event_name || "";

    if (event === "postToolUse") {
      handlePostToolUse(data);
      return;
    }

    if (event === "beforeMCPExecution") {
      handleBeforeMcpExecution(data);
      return;
    }

    if (event === "afterMCPExecution") {
      handleAfterMcpExecution(data);
    }
  } catch {
    // fail open
  }
}

main();
