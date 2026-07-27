---
name: Athletic Intelligence System
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#ffb95f'
  on-secondary: '#472a00'
  secondary-container: '#ee9800'
  on-secondary-container: '#5b3800'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00885d'
  on-tertiary-container: '#000703'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-hero:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
  stat-readout:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  container-padding: 1.25rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 2rem
  touch-target-min: 44px
---

## Brand & Style
The design system is engineered for the high-intensity, high-focus environment of a gym. It balances two distinct modes: **Calm Authoring** for trainers (structured, systematic, and clean) and **Energetic Execution** for clients (bold, high-contrast, and glanceable).

The visual language follows a **Modern Corporate/Athletic** hybrid. It utilizes generous whitespace to prevent "data-overload" during complex programming while employing high-impact typographic scales and vibrant primary accents to drive motivation during physical exertion. The overall feel is professional, precise, and technologically advanced, instilling trust in the data tracking while maintaining the "pump" of a fitness environment.

## Colors
The palette is rooted in a "Charcoal & Electric" theme. While the system supports both modes, the **Dark Mode** is the primary "At-the-Gym" experience to reduce glare and save battery. 

- **Primary (Electric Violet):** Used for main action triggers (Start Workout, Finish Set) and active state indicators.
- **Secondary (Warm Amber):** Reserved for "In Progress" states, rest timers, and partial completions.
- **Semantic Logic:** Warm-up sets use a desaturated version of the neutral border color to indicate lower priority, while "Working Sets" utilize the Primary color or high-contrast White/Black to signal maximum effort.
- **Surface Strategy:** Use slightly elevated grays (Slate-800/900) for card backgrounds against the Near-black base to create depth without relying on heavy shadows.

## Typography
The system uses **Geist** for its clean, technical, and modern geometric feel. It provides the necessary "tech-first" aesthetic while remaining highly legible under moving gym lights.

- **Numerals:** Data is the hero. Large-scale Geist numerals are used for weight and rep tracking.
- **Technical Context:** **JetBrains Mono** is introduced for labels (e.g., "SET 1", "RPE", "REST") to provide a functional, "instrument-panel" feel that distinguishes metadata from primary content.
- **Hierarchy:** High contrast in weight is preferred over size variations to maintain scannability. Use "Bold" or "Black" weights for active metrics and "Regular" for instructional text.

## Layout & Spacing
This is a **Mobile-First Fluid** layout. 

- **Thumb-Zone Optimization:** Primary logging actions (Checkmarks, "Add Set", "Save") are placed in the bottom 40% of the screen.
- **Rhythm:** A strict 4px/8px grid ensures vertical rhythm. 
- **The "Gym Safety" Margin:** A generous 20px (1.25rem) side margin is maintained on mobile to prevent accidental triggers while holding a phone with sweaty hands or gloves.
- **Authoring View (Desktop):** Transitions to a multi-pane split view where the workout template is on the left and the exercise library is on the right, allowing for drag-and-drop programming.

## Elevation & Depth
The system uses **Tonal Layering** combined with soft, ambient shadows to define hierarchy.

- **Base Level (0):** The app background (Near-black or Near-white).
- **Surface Level (1):** Exercise cards and list items. These use a subtle 1px border (`border-neutral-200/10`) to define edges.
- **Active Level (2):** The currently active set or the "Live Timer" sheet. These use a soft, diffused shadow with a 10% opacity of the primary color to "glow" and draw the eye.
- **Overlays:** Modals and bottom sheets use a backdrop blur (12px) to maintain the sense of place within the workout while focusing on the specific data entry.

## Shapes
A consistent `0.625rem` (10px) radius is applied to all primary containers and buttons. This "Rounded" approach softens the technical edge of the Geist typeface, making the app feel approachable rather than clinical.

- **Buttons:** Large buttons (logging sets) are fully rounded (pill-shaped) to distinguish them from data cards.
- **Input Fields:** Use the standard 10px radius with a slightly thicker 2px border when focused to ensure the user knows exactly where they are typing.
- **Progress Bars:** Use fully rounded caps to imply fluid movement and completion.

## Components
- **The "Set Row":** A horizontal component containing: [Set Number (Mono Label)] | [Weight Input] | [Reps Input] | [Status Checkbox]. The inputs should have large hit-areas (min 44px height).
- **Primary Logging Button:** A full-width, energetic button at the bottom of the screen. In "Execution" mode, this uses the Primary color. In "Authoring" mode, it uses a secondary outline style.
- **The Timer Bar:** A persistent, thin bar at the top or bottom of the screen that fills with the Secondary Accent color (Amber) during rest periods.
- **Status Chips:** Small, semi-transparent pills used in the calendar view. 
    - *Gray:* Not Started.
    - *Amber:* Partial/In-Progress.
    - *Green:* Completed.
- **Exercise Cards:** Grouped sets within a container. Use a subtle vertical line on the left side of the exercise card (colored Primary) to indicate the "Active Exercise."

---

## Design Tokens (code-side reference)

> Canonical, machine-readable token set derived from the actual app frame fills (not the historical Stitch frontmatter above). These names and hex values match the rebuilt Pencil variable table in `docs/pencil/trainer_dashboard.pen` one-to-one, so an agent can implement them directly in `src/styles/global.css`. The Material-3 frontmatter at the top is retained for design-tool lineage only; **when they disagree, this table wins.**
>
> The palette is a cosmic-navy dark UI with electric-violet (`#8083ff`) primary interactions. Dark is the only theme.

### Color tokens

