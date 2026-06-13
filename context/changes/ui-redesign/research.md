---
date: 2026-06-12T15:26:00+02:00
researcher: AI Agent (Cursor)
git_commit: 828cbc4
branch: s-04-plan-assignment
repository: ZawilecxD/trAInR
topic: "UI Redesign: design system strategy, AI tool selection, and UX considerations"
tags: [research, ui, ux, design-system, shadcn, tailwind, google-stitch, pencil-dev, redesign]
status: complete
last_updated: 2026-06-12
last_updated_by: AI Agent (Cursor)
---

# Research: UI Redesign — Design System Strategy, AI Tool Selection & UX Considerations

**Date**: 2026-06-12T15:26:00+02:00
**Git Commit**: 828cbc4
**Branch**: s-04-plan-assignment
**Repository**: ZawilecxD/trAInR

## Research Question

Redesigning the web app for a nice-looking, comprehensive, and easy-to-use UI with great UX. Using AI tools like Google Stitch and Pencil.dev to create a design system. Key questions: (1) what to consider for trAInR specifically, (2) should we keep using shadcn and just style it, (3) what output from an AI design tool is most suitable for AI agent implementation.

---

## Summary

**Keep shadcn — yes, unconditionally.** The architecture is sound. The problem is that the app runs two parallel visual systems: the shadcn semantic token layer (`bg-primary`, `text-foreground`) and a hardcoded "cosmic" dark palette (`purple-500`, `bg-cosmic`, `text-white`). These have drifted apart. The right move is to unify them into one token-driven system and extend it with custom brand tokens.

**For AI agent implementation, the optimal workflow is:**
1. Generate visual direction and a `DESIGN.md` spec from **Google Stitch** (open-source spec format, Apache 2.0, April 2026)
2. Use **Pencil.dev** to generate the exact `globals.css` CSS variable block (Tailwind v4 + shadcn-compatible, MCP-integrated with Cursor)
3. Paste the generated `:root` / `.dark` block into `src/styles/global.css`
4. Then use agents to systematically replace hardcoded palette classes (`purple-500`, `text-white`, `bg-white/10`) with semantic token utilities across ~30 files

**UX priority:** both dashboards are placeholder screens — that is the single biggest UX gap. The dark cosmic aesthetic is correctly positioned for premium B2B SaaS (aligned with WHOOP, Peloton). Keep purple as the primary interaction color; add amber only for achievement/PR moments.

---

## Detailed Findings

### 1. Current UI Inventory

#### Pages (17 Astro + 11 API routes)

| Area | Pages | Status |
|------|-------|--------|
| Public | `/`, `/auth/*` | Built |
| Trainer | `/trainer/dashboard`, `/trainer/clients/*`, `/trainer/exercises/*`, `/trainer/templates/*` | Built (dashboard is placeholder) |
| Client | `/client/dashboard` | Placeholder only |

The trainer workflow is functional end-to-end: invite clients → exercise library → session templates → assign sessions on client calendar. The client side is entirely unbuilt beyond a stub dashboard.

#### Components

- **7 shadcn/ui primitives installed:** `Button`, `Input`, `Badge`, `Calendar`, `AlertDialog`, `Sonner` (+ orphaned `LibBadge.astro`)
- **Not installed but needed:** `Card`, `Dialog`, `Form`, `Label`, `Select`, `Table`, `Tabs`, `Sheet`
- **14 React feature components** across auth, exercises, session templates, workout sessions, plans, trainer panels

Key reference: `src/components/ui/` (7 files), `src/components/auth/` (6 files), `src/components/exercises/` (2 files), `src/components/session-templates/` (2 files), `src/components/workout-sessions/` (2 files), `src/components/plans/` (2 files), `src/components/trainer/` (1 file).

#### Layout

Single layout (`src/layouts/Layout.astro`) with a horizontal top nav (`Topbar.astro`). No sidebar, no nested layouts, no role-specific shell.

---

### 2. The Dual Design System Problem

This is the root cause of all visual debt.

**System A — shadcn semantic tokens** (lives in `src/styles/global.css` `:root` / `.dark`):
- Full OKLCH token set: `--background`, `--foreground`, `--primary`, `--muted`, `--accent`, `--destructive`, `--border`, `--ring`, `--chart-1..5`, `--sidebar-*`, `--radius`
- Wired into Tailwind 4 via `@theme inline` block (lines 75–111)
- Consumed by: 7 shadcn `ui/*` component files
- **Dark mode scaffolding exists but `.dark` is never applied to `<html>`**

