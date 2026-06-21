# Token Efficiency for AI Agents

Reduce LLM token usage during trAInR development without changing app behavior or making compressed communication the project default.

## When to Use

Use this workflow when agent sessions feel token-heavy — long command outputs, verbose explanations, or repeated context loading — and you want to cut cost without sacrificing correctness.

| Technique | Saves tokens on | Opt-in? |
| --- | --- | --- |
| **Caveman mode** | Agent prose (explanations, summaries) | Yes — invoke per session |
| **RTK** | Shell command output (`git`, `npm test`, etc.) | Yes — local install per machine |

Skip compression when clarity matters more than cost: security warnings, irreversible operations, onboarding new contributors, or multi-step instructions where terseness could be misread.

## Caveman Mode

Caveman is an ultra-compressed communication style for AI agents. It drops filler and articles while keeping technical terms, code, and error strings exact. Typical savings are on the order of ~75% on agent prose.

**Invoke (any of these in chat):**

- `caveman mode` / `use caveman` / `talk like caveman`
- `/caveman` with optional intensity: `lite`, `full` (default), `ultra`

**Stop:** say `stop caveman` or `normal mode`.

**Intensity levels:**

| Level | Behavior |
| --- | --- |
| `lite` | Tight professional sentences; no filler |
| `full` | Fragments OK; drop articles; short synonyms |
| `ultra` | Abbreviate prose words; arrows for causality; never abbreviate code symbols or API names |

Caveman applies to agent responses only. Code, commits, and PR descriptions should stay in normal style even while caveman is active.

The skill lives in your user-level skills directory (not in this repo). If caveman is unavailable, install or enable the `caveman` skill in Cursor before relying on it.

## RTK

[RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk) is a CLI proxy that filters and compresses common dev-command output before it reaches the agent context. Public docs claim 60–90% savings on supported commands (`git status`, test runners, etc.) with minimal overhead.

RTK is **local-machine tooling**. This repo documents the workflow; it does not install RTK for you or commit shell hook state.

### Pre-install checks (run first)

Always verify what is already installed before running any install command:

```bash
rtk --version
rtk gain
which rtk
```

| Result | Meaning |
| --- | --- |
| `rtk gain` shows token savings stats | Correct **RTK Token Killer** — skip install |
| `rtk gain` says "not a rtk command" | Wrong package (Rust Type Kit name collision) — uninstall and reinstall from upstream |
| `command not found` | RTK not installed — proceed to install below |

### Install (only if pre-checks show RTK is missing)

**Quick install (Linux/macOS):**

```bash
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
```

Installs to `~/.local/bin`. Ensure it is on your PATH:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

**Cargo (explicit upstream — avoids crates.io name collision):**

```bash
cargo install --git https://github.com/rtk-ai/rtk
```

Do **not** rely on blind `cargo install rtk` from crates.io; another unrelated project shares the name.

### Cursor integration (optional)

After install, initialize RTK for your AI tool (example for Cursor):

```bash
rtk init -g --agent cursor
```

Restart Cursor so hooks take effect. Hook behavior may vary by OS; manual prefix (`rtk git status`) always works even when auto-rewrite does not.

## Verification

After install or when resuming work, confirm RTK is the correct binary:

```bash
rtk --version    # should print an rtk-ai/rtk version
rtk gain         # must show token savings dashboard, not an error
which rtk        # note the path for troubleshooting
```

Smoke-test compression on a noisy command:

```bash
rtk git status
```

Output should be shorter than plain `git status` while preserving actionable signal.

For caveman, start a new agent message with `use caveman` and confirm responses compress without losing technical accuracy on a real task.

## Troubleshooting

See also the official [RTK troubleshooting guide](https://www.rtk-ai.app/docs/resources/troubleshooting/).

| Symptom | Fix |
| --- | --- |
| `rtk gain` → "not a rtk command" | Wrong package installed. `cargo uninstall rtk` if needed, then reinstall via upstream script or `cargo install --git https://github.com/rtk-ai/rtk` |
| `rtk` not found after cargo install | Add `~/.cargo/bin` to PATH in `~/.bashrc` or `~/.zshrc`, then reload shell |
| Hooks not rewriting commands | Use manual prefix: `rtk <command>`. On native Windows, full hook support may require WSL |
| Caveman too terse / ambiguous | Switch to `lite` intensity or say `normal mode`; caveman auto-clarity rules drop compression for security and irreversible ops |

## Boundaries

- **Not project default:** Neither caveman nor RTK is required for trAInR work. Do not enable globally in `AGENTS.md` rules or CI.
- **No app changes:** Token optimization here targets agent workflows, not runtime product code.
- **No secrets in repo:** Do not commit `.cursor/mcp.json`, shell profiles, or RTK hook config from your home directory.
- **Verify before trusting:** Always run `rtk gain` after install. A silent wrong-package install wastes debugging time.
- **Code stays normal:** Even in caveman mode, generated code, commit messages, and PR text use standard project conventions.

## References

- RTK repository: [github.com/rtk-ai/rtk](https://github.com/rtk-ai/rtk)
- RTK troubleshooting: [rtk-ai.app/docs/resources/troubleshooting](https://www.rtk-ai.app/docs/resources/troubleshooting/)
- Related repo guidance: `.cursor/skills/10x-e2e/references/browser-driven-generation.md` (prefer lower-token browser transports where applicable)