| Token | Hex | Usage |
| --- | --- | --- |
| `--background` | `#0b1326` | App page background (the cosmic navy base) |
| `--foreground` | `#ffffff` | Primary text on the page |
| `--card` | `#131b2e` | Card / list-item / raised row surfaces |
| `--card-foreground` | `#ffffff` | Text on cards |
| `--popover` | `#171f33` | Modals, bottom sheets, dropdowns, input fields |
| `--popover-foreground` | `#ffffff` | Text on popovers/modals |
| `--primary` | `#8083ff` | Primary buttons, active states, focus ring, links (electric violet) |
| `--primary-foreground` | `#ffffff` | Text/icons on primary fills |
| `--secondary` | `#171f33` | Secondary/soft button fills |
| `--secondary-foreground` | `#c0c1ff` | Text on secondary fills (lavender) |
| `--muted` | `#171f33` | Muted surface fills |
| `--muted-foreground` | `#908fa0` | Secondary/metadata text, captions |
| `--accent` | `#222a3d` | Hover/subtle-elevated surfaces, icon wells |
| `--accent-foreground` | `#ffffff` | Text on accent surfaces |
| `--border` | `#ffffff1a` | Hairline borders and dividers (white @ 10%) |
| `--input` | `#ffffff1a` | Input field borders |
| `--ring` | `#8083ff` | Focus ring |
| `--destructive` | `#ef4444` | Destructive actions (delete) |
| `--destructive-foreground` | `#ffffff` | Text on destructive fills |
| `--success` | `#4edea3` | Completed status, positive stats (green) |
| `--success-foreground` | `#04170f` | Text on success fills |
| `--warning` | `#ffb95f` | In-progress / partial / rest-timer (amber) |
| `--warning-foreground` | `#2a1700` | Text on warning fills |
| `--surface-bright` | `#31394d` | Brightest elevated surface (highlights) |
| `--text-lavender` | `#c0c1ff` | Lavender emphasis text and mono labels |
| `--text-soft` | `#c7c4d7` | Softened body/secondary text |

### Typography

Font stack: `--font-sans: "Geist"` (display + body), `--font-mono: "JetBrains Mono"` (labels, metrics, instrument-panel metadata).

| Role | Family | Size / Weight | Tracking |
| --- | --- | --- | --- |
| `display-hero` | Geist | 48 / 800 | -0.04em |
| `headline-lg` | Geist | 32 / 700 (28 on mobile) | -0.02em |
| `stat-readout` | Geist | 24 / 600 | -0.01em |
| `body-md` | Geist | 16 / 400 | 0 |
| `label-caps` | JetBrains Mono | 12 / 600 | +0.05em |
| `data-mono` | JetBrains Mono | 14 / 500 | 0 |

### Radius & spacing

- Radius: `--radius-sm` 4px · `--radius` 10px (default) · `--radius-md` 12px · `--radius-lg` 16px · `--radius-pill` 9999px.
- Spacing: 4px base grid — `stack-sm` 8px · `stack-md` 16px · `stack-lg` 32px. Minimum touch target 44px (gym-safety).

### Component inventory

Reusable components are defined once in `docs/pencil/trainer_dashboard.pen` and instanced via `ref` on every screen. Final set (17):

**Core primitives**
- `Button / Primary` (`Kk9za`) — full-width electric-violet CTA; `Invite Client Button` (`mEIaD`) is the labelled variant.
- `Input` (`LpAdE`), `Textarea` (`EXhz2`), `Select` (`fqGPI`) — form fields on `--popover`/`--input` surfaces.
- `Search Input` (`J6lNIq`) — icon + placeholder, used across list/table screens.
- `Card` (`FHrXI`) — the base raised surface for list items and panels.
- `Badge / Status` (`Cj0jn`) — pill chip; completed (green) / in-progress (amber) / not-started (gray).
- `Modal Shell` (`V3H9M`) — dialog container with backdrop + blur for create/edit/delete overlays.
- `Empty State` (`uPFRC`) and `Toast` (`ADiq9`).

**Shell & navigation**
- `Topbar` (`J8Z6hl`) — desktop shell: logo + nav tabs + account; per-page active tab set via descendant overrides.
- `Bottom Nav / Mobile` (`sML2o`) — client mobile tab bar. A parallel **trainer** mobile tab bar (Dashboard / Clients / Exercises / Templates) is applied consistently across the four trainer mobile screens (candidate to promote to a DS component).

**Domain components**
- `Client Card` (`jEyfw`) — avatar + name + active dot + plan row + joined date + `Open Calendar Button` (`QLadd`) / `Assign Plan Link` (`v4efIh`).
- Stat card (`PENDING INVITES` / `xilIZ` pattern) — mono caps label + large stat readout, used in dashboard/roster stat rows.

### Breakpoint rules

Two breakpoints, both authored for every surface:

- **Desktop 1440px** — trainer surfaces lead here. Uses the `Topbar` shell; multi-column layouts (dashboard two-column, calendar split-pane, authoring split view) and dense data **tables** (exercises, templates).
- **Mobile 390px** — client + logging surfaces lead here. Uses a bottom tab bar instead of the topbar; single-column stacked content, a 20px gym-safety side margin, thumb-zone primary actions, and ≥44px touch targets. Desktop **tables collapse to stacked cards** (name + type/count badge, metadata, inline Edit/Delete); multi-column dashboards reflow to a single column with 2×2 stat grids.

### Implementation note

Hex values above are the source of truth for the **design** artifacts. The future code-side change is responsible for converting these to **OKLCH** for the shadcn/ui token layer in `src/styles/global.css` (shadcn v4 uses OKLCH throughout); no OKLCH conversion or `globals.css` generation happens in this design-only change.