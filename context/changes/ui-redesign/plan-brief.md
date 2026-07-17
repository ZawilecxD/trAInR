# UI Redesign — Missing Design Coverage — Plan Brief

> Full plan: `context/changes/ui-redesign/plan.md`
> Research: `context/changes/ui-redesign/research.md`

## What & Why

Two Pencil design files already exist and set a strong visual direction, but they only cover part of the app. This plan audits them and **creates the missing screen designs on one unified token foundation**, so every screen in the current 19-page app has a consistent, agent-implementable design before any code-side redesign begins.

## Starting Point

`docs/pencil/trainer_dashboard.pen` and `docs/pencil/guided_workout_logging.pen` already design the trainer authoring surface (desktop) and the core client/logging happy path (mobile), in a cosmic-navy + purple aesthetic with a Geist + JetBrains Mono type pairing. There is no shared design-system frame and no `DESIGN.md`. The codebase has grown past the research snapshot — guided logging, the client side, and session comments are all shipped.

## Desired End State

Every screen in the app is designed at both desktop and mobile breakpoints, all sharing one honest token set, backed by a dedicated design-system frame and a committed `DESIGN.md` (referenced from `AGENTS.md`) that a future agent can use to unify the tokens in code.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Token contradiction (navy frames vs. orange variable table) | Navy/purple is canonical; rebuild the variable table to match | The frames + research agree; the orange table is a stale Pencil default | Plan |
| Plan scope | Design coverage only (audit + create missing); code work deferred | Get designs right before touching ~30 code files | Plan |
| Priority order | Foundation → client-facing → trainer → public/auth | Dashboards/client screens are the biggest UX gap per research | Plan |
| Where new designs live | New files by surface (`trainer_authoring.pen`, `public_auth.pen`) + extend `guided_workout_logging.pen` | Matches per-flow file convention; keeps the 20k-line dashboard file manageable | Plan |
| Design-system artifact | Dedicated DS frame + committed `DESIGN.md`, built first | Guarantees consistency + gives agents a machine-readable spec | Plan |
| Public/auth coverage | Full set: landing + signin + signup (incl. invite variant) + confirm-email | Onboarding first impression matters | Plan |
| Responsive coverage | Both desktop AND mobile for every new screen (+ backfill existing) | Complete, unambiguous responsive spec | Plan |

## Scope

**In scope:** rebuild `.pen` token table; design-system frame + `DESIGN.md`; design all undesigned screens (completed/edit-window/comments, client plan hub, session builder, actuals review, landing, auth) at both breakpoints; backfill responsive variants for the two existing files; consistency audit.

**Out of scope:** any `src/` code changes, `globals.css`/OKLCH generation, Google Stitch, new features/IA, light mode.

## Architecture / Approach

All work is produced through the **Pencil MCP** as `.pen` files plus a `DESIGN.md`. Phase 1 builds the token system + component library; every later screen reuses those components via `ref` nodes so a token edit propagates. One `.pen` file per surface. Each screen follows the house pattern: screen frame + a 420px Design Spec annotation panel citing functional requirements. Validation is `snapshot_layout(problemsOnly: true)` + `export_nodes` screenshots per phase.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Design-system foundation | Rebuilt tokens, DS component frame, `DESIGN.md` + `AGENTS.md` ref | Token extraction must come from frame fills, not the stale variable table |
| 2. Client-facing gaps | Completed view, edit-window flow, session comments (mobile + desktop) | Sealed/read-only state must be visually distinct |
| 3. Trainer authoring gaps | Client plan hub, session builder (new/edit), actuals review | Dense builder + split-pane must work at 1440px and degrade to mobile |
| 4. Public & auth surface | Landing, signin, signup (+ invite variant), confirm-email | Landing is a larger marketing-style effort |
| 5. Responsive parity + audit | Backfill breakpoints for existing files; consistency audit | Volume; keeping all files token-consistent |

**Prerequisites:** Pencil MCP available and `.pen` files openable in the editor (every Pencil tool requires the target file open). `DESIGN.md` derived from the existing frames.
**Estimated effort:** ~5 phases; large — driven by "both breakpoints for every screen" (~15 new screens × 2 + backfill).

## Open Risks & Assumptions

- **Pencil file lifecycle:** every phase requires the target `.pen` file open in the editor; tools fail otherwise. Assumes the operator opens files on request.
- **Token table rebuild** is the linchpin — if skipped, downstream code work inherits the wrong (orange) palette.
- **Volume:** "both breakpoints everywhere" roughly doubles the design count; phases 2–5 are sizeable.
- Assumes the existing cosmic-navy/purple direction is final (confirmed against research + screenshots).

## Success Criteria (Summary)

- Every one of the app's 19 pages has a design at desktop + mobile, all using one token set.
- A design-system frame + `DESIGN.md` exist and are referenced from `AGENTS.md`.
- `snapshot_layout(problemsOnly: true)` is clean across all files and `get_variables` returns the navy/purple tokens everywhere.
