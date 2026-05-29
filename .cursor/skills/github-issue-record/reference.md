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

## Title examples (Create mode)

| Summary seed | Title |
|--------------|-------|
| Select dropdown white on white | `fix select dropdown unreadable text on dark theme` |
| Login redirect loops after signout | `fix login redirect loop after signout` |
| RLS blocks trainer from own exercises | `fix exercises RLS policy for trainer owner` |

## Parsing issue references (Sync mode)

| Input | Resolved `#` |
|-------|----------------|
| `42` | 42 |
| `#42` | 42 |
| `https://github.com/ZawilecxD/trAInR/issues/42` | 42 |

Reject references to other repos unless the user explicitly overrides.

## GitHub MCP calls

Always `owner=ZawilecxD`, `repo=trAInR`:

```
# Create (primary)
issue_write { method: "create", title, body, labels: ["bug"], owner, repo }

# Duplicate check before create
search_issues { query: "<keywords> repo:ZawilecxD/trAInR", owner, repo }

# Sync existing
issue_read { method: "get", issue_number: N, owner, repo }
```

## Related skills

- **github-mcp** — issue/PR/CI operations
- **10x-lesson** — recurring rules learned from fixing an issue
- **10x-new** — start a change folder when the fix becomes planned work
