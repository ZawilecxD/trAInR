# code-reviewer

Diff-only scorer for trAInR pull requests. It prints one JSON object matching the six-criterion review schema. Product lint/test/build/deploy stays in `.github/workflows/ci.yml`.

## Local command

Node 22.13+. From this directory:

```bash
npm ci
npm test

git diff | npx tsx src/cli.ts --title "PR title"
npx tsx src/cli.ts --title "PR title" --diff-file /tmp/pr.diff
```

Empty diffs print a skip object (`verdict: "pass"`, summary explaining no changes) and exit 0 without calling a model.

Until the Cursor SDK adapter is wired, a non-empty diff without `--fixture-assistant` exits with `agent not wired`. Tests stay offline: no `CURSOR_API_KEY` is required for `npm test`.

Live scoring (later) uses `CURSOR_API_KEY`. Never commit the key.

## Writes are forbidden

Once `@cursor/sdk` is wired, the local agent is a scorer, not an implementer. Write, Shell, and any other mutating tool must be denied. `local.settingSources` stays empty so project skills cannot pull the agent into implementation mode. A dirty worktree after a run is a failed gate.
