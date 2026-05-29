# Issue report reference

## Severity guide

| Level | When to use |
|-------|-------------|
| **critical** | Data loss, auth bypass, production down, blocks all users |
| **high** | Core flow broken for many users; no reasonable workaround |
| **medium** | Feature degraded or broken for a subset; workaround exists |
| **low** | Cosmetic, edge case, or nice-to-fix |

## Affected area examples

Be specific enough that `/10x-plan` or `/10x-implement` can grep the codebase:

- Route: `/trainer/exercises/new`
- Component: `ExerciseForm.tsx`
- API: `POST /api/exercises`
- Data: `exercises` table RLS policies
- Infra: Vercel preview deploy, CI lint step

## Parsing issue references

| Input | Resolved `#` |
|-------|----------------|
| `42` | 42 |
| `#42` | 42 |
| `https://github.com/ZawilecxD/trAInR/issues/42` | 42 |
| `https://github.com/ZawilecxD/trAInR/issues/42#issuecomment-123` | 42 |

Reject references to other repos unless the user explicitly overrides.

## GitHub MCP calls

Always `owner=ZawilecxD`, `repo=trAInR`:

```
issue_read { method: "get", issue_number: N, owner, repo }
issue_read { method: "get_comments", issue_number: N, owner, repo }  # when body is thin
```

## Related skills

- **github-mcp** — live issue/PR/CI operations
- **10x-lesson** — recurring rules learned from fixing an issue (different scope: pattern vs incident)
- **10x-new** — start a change folder when the fix becomes planned work