**System B — hardcoded cosmic palette** (spread across ~30 files):
- `bg-cosmic` (`global.css:113-115`) — hex gradient `#0a0e1a → #0f1529`
- `bg-slate-950/85` topbar
- `border-white/10 bg-white/10 backdrop-blur-xl` glass cards
- `text-blue-200`, `text-purple-300`, `bg-purple-500/600` — CTAs and accents
- `text-white`, `text-blue-100/70` — body text

**The collision:** shadcn `Button` uses `bg-primary` internally, then every call site overrides with `className="bg-purple-500 text-white"`. Same pattern for `Input` — `FormField.tsx:5-6` bypasses `ui/input.tsx` entirely with inline custom classes. This is technical debt that will compound with every new component.

**Injection reality:** Replacing `:root` CSS variables in `global.css` alone would only change ~20% of the visible UI (the 7 shadcn primitives). The remaining ~80% requires systematically replacing hardcoded Tailwind palette classes across 30+ page and feature component files.

---

### 3. Design Token Architecture (Tailwind CSS 4 CSS-first)

**No `tailwind.config.*` file exists** — correct for Tailwind CSS 4. All configuration lives in `src/styles/global.css`:
- `@import "tailwindcss"` 
- `@custom-variant dark (&:is(.dark *))`
- `@import "tw-animate-css"`
- `:root { }` OKLCH tokens
- `.dark { }` OKLCH overrides
- `@theme inline { }` mapping CSS vars to Tailwind utilities
- `@utility bg-cosmic { }` custom utility
- `@layer base { }` global resets

**shadcn config (`components.json`):**
- Style: `new-york`
- Base color: `neutral`
- CSS variables: `true`
- Tailwind config: `""` (CSS-first, correct for TW4)
- CSS entry: `src/styles/global.css`

**No custom fonts** — system UI stack only. No `@font-face`, no Google Fonts, no `--font-*` tokens. This is a significant gap: adding a custom typeface would give the most visual lift per effort.

---

### 4. Google Stitch vs. Pencil.dev

#### Google Stitch

- **What it is:** Google Labs AI design system generator (stitch.withgoogle.com). Prompt-driven; generates complete design systems with color palettes, typography scales, component styles.
- **Output format:** Figma files + CSS variable export. As of April 2026, open-sourced the **DESIGN.md** specification format (Apache 2.0) — a markdown file describing the design system that AI agents can read directly.
- **Best use for trAInR:** Generate the visual direction (colors, typography, spacing philosophy) and export a `DESIGN.md` → commit to repo root → reference in `AGENTS.md`.
- **Gotcha:** Color output is **hex** (`#0099e5`). shadcn/ui v4 uses **OKLCH**. Requires a conversion pass before pasting into `global.css`.
- **Tailwind integration:** Not native — requires mapping hex tokens to OKLCH and restructuring into `@theme` blocks manually (or via an agent).

#### Pencil.dev

- **What it is:** AI design-to-code tool with native Tailwind v4 + shadcn/ui awareness.
- **Output format:** Generates `globals.css` CSS variable blocks directly compatible with shadcn. Understands which tokens map to which shadcn component behaviors.
- **Cursor integration:** Has a **native MCP server** — agents in Cursor can call Pencil tools directly without leaving the IDE.
- **Best use for trAInR:** Feed it the visual direction from Stitch and have it generate the exact `:root` / `.dark` OKLCH block to paste into `global.css`. Also supports bidirectional sync (globals.css ↔ design).
- **Advantage over Stitch for implementation:** Skips the Figma-to-code translation step entirely; produces machine-ready CSS.

#### Recommended AI tool workflow for trAInR

```
1. Google Stitch
   ├── Input: text prompt describing trAInR brand (dark, premium, fitness SaaS, purple accent)
   ├── Output: visual design system + DESIGN.md spec
   └── Action: commit DESIGN.md to repo root; add reference in AGENTS.md

2. Pencil.dev (via Cursor MCP)
   ├── Input: DESIGN.md + existing global.css structure
   ├── Output: :root and .dark CSS variable blocks (OKLCH, shadcn-named tokens)
   └── Action: paste into src/styles/global.css replacing existing :root / .dark blocks

3. Agent implementation pass
   ├── Add chosen web font to Layout.astro + --font-sans to @theme
   ├── Replace bg-cosmic with tokenized equivalent (--color-cosmic-bg or keep @utility)
   ├── Replace hardcoded purple-500/blue-200/white/10 across 30 files with semantic utilities
   ├── Remove className overrides on shadcn Button/Input
   └── Install missing shadcn components: Card, Dialog, Form, Label, Select, Table
```

#### What artifact is most suitable for AI agents?

