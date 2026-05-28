#!/usr/bin/env node

/**
 * PR → Linear sync hook (trAInR)
 *
 * postToolUse: detect gh pr create / GitHub MCP create_pull_request → main|master
 * postToolUse: detect gh pr merge / GitHub MCP merge_pull_request → main|master
 * beforeMCPExecution: require user approval before Linear save_issue / save_comment while sync pending
 * afterMCPExecution: clear pending state after successful save_issue and save_comment
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

function isPrMergeTool(toolName) {
  return /\bgh\s+pr\s+merge\b/.test(toolName) || /merge_pull_request/i.test(toolName);
}

function isLinearSaveIssue(toolName) {
  return /save_issue/i.test(toolName || "");
}

function isLinearSaveComment(toolName) {
  return /save_comment/i.test(toolName || "");
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
    createdAt: payload.createdAt || new Date().toISOString(),
    prUrl: payload.prUrl,
    branch: payload.branch,
    candidates: payload.candidates,
    command: payload.command,
    issueSynced: payload.issueSynced === true,
    commentSynced: payload.commentSynced === true,
  };
}

function buildPrCommentBody(prUrl) {
  const url = prUrl || "<PR URL>";
  return `**GitHub PR:** ${url}

## Test plan
- [ ] CI passes (lint + build)
- [ ] Manual smoke test on preview deploy`;
}

function buildMergeAdditionalContext(info) {
  const hints =
    info.candidates.length > 0 ? info.candidates.join(", ") : "none — use merged PR context";
  const phaseIssues = info.phaseIssues?.length ? info.phaseIssues.join(", ") : "(none mapped)";

  return `[pr-linear-sync hook]

A pull request targeting main/master was just merged.

PR: ${info.prUrl || "(locate from gh output)"}
Branch: ${info.branch || "(unknown)"}
Search hints: ${hints}
Mapped phase issues: ${phaseIssues}

## Required follow-up

Follow \`${LINEAR_SKILL}\`. Use Linear MCP (\`server: user-Linear\`).

1. Resolve the parent issue for this merged PR and ask the user to confirm it.
2. Confirm each mapped phase child issue is Done (if not, move to Done-like state).
3. Move the parent issue to **Done** (use \`list_issue_statuses\` if exact name differs).
4. Post a completion comment on the parent issue with merged PR link and note that all phases are complete.
5. If issue resolution is ambiguous, ask the user for explicit identifier and stop guessing.`;
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

function detectShellPrMerge(data) {
  const command = data.tool_input?.command || "";
  if (!/\bgh\s+pr\s+merge\b/.test(command)) return null;

  const base = extractBaseFromGhCommand(command);
  if (!targetsMainBranch(base)) return null;

  const toolOutput = parseJson(data.tool_output, {});
  const exitCode = toolOutput.exitCode ?? toolOutput.exit_code;
  if (exitCode != null && exitCode !== 0) return null;

  const stdout = toolOutput.stdout || toolOutput.output || "";
  const combined = `${stdout}\n${command}`;
  const branch = getCurrentBranch(data.cwd);
  const candidates = gatherCandidates(branch, command, combined);
  const phaseIssues = [];
  for (const item of candidates) {
    if (item.startsWith("change-id:")) {
      const changeId = item.slice(10);
      const changePath = path.join(process.cwd(), "context", "changes", changeId, "change.md");
      try {
        const content = fs.readFileSync(changePath, "utf8");
        for (const match of content.matchAll(/\b(ZAW-\d+)\b/gi)) {
          const key = match[1].toUpperCase();
          if (!phaseIssues.includes(key)) phaseIssues.push(key);
        }
      } catch {
        // best-effort
      }
    }
  }

  return {
    prUrl: extractPrUrl(combined),
    branch,
    command,
    candidates,
    phaseIssues,
  };
}

function detectMcpPrMerge(data) {
  const toolName = data.tool_name || "";
  if (!/merge_pull_request/i.test(toolName)) return null;

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
    phaseIssues: [],
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
3. Only after explicit user confirmation, update via \`save_issue\` on that issue:
   - \`links: [{ url: "${info.prUrl || "<PR URL>"}", title: "GitHub PR" }]\`
   - \`state\` → **In Review** (use \`list_issue_statuses\` if the exact name differs)
4. On the **same** confirmed issue, call \`save_comment\` (separate tool call):
   - \`issueId\`: the confirmed issue id or identifier (e.g. ZAW-9)
   - \`body\`: use this markdown exactly (real newlines, not \\\\n):

${buildPrCommentBody(info.prUrl)}

5. If no confident match exists, ask the user for the issue ID — do not guess.

Cursor will prompt for approval before Linear \`save_issue\` and \`save_comment\` run while this PR sync is pending.`;
}

function handlePostToolUse(data) {
  let info = null;

  if (data.tool_name === "Shell") {
    info = detectShellPrCreate(data);
    if (!info) info = detectShellPrMerge(data);
  } else if (isPrCreateTool(data.tool_name || "")) {
    info = detectMcpPrCreate(data);
  } else if (isPrMergeTool(data.tool_name || "")) {
    info = detectMcpPrMerge(data);
  }

  if (!info) return;

  if (isPrMergeTool(data.tool_name || "") || /\bgh\s+pr\s+merge\b/.test(data.tool_input?.command || "")) {
    process.stdout.write(
      JSON.stringify({
        additional_context: buildMergeAdditionalContext(info),
      }),
    );
    return;
  }

  writePendingState(info);
  process.stdout.write(
    JSON.stringify({
      additional_context: buildAdditionalContext(info),
    }),
  );
}

function handleBeforeMcpExecution(data) {
  const pending = readPendingState();
  if (!pending) return;

  const toolInput = parseJson(data.tool_input, data.tool_input || {});
  const prLabel = pending.prUrl || "the new PR";

  if (isLinearSaveIssue(data.tool_name)) {
    const issueId = toolInput.id || toolInput.identifier || null;

    // Creating a new issue (no id) is unrelated to PR sync gating.
    if (!issueId) return;

    const issueLabel = String(issueId);

    process.stdout.write(
      JSON.stringify({
        permission: "ask",
        user_message: `Approve updating Linear issue ${issueLabel} for PR sync? This should link ${prLabel} and move the issue to In Review. Reject if the agent picked the wrong issue.`,
        agent_message: `PR-linear-sync hook: user must confirm this is the correct Linear issue before save_issue runs. Present issue ${issueLabel}, PR ${prLabel}, and intended status change (In Review + PR link). Wait for user approval or pick a different issue.`,
      }),
    );
    return;
  }

  if (isLinearSaveComment(data.tool_name)) {
    // Updates to existing comments are unrelated to PR sync.
    if (toolInput.id) return;

    const issueId = toolInput.issueId || toolInput.issue_id || null;
    const issueLabel = issueId ? String(issueId) : "the target issue";

    process.stdout.write(
      JSON.stringify({
        permission: "ask",
        user_message: `Approve posting a PR link comment on Linear ${issueLabel}? Comment should include ${prLabel}. Reject if the agent picked the wrong issue.`,
        agent_message: `PR-linear-sync hook: user must confirm save_comment targets the correct issue (${issueLabel}) before posting PR link ${prLabel}. Use the PR comment body from hook context.`,
      }),
    );
  }
}

function mcpExecutionFailed(result) {
  return (
    result?.error ||
    result?.isError === true ||
    (typeof result?.success === "boolean" && !result.success)
  );
}

function markSyncProgress(field) {
  const pending = readPendingState();
  if (!pending) return;

  const updated = { ...pending, [field]: true };
  if (updated.issueSynced && updated.commentSynced) {
    clearPendingState();
  } else {
    writePendingState(updated);
  }
}

function handleAfterMcpExecution(data) {
  const pending = readPendingState();
  if (!pending) return;

  const result = parseJson(data.result_json, data.result_json || {});
  if (mcpExecutionFailed(result)) return;

  if (isLinearSaveIssue(data.tool_name)) {
    markSyncProgress("issueSynced");
    return;
  }

  if (isLinearSaveComment(data.tool_name)) {
    markSyncProgress("commentSynced");
  }
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
