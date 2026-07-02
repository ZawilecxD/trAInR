# Design Agent Skills

trAInR adopts both installed UI craft skills:

- `frontend-design` for aesthetic direction before building or reshaping a UI.
- `impeccable` for production-grade UI iteration, critique, polish, audit, and design-system-aware implementation.

They are complementary, not duplicates. Keep both installed unless one starts conflicting with repo conventions or becomes stale enough to create repeated correction work.

## Fit For trAInR

trAInR is an Astro 6 SSR app with React 19 islands, Tailwind CSS 4, and shadcn/ui. Both skills fit this stack because they guide design judgment and code quality rather than requiring a framework-specific runtime.

`frontend-design` is lightweight and useful at the start of UI work. It helps avoid generic AI aesthetics by forcing a subject-specific design thesis, stronger typography, and one justified aesthetic risk.

`impeccable` is broader and more operational. It includes commands for shaping, crafting, auditing, polishing, hardening, animation, layout, typography, color, and live browser iteration. It should be used when a UI task needs production readiness, accessibility checks, responsive behavior, or a full visual quality pass.

## Routing

Use `frontend-design` when the user asks to create or redesign a component, page, flow, empty state, landing surface, or visual direction and the first question is "what should this feel like?"

Use `impeccable` when the user asks to design, critique, audit, polish, harden, optimize, animate, improve layout, improve typography, improve colors, or iterate on an existing interface. Also use it when the task names one of its command verbs, such as `craft`, `shape`, `audit`, `polish`, `harden`, `layout`, `typeset`, `colorize`, `clarify`, or `live`.

Use both on larger UI work: start with `frontend-design` to set the visual point of view, then use `impeccable` to implement, critique, and harden the result.

Do not use either skill for backend-only work, database migrations, Supabase RLS policy changes, Linear/GitHub administration, or test-only changes unless the test directly verifies UI behavior.

## Repo Context

The installed skills live under `.agents/skills/` and are tracked in `skills-lock.json`.

Current installs:

```bash
npx skills add https://github.com/anthropics/skills --skill frontend-design
npx skills add https://github.com/pbakaus/impeccable --skill impeccable
```

Project-level design context:

- `PRODUCT.md` describes the product register, users, purpose, brand personality, anti-references, and accessibility expectations.
- `DESIGN.md` describes the current visual system: athletic intelligence, dark gym-friendly surfaces, Geist typography, JetBrains Mono metadata, touch targets, status colors, and core UI components.
- `docs/stitch-ui-design-prompt.md` contains a fuller screen-by-screen prompt set for external UI exploration.

## trAInR Rules For Skill Output

All skill output must still follow `AGENTS.md`:

- No Next.js directives.
- Use Astro for static pages/layout and React only for islands that need interactivity.
- Use `cn()` from `@/lib/utils` for conditional Tailwind classes.
- Prefer shadcn/ui primitives already present in `src/components/ui/`.
- Keep React hooks in `src/components/hooks/`.
- Preserve Supabase auth, role boundaries, and RLS assumptions.
- Keep client workout logging mobile-first with accessible touch targets and explicit save/error state.

## Validation

Before considering UI work done:

- Confirm the agent selected the right skill route for the task.
- Check the output against `PRODUCT.md`, `DESIGN.md`, and `AGENTS.md`.
- Run the relevant verification for the touched surface: `npm run lint`, focused unit/integration tests, or Playwright E2E when the task changes a browser flow.
- For visual work, prefer a screenshot or browser check when practical.