**The ideal artifact is a `globals.css` CSS variable block + `DESIGN.md` committed to the repo.**

Ranked by agent-implementation suitability:

| Artifact | Suitability | Why |
|----------|-------------|-----|
| `globals.css` `:root`/`.dark` block (OKLCH) | ★★★★★ | Drop-in, no translation needed, shadcn-native |
| `DESIGN.md` spec (Stitch format) | ★★★★☆ | Machine-readable, agent-referenceable, persists across sessions |
| Figma file + token export | ★★★☆☆ | Requires agent to interpret specs; no direct code path |
| React component code from AI tool | ★★☆☆☆ | High drift risk; conflicts with existing shadcn components |
| Design tokens JSON (Style Dictionary) | ★★★☆☆ | Needs compilation step; not native to TW4 CSS-first setup |

---

### 5. UX Considerations for trAInR

#### Highest-priority gaps

1. **Both dashboards are placeholders** — `/trainer/dashboard.astro` (lines 17–30) and `/client/dashboard.astro` show essentially nothing actionable. This is the single biggest UX gap in the product. Trainer dashboard should surface: active clients, recent sessions, quick links to common actions. Client dashboard should show assigned plan, next session, trainer name.

2. **Full-page reload on filter** — `ExerciseFilters.tsx` uses `window.location.assign()` for every filter toggle. Noticeable on mobile; should use client-side state or URL search params with soft navigation.

3. **Touch targets below 44px** — muscle group filter pills use `py-1` (~28px) and calendar day buttons are `size-10` (40px) — both under WCAG 2.5.5 minimum. Small CSS fix with high accessibility impact.

#### Visual design direction

- **Keep the dark cosmic aesthetic** — it reads as premium B2B, aligning with WHOOP and Peloton. The purple-on-dark-navy is a strong, differentiating visual identity. Do not chase orange/red just because fitness apps typically use warm energy colors.
- **Purple = interactions** (CTAs, links, active states). Consider adding **amber only for achievement/PR moments** (new personal record, streak milestone) to create emotional contrast without breaking the premium feel.
- **Typography is the biggest untapped lever** — no custom font is loaded. A single premium sans-serif (e.g. Inter, Geist, or DM Sans) with a proper type scale would dramatically elevate perceived quality for minimal effort.
- **Gradient text headings** (`from-blue-200 to-purple-200`) are used consistently as the "hero" pattern — this is worth keeping as a brand signature, but should be tokenized rather than hardcoded.

#### Information architecture recommendations

- **Trainer nav** is correct (Dashboard, Clients, Exercises, Templates) but the dashboard itself needs to become a command center, not a redirect page.
- **TrueCoach split-pane pattern** is worth adopting for the session builder: client history visible on the left while building/editing a session on the right. Currently `ClientPlanHub.tsx` shows calendar + session list stacked vertically; a side-by-side layout at `lg:` breakpoint would be more efficient for trainers.
- **Client onboarding flow** — the `?token=` invite signup is functional but the post-signup experience (confirm email → client dashboard) ends at a placeholder. The first session a client sees on their dashboard is their first impression of the product.

#### Component-level UX improvements (low-hanging fruit)

| Component | Issue | Fix |
|-----------|-------|-----|
| `ExerciseFilters.tsx` | Full-page reload per filter | Client-side state, debounced URL params |
| `TemplateForm.tsx` + `SessionForm.tsx` | Near-duplicate (~500 lines each) | Extract shared `PhaseExerciseBuilder` component |
| Custom modals (`ExercisePickerModal`, `TemplatePickerModal`) | Not accessible; no focus trap | Replace with shadcn `Dialog` |
| Auth forms (`FormField.tsx`) | Bypass shadcn `Input` | Use `ui/input.tsx` with cosmic variant |
| Flash messages | Inline Astro divs (not toasts) | Unify behind Sonner toast system |
| Empty states | Bespoke per-page implementations | Shared `EmptyState` component |
| Tables (exercises, templates) | Raw HTML `<table>` in `.astro` files | shadcn `Table` or card list |

---

## Code References

- `src/styles/global.css:1-125` — entire design token surface; `:root` OKLCH tokens (lines 7–38), `.dark` (41–73), `@theme inline` (75–111), `bg-cosmic` utility (113–115)
- `src/layouts/Layout.astro:15-43` — single global layout; single font/theme injection point
- `src/components/Topbar.astro:56-64` — `bg-slate-950/85` topbar; active state `bg-white/15`
- `components.json:1-21` — shadcn config (new-york, neutral, CSS vars, TW4 CSS-first)
- `src/components/auth/FormField.tsx:5-6` — custom `inputBase` bypassing shadcn `Input`
- `src/components/workout-sessions/SessionForm.tsx:595-598` — `className="bg-purple-500"` override on shadcn `Button`
- `src/pages/trainer/dashboard.astro:17-30` — placeholder trainer dashboard
- `src/pages/client/dashboard.astro` — placeholder client dashboard
- `src/components/exercises/ExerciseFilters.tsx` — `window.location.assign()` filter pattern

