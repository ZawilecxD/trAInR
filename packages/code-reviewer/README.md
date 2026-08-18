# code-reviewer

Diff-only scorer for trAInR pull requests. It prints one JSON object matching the six-criterion review schema. Product lint/test/build/deploy stays in `.github/workflows/ci.yml`.

## Local command

Node 22.13+. From this directory:

```bash
npm ci
npm test
npm run typecheck

# Live scoring (requires CURSOR_API_KEY; never commit the key)
export CURSOR_API_KEY="cursor_..."

# Cloud runtime (use this on Linux — local agent.send() currently SIGSEGVs, exit 139)
npm run review -- --runtime cloud --title "PR title" --diff-file fixtures/intentional-flaw.diff

# Local runtime (plan default; works as a unit-tested path, live send is broken on this host)
npm run review -- --runtime local --title "PR title" --diff-file fixtures/intentional-flaw.diff
```

`CURSOR_SDK_RUNTIME=cloud` is equivalent to `--runtime cloud`.

Empty diffs print a skip object (`verdict: "pass"`, summary explaining no changes) and exit 0 without calling a model.

`npm test` stays offline and does not need `CURSOR_API_KEY`. A live run without the key exits 1 with a clear message.

## Writes are forbidden

The scorer must not edit the working tree. Local runs disallow Shell/Edit/Delete (and related tools) and keep `local.settingSources` empty. Cloud runs use a no-repo agent (`cloud: {}`); the diff is already in the prompt. A dirty local worktree after a run is a failed gate.
