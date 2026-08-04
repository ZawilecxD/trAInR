# UI Redesign — Code Implementation — Plan Brief

> Full plan: `context/changes/ui-redesign-implement/plan.md`
> Parent design: `context/changes/ui-redesign/` (ZAW-38)

## What & Why

Ship the cosmic-navy / electric-violet UI from completed Pencil designs into the Astro + React app so every shipped screen matches `DESIGN.md` and `docs/pencil/*.pen`. Design work (ZAW-38) explicitly deferred all `src/` changes; this change is that deferred implementation (ZAW-56).

## Starting Point

Token/fonts foundation largely landed (`5864de5`); leftover `text-white` / `red-*` remain. Layouts still follow pre-redesign structure (e.g. trainer dashboard ≠ Pencil `a0zwyQ`). Shell is Topbar-only; mobile bottom navs are designed but not built. Templates already support modal-on-list; exercises do not.

## Desired End State

Authenticated and public surfaces use one token system and match Pencil at the agreed fidelity: near-pixel for dashboards, guided logging, and auth; structural for authoring; light polish for landing. Desktop Topbar + mobile role bottom navs; honest KPIs only; exercise/template desktop modals with full-page deep links kept.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Fidelity bar | Near-pixel on dashboards / guided logging / auth; structural elsewhere | Balances polish vs dense authoring cost | Plan |
| Sequencing | Foundation → shell → client → trainer hubs → authoring → public/auth | Matches mobile-first client impact + token-first risk reduction | Plan |
| Cut line | All designed screens in this change | Explicit no-cut for complete parity | Plan |
| Unsupported KPIs | Omit / use honest existing summary only | No fake metrics; no new data slice here | Plan |
| CRUD presentation | Desktop modal-on-list; keep `/new` + `/[id]` | Matches Pencil + TemplatesHub pattern | Plan |
| Mobile shell | Client + trainer bottom navs; real routes only | Pencil shell; no Progress/Profile stubs | Plan |
| Client dashboard | Hub from existing trainer + session list data | Closes stub UX without new features | Plan |
| Landing | Light polish only | Avoid marketing rebuild | Plan |
| Authoring | Structural layout match; no form-semantics change | Densest screens, highest rewrite risk | Plan |
| Shared DS | Extract PageShell / EmptyState / StatusBadge as needed | Avoid big-bang component install | Plan |
| OKLCH | Convert in foundation phase | DESIGN.md implementation note | Plan |
| Visual QA | Manual vs export PNGs per phase; no visual CI | Enough signal without new infra | Plan |
| Token leftovers | Dedicated foundation sweep | Prevent dual-palette drift mid-parity | Plan |
| ZAW-55 | Out of scope | Separate Linear follow-up | Plan |
| Empty states | Shared EmptyState on redesigned lists | DESIGN.md inventory | Plan |

## Scope

**In scope:** OKLCH + leftover class sweep; Topbar + bottom navs; all shipped screens restyled to Pencil; desktop exercise/template modals; shared EmptyState/PageShell/StatusBadge; manual export QA.

**Out of scope:** New metrics/features; fake tabs; light mode; Pencil edits; visual-regression CI; ZAW-55; full landing rebuild; form/API/RLS contract changes.

## Architecture / Approach

Single Layout shell gains role bottom navs; pages keep Astro + React islands. Reuse `TemplateFormModal` pattern for exercises. Compose client dashboard from existing services. Trainer dashboard layout follows Pencil chrome but only binds `getTrainerDashboard` fields that exist. Phases gate on lint/check + human visual confirm vs `exports/phase-5*`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Foundation | OKLCH, leftover sweep, shared primitives | OKLCH conversion drift vs DESIGN.md hex |
| 2. App shell | Topbar + client/trainer bottom navs | Duplicate chrome / missing account affordance on mobile |
| 3. Client surfaces | Guided logging, client dashboard hub, calendar | Next-session composition edge cases |
| 4. Trainer hubs | Dashboard, clients, exercises+modal, templates | Modal + route dual-path bugs |
| 5. Trainer authoring | Plan hub, SessionForm, actuals structural match | Accidental form-behavior regressions |
| 6. Public & auth | Landing polish + auth near-pixel | Invite signup distinctness |

**Prerequisites:** Parent `ui-redesign` done; Pencil exports available; branch with `5864de5` baseline.
**Estimated effort:** ~6 sessions (one phase per session), large surface area.

## Open Risks & Assumptions

- Pencil trainer KPI row will look “incomplete” vs mockups when unsupported stats are omitted — accepted.
- Authoring PNG export set may be incomplete vs dashboard MANIFEST — QA may need live `export_nodes`.
- Mobile account/sign-out UX must stay reachable without inventing a Profile tab.

## Success Criteria (Summary)

- Every shipped route matches its Pencil counterpart at the agreed fidelity.
- No fabricated KPIs or nav tabs; dual-palette leftovers cleared on redesigned UI.
- Lint, check, and build pass; manual export checklist complete per phase.