---

## Architecture Insights

1. **Tailwind CSS 4 CSS-first is the right foundation** — `@theme inline` in a single `global.css` is exactly where a new design system should be injected. No config file migration needed.

2. **shadcn new-york neutral is the right base** — neutral base color means the CSS variables are intentionally placeholder; they are designed to be overridden with a brand color system.

3. **The OKLCH color format is non-negotiable** — shadcn v4 uses OKLCH throughout. Any design tool output in hex or HSL must be converted before use. An agent can do this, but it must be planned for.

4. **No font token layer is a gap** — Tailwind 4 supports `--font-sans`, `--font-mono`, `--font-display` in `@theme`. Adding even one display font for headings would require: (a) `<link>` in `Layout.astro`, (b) `--font-display: 'FontName', sans-serif` in `@theme`.

5. **Single layout is an opportunity** — `Layout.astro` is the only injection point for fonts, theme class on `<html>`, and global CSS variables. One edit applies to the entire app.

6. **The `.dark` class strategy** — since the app is always dark, the correct decision is to either: (a) always add `class="dark"` to `<html>` in `Layout.astro` and let shadcn tokens drive everything, or (b) keep the hardcoded cosmic palette and abandon shadcn's `.dark` infrastructure. Option (a) is architecturally cleaner for long-term maintenance.

---

## Design System Implementation Strategy

### Phase 1: Token unification (foundation)
1. Choose dark-mode strategy: add `class="dark"` to `<html>` permanently, making `.dark` tokens the canonical source
2. Generate `DESIGN.md` via Google Stitch with trAInR brand direction
3. Use Pencil.dev MCP to generate OKLCH `:root` and `.dark` CSS variable blocks
4. Replace existing `:root`/`.dark` blocks in `global.css`
5. Add `bg-cosmic` equivalent as a CSS variable: `--color-page-bg` in `.dark`
6. Add web font (recommendation: Inter or Geist) to `Layout.astro` + `@theme`
7. Add `DESIGN.md` to repo root; reference it in `AGENTS.md`

### Phase 2: Component alignment (eliminate hardcoded classes)
8. Install missing shadcn components: `Card`, `Dialog`, `Form`, `Label`, `Select`, `Table`
9. Create shared `PageShell` component to eliminate repeated `bg-cosmic min-h-screen` markup
10. Create shared `CosmicCard` or use `Card` with cosmic variant
11. Replace `FormField.tsx` native `<input>` with shadcn `Input`
12. Remove `className` color overrides on shadcn `Button` — configure variant instead
13. Replace custom modals with shadcn `Dialog`
14. Unify flash messages behind Sonner toasts

### Phase 3: UX improvements (content and interactions)
15. Build out trainer dashboard with real metrics/actions
16. Build out client dashboard with assigned plan and next session
17. Fix `ExerciseFilters` to use client-side state
18. Fix touch targets (filter pills, calendar day buttons)
19. Extract `PhaseExerciseBuilder` from `TemplateForm`/`SessionForm` duplication
20. Build `EmptyState` shared component

---

## Historical Context

No prior design system changes found in `context/changes/` or `context/archive/`. All existing changes are feature-focused (invite links, exercise muscle groups, plan assignment). This is the first research into the visual layer.

---

## Open Questions

1. **Font choice** — Inter (neutral, technical), Geist (modern SaaS), DM Sans (friendly), or something else? Affects perceived brand persona significantly.
2. **Dark-only vs. light/dark toggle** — current codebase is always-dark. Should a light mode ever be supported? Adds complexity but may matter for client-facing onboarding.
3. **Sidebar for trainer area?** — at `lg:` breakpoints, a collapsible sidebar would give trainers faster navigation across clients/exercises/templates. shadcn has a `Sidebar` component and `--sidebar-*` tokens are already wired in `global.css` (lines unused).
4. **Pencil.dev pricing/access** — confirm MCP server is available on current plan before building workflow around it.
5. **DESIGN.md maintenance** — who owns updating `DESIGN.md` when the design evolves? Should it be agent-updated or human-curated?
6. **Amber accent token** — confirm whether achievement/PR amber fits brand before adding to token system.
