# UI Redesign — Missing Design Coverage Implementation Plan

## Overview

Two Pencil design files already exist (`docs/pencil/trainer_dashboard.pen`, `docs/pencil/guided_workout_logging.pen`) and establish a strong, coherent visual direction: a **cosmic-navy dark UI with purple primary interactions, green success, amber attention accents, and a Geist + JetBrains Mono type pairing**. They cover the trainer authoring surface and the core client/logging happy path — but roughly seven screen areas are undesigned, and there is no shared design-system artifact yet.

This plan creates the missing designs on a **single unified token foundation**, sequenced by priority: design-system foundation → client-facing gaps → trainer authoring gaps → public/auth surface → responsive parity. All new work is produced through the **Pencil MCP** and lands as `.pen` files plus a committed `DESIGN.md`. This plan does **not** touch application code — codebase token unification and hardcoded-class cleanup are a separate change.

## Current State Analysis

**What exists (audited via Pencil MCP):**

- `trainer_dashboard.pen` (~20k lines) contains desktop (1440px) trainer screens — Dashboard, Clients, Exercises (+ create/edit modals), Templates (+ create/edit/delete modals) — plus mobile (390px) **Client Dashboard** and **Client Calendar**. Each screen has a companion 420px "Design Spec" annotation panel citing functional requirements (e.g. FR-027, FR-028).
- `guided_workout_logging.pen` contains three mobile (390px) screens — **Session Overview**, **Exercise Logging**, **Navigation Menu** — plus a Design Spec panel citing FR-015–020 / US-01 / S-06, mode "MOBILE-FIRST · ONE-HANDED GYM USE".
- Trainer screens are **desktop-first** ("CALM AUTHORING"); client + logging screens are **mobile-first**.
- The only reusable component in the files today is a client-card frame (`jEyfw`). There is **no dedicated design-system / component-library frame**.

**Key constraints discovered:**

- **Token contradiction (load-bearing gotcha):** `get_variables` on `trainer_dashboard.pen` returns `--primary: #FF8400` (orange), `--background: #111111`, `--font-primary: JetBrains Mono` — but **no frame actually references these variables**. Every frame uses hardcoded cosmic-navy hex (`#0b1326` page, `#131b2e`/`#171f33` cards & modals, `#ffffff1a` borders, purple `#8083ff` primary buttons, `#c0c1ff`/`#c7c4d7` text, `#908fa0` muted). The variable table is a **stale Pencil default and must not be used as the token source.** The real tokens live in the frame fills.
- Pencil MCP tools **only operate on a `.pen` file that is currently open in the editor**. Any phase that reads or writes a `.pen` file must ensure it is open first; a fresh `get_editor_state(include_schema: true)` is required before `batch_design`.
- The codebase has moved past the research snapshot (2026-06-12): guided workout logging, the client side, and session comments are all **shipped features** now (19 pages, 50 components). The design gap list below is derived from the current codebase, not the research doc.

## Desired End State

A complete, consistent set of Pencil designs covering **every screen in the current 19-page app**, all sharing one honest token system, backed by:

- A rebuilt `.pen` variable table that matches the real navy/purple frames.
- A dedicated **design-system frame** (tokens + core component library) that every screen reuses.
- A committed **`DESIGN.md`** at repo root, referenced from `AGENTS.md`, that an AI agent can read to implement the tokens in code later.
- Every new screen designed at **both desktop and mobile** breakpoints, and responsive parity backfilled for the two pre-existing files.

**Verification:** `export_nodes` produces a clean screenshot for each screen; `snapshot_layout(problemsOnly: true)` returns no clipped/overflowing nodes; `get_variables` returns navy/purple tokens matching the frames; `DESIGN.md` exists and is linked from `AGENTS.md`.

### Key Discoveries:

- Real design tokens are in frame fills, not the variable table (`trainer_dashboard.pen` `get_variables` vs. frame `fill` values).
- `GuidedWorkoutHub.tsx:209-262` drives four modes — `overview`, `guided`, `edit-list`, `completed` — but only overview/guided/nav-menu are designed; **completed** and **edit-list** (with sealed/`EditWindowBanner` state) are undesigned.
- `ClientPlanHub.tsx:116-200` is a desktop split-pane (calendar + selected-day session list) that is undesigned and still carries dual-palette debt (`bg-purple-500`, `bg-white/5`, `text-blue-100`).
- Design Spec annotation panels (420px, `#131b2e`, cite `FR-xxx`) are an established convention to reproduce for every new screen.

## What We're NOT Doing

- **No application code changes.** No edits to `src/`, `global.css`, shadcn components, or hardcoded Tailwind classes. Token unification and class cleanup in code is a separate change.
- **No Google Stitch step.** The visual direction is already set by the existing `.pen` files; `DESIGN.md` is derived from them, not generated fresh.
- **No new product features or IA changes.** We design the screens the app already has; we do not invent new flows.
- **No OKLCH conversion / `globals.css` generation.** That belongs to the future code change; this plan only records the hex/spec in `DESIGN.md`.
- **No light-mode design.** The app is dark-only; we design dark only (the DS token structure may leave room for it, but no light frames are produced).

## Implementation Approach

Work is produced entirely through the Pencil MCP, one surface per `.pen` file, reusing components from the design-system frame built in Phase 1. Each screen follows the existing house pattern: a screen frame plus a companion Design Spec annotation panel citing the relevant functional requirements and the target breakpoint. Client-facing screens lead with mobile; trainer screens lead with desktop; every new screen also gets its secondary breakpoint. After each phase, layouts are validated with `snapshot_layout(problemsOnly: true)` and reviewed via `export_nodes` screenshots before moving on.

## Critical Implementation Details

- **Token source of truth:** never trust `get_variables` on the existing files. Extract the palette from frame fills (page `#0b1326`, card `#131b2e`, elevated/modal `#171f33`, border `#ffffff1a`, primary `#8083ff`, text `#c0c1ff`/`#c7c4d7`/`#ffffff`, muted `#908fa0`, plus green success / amber attention as seen in the dashboard stats and status chips). Phase 1 rebuilds the variable table to these values so downstream tooling is trustworthy.
- **Pencil file lifecycle:** every phase step that calls a Pencil tool requires the target `.pen` file open in the editor. If a tool returns "A file needs to be open in the editor," pause and have the file opened before retrying. Call `get_editor_state(include_schema: true)` before the first `batch_design` in each file so the schema is in context.
- **Breakpoint convention:** desktop frames are 1440px wide, mobile frames 390px. Match the existing files' frame naming and the 420px Design Spec panel convention.
- **Consistency mechanism:** new screens must instantiate components from the Phase 1 design-system frame (via `ref` nodes) rather than redrawing primitives, so a later token edit propagates.

## Phase 1: Design-System Foundation

### Overview

Establish one honest token system and a reusable component library, plus the committed `DESIGN.md`. Everything downstream depends on this.

### Changes Required:

#### 1. Rebuild the `.pen` variable table

**File**: `docs/pencil/trainer_dashboard.pen` (and mirror into new files as created)

**Intent**: Replace the stale orange/`#111111`/mono default variables with the actual navy/purple token set the frames already use, so `get_variables` becomes a trustworthy source for the eventual code work.

**Contract**: The `variables`/`themes` block exposed by `get_variables` must report the real palette — page/background `#0b1326`, card `#131b2e`, popover/elevated `#171f33`, border `#ffffff1a`, `--primary` `#8083ff` (purple), foreground `#ffffff`, secondary text `#c0c1ff`/`#c7c4d7`, muted `#908fa0`, plus success (green), warning/attention (amber), destructive (red) — and font tokens `Geist` (display/body) + `JetBrains Mono` (mono/labels). Dark is the only required theme.

#### 2. Build the design-system frame

**File**: `docs/pencil/trainer_dashboard.pen` (new top-level frame, e.g. "Design System")

**Intent**: Create a single canvas frame documenting the visual language and holding reusable component instances that every screen references.

**Contract**: A frame containing: (a) color swatches for every token above; (b) the type scale in Geist + JetBrains Mono (display, heading, body, label/mono, caption); (c) radius + spacing samples; (d) reusable core components marked `reusable: true` — Button (primary/secondary/ghost/destructive), Input/Select/Textarea, Card, Badge/Chip, Topbar + mobile Bottom Nav, Modal shell, Empty state, Error/toast. Existing reusable frames (topbar `J8Z6hl`, client card `jEyfw`) are folded in or referenced.

#### 3. Author `DESIGN.md`

**File**: `DESIGN.md` (repo root)

**Intent**: Produce the machine-readable design spec (research's top-ranked agent artifact) describing tokens, typography, spacing, radius, component inventory, and the desktop/mobile breakpoint rules — derived from the frames, in hex.

**Contract**: Markdown with a token table (name → hex → usage), font stack + type scale, radius/spacing scale, and a component list. Includes an explicit note that OKLCH conversion happens in the future code change.

#### 4. Reference `DESIGN.md` from `AGENTS.md`

**File**: `AGENTS.md`

**Intent**: Make the spec discoverable to future agents alongside `PRODUCT.md`/`DESIGN.md` mentions already present.

**Contract**: A one-line reference under the design tooling / project-context section pointing to `DESIGN.md`.

### Success Criteria:

#### Automated Verification:

- `get_variables` on `docs/pencil/trainer_dashboard.pen` returns navy/purple tokens (primary `#8083ff`, background `#0b1326`), not orange/`#111111`.
- `DESIGN.md` exists at repo root: `ls DESIGN.md`.
- `AGENTS.md` contains a reference to `DESIGN.md`.
- `snapshot_layout(problemsOnly: true)` on the Design System frame returns no problems.
- `npm run lint` passes (no code changed, but confirms repo integrity after doc edits).

#### Manual Verification:

- Design-system frame screenshot reviewed: swatches, type scale, and component set read as one coherent system matching the existing screens.
- `DESIGN.md` token values visually match the existing frames.

**Implementation Note**: After automated verification passes, pause for human confirmation of the design-system frame and `DESIGN.md` before drawing screens on top of it.

---

## Phase 2: Client-Facing Gaps (mobile-first + desktop)

### Overview

Design the missing client/logging states — the highest-visibility gap per research. Reuse Phase 1 components.

### Changes Required:

#### 1. Guided-logging Session Completed / summary view

**File**: `docs/pencil/guided_workout_logging.pen` (new frames: mobile 390px + desktop 1440px)

**Intent**: Design the post-workout summary the app shows in `completed` mode (`SessionCompletedView`), including per-exercise actuals, completion status (finished / finished-partially / cancelled), and the entry point to edit.

**Contract**: Screen frame(s) + Design Spec panel citing the relevant FRs. Shows session header, exercise/set results, status, and an "Edit" affordance; mobile and desktop variants.

#### 2. Guided-logging Edit-window flow

**File**: `docs/pencil/guided_workout_logging.pen` (new frames: mobile + desktop)

**Intent**: Design the `edit-list` mode (`SessionEditList`) plus the **sealed / edit-window-expired** state (`EditWindowBanner`), covering both editable and read-only presentations.

**Contract**: Edit-list screen showing exercises with editable set logs, restart/complete actions, and a distinct sealed/read-only variant with the edit-window banner; mobile and desktop.

#### 3. Session comments thread

**File**: `docs/pencil/guided_workout_logging.pen` (new frame) — mobile + desktop

**Intent**: Design the `SessionCommentsThread` (trainer↔client comments on a session), including empty, populated, and composing states.

**Contract**: Thread frame with message list, author/timestamp, composer, and empty state; usable in both the client session context and the trainer review context.

### Success Criteria:

#### Automated Verification:

- New frames exist and export cleanly: `export_nodes` produces PNGs for each new screen.
- `snapshot_layout(problemsOnly: true)` on `guided_workout_logging.pen` returns no clipped/overflowing nodes.
- New frames reference Phase 1 components (spot-check via `batch_get` for `ref` nodes).

#### Manual Verification:

- Completed, edit-window (editable + sealed), and comments screens reviewed and read as consistent with existing logging screens.
- One-handed mobile ergonomics preserved (primary actions reachable, ≥44px touch targets).

**Implementation Note**: Pause for human confirmation of the client-facing screens before starting trainer authoring.

---

## Phase 3: Trainer Authoring Gaps (desktop-first + mobile)

### Overview

Design the trainer flows for building and reviewing client work. Reuse Phase 1 components; new file for the surface.

### Changes Required:

#### 1. Client plan hub (split-pane)

**File**: `docs/pencil/trainer_authoring.pen` (new file) — desktop 1440px + mobile 390px

**Intent**: Design the trainer's `ClientPlanHub` — calendar on the left, selected-day session list on the right (the TrueCoach split-pane pattern research recommended), including the "assigned" success banner and empty state.

**Contract**: Split-pane desktop frame (calendar + day session list + "Add session"), a stacked mobile variant, and a Design Spec panel; session rows show status badges and edit/view affordances.

#### 2. Session builder (new / edit)

**File**: `docs/pencil/trainer_authoring.pen` — desktop + mobile

**Intent**: Design the `SessionForm` screen for creating/editing a per-client session (phases, exercises, sets/reps/rest), the app's densest authoring surface.

**Contract**: Builder frame with phase/exercise structure, per-exercise set rows, add-exercise and template-picker entry points, save/cancel; create and edit variants; desktop and mobile.

#### 3. Trainer review of client's completed session (actuals)

**File**: `docs/pencil/trainer_authoring.pen` — desktop + mobile

**Intent**: Design the trainer-facing read view of a completed session (`SessionActualsReview`) — planned vs. actual, per-set logs, RPE, and the comments thread from Phase 2 embedded.

**Contract**: Review frame comparing planned/actual per exercise, session status, and an embedded comments thread; desktop and mobile.

### Success Criteria:

#### Automated Verification:

- `docs/pencil/trainer_authoring.pen` exists and all frames export cleanly via `export_nodes`.
- `snapshot_layout(problemsOnly: true)` returns no problems.
- `get_variables` on the new file matches the Phase 1 token set.

#### Manual Verification:

- Plan hub, session builder (create + edit), and actuals review reviewed; split-pane and dense builder layouts are usable at 1440px and degrade sensibly to mobile.
- Consistency with existing trainer desktop screens confirmed.

**Implementation Note**: Pause for human confirmation before starting the public/auth surface.

---

## Phase 4: Public & Auth Surface (desktop + mobile)

### Overview

Design the unauthenticated first-impression and onboarding screens. New file for the surface.

### Changes Required:

#### 1. Landing page

**File**: `docs/pencil/public_auth.pen` (new file) — desktop 1440px + mobile 390px

**Intent**: Design the marketing landing (`/` / `Welcome.astro`) establishing the brand: hero, value props, CTA to sign up / sign in.

**Contract**: Landing frame(s) with hero (gradient heading signature), feature/value sections, and CTAs; desktop and mobile; Design Spec panel.

#### 2. Auth screens

**File**: `docs/pencil/public_auth.pen` — desktop + mobile

**Intent**: Design **Signin**, **Signup** (including the `?token=` invite-client variant), and **Confirm-email**, using the DS Input/Button components rather than the bypassed native inputs.

**Contract**: Signin, Signup (standard + invite-token), and Confirm-email frames; consistent auth-card shell; error and loading states noted; desktop and mobile.

### Success Criteria:

#### Automated Verification:

- `docs/pencil/public_auth.pen` exists; all frames export cleanly via `export_nodes`.
- `snapshot_layout(problemsOnly: true)` returns no problems.
- Auth frames reference DS Input/Button components (spot-check `ref` nodes).

#### Manual Verification:

- Landing, signin, signup (both variants), confirm-email reviewed; brand reads premium and consistent with the app shell.
- Invite-token signup variant clearly differs from standard signup.

**Implementation Note**: Pause for human confirmation before the final parity/audit phase.

---

## Phase 5: Responsive Parity + Consistency Audit

### Overview

Backfill the "both desktop AND mobile" coverage for the two pre-existing files and verify the whole set is internally consistent.

### Changes Required:

#### 1. Backfill responsive variants for pre-existing screens

**File**: `docs/pencil/trainer_dashboard.pen`, `docs/pencil/guided_workout_logging.pen`

**Intent**: Add the missing breakpoint for screens designed at only one size — mobile variants for the desktop-only trainer screens (Dashboard, Clients, Exercises, Templates) and desktop variants for the mobile-only client screens (Client Dashboard, Client Calendar) and the original three logging screens.

**Contract**: Each pre-existing screen has both a 1440px and a 390px frame; new variants reuse DS components and match the established layouts.

#### 2. Cross-file consistency audit

**File**: all `.pen` files + `DESIGN.md`

**Intent**: Verify every file binds the same tokens, every screen uses DS components (not redrawn primitives), and `DESIGN.md` still matches; produce a review screenshot set.

**Contract**: A short audit note (in the change folder) listing each screen, its breakpoints, and pass/fail on token + component consistency; discrepancies fixed.

### Success Criteria:

#### Automated Verification:

- `get_variables` returns the identical token set across all `.pen` files.
- `snapshot_layout(problemsOnly: true)` returns no problems in any file.
- `export_nodes` produces a full screenshot set (every screen, both breakpoints).
- `npm run lint` passes.

#### Manual Verification:

- Full screenshot set reviewed end-to-end; the app reads as one cohesive design system across all surfaces and both breakpoints.
- `DESIGN.md` reflects the final component inventory.

**Implementation Note**: Final human sign-off on the complete design set closes the change.

---

## Testing Strategy

### Automated checks (Pencil MCP + repo):

- `snapshot_layout(problemsOnly: true)` per file after each phase — catches clipped/overflowing/collapsed layouts.
- `export_nodes` per screen — confirms every frame renders.
- `get_variables` — confirms token consistency and that the orange default is gone.
- `ls DESIGN.md` + grep `AGENTS.md` — confirms the committed spec and its reference.
- `npm run lint` — repo integrity after doc edits.

### Manual review steps:

1. Screenshot each new screen (both breakpoints) and compare against the existing house style.
2. Verify touch targets ≥44px on mobile client/logging screens.
3. Verify new screens use DS component `ref`s, not redrawn primitives.
4. Confirm the invite-token signup variant and the sealed edit-window state are visually distinct.

## Performance Considerations

Screenshots are token-expensive — take them per completed screen/section, not per `batch_design`. Prefer `snapshot_layout` for structural checks. `trainer_dashboard.pen` is already ~20k lines; keep new surfaces in their own files (`trainer_authoring.pen`, `public_auth.pen`) to keep each canvas manageable.

## Migration Notes

The stale orange variable table is replaced in Phase 1; no other migration. `DESIGN.md` records hex values only — OKLCH conversion and `globals.css` generation are explicitly deferred to the future code-side change.

## References

- Research: `context/changes/ui-redesign/research.md`
- Existing designs: `docs/pencil/trainer_dashboard.pen`, `docs/pencil/guided_workout_logging.pen`
- Modes/gaps in code: `src/components/guided-workout/GuidedWorkoutHub.tsx:209-262`, `src/components/plans/ClientPlanHub.tsx:116-200`
- Token reality vs. table: `get_variables` output vs. frame fills (see Critical Implementation Details)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Design-System Foundation

#### Automated

- [x] 1.1 `get_variables` on `trainer_dashboard.pen` returns navy/purple tokens (primary `#8083ff`, background `#0b1326`) — 252ec29
- [x] 1.2 `DESIGN.md` exists at repo root — 252ec29
- [x] 1.3 `AGENTS.md` references `DESIGN.md` — 252ec29
- [x] 1.4 `snapshot_layout(problemsOnly: true)` on Design System frame returns no problems — 252ec29
- [x] 1.5 `npm run lint` passes — 252ec29

#### Manual

- [x] 1.6 Design-system frame reviewed as one coherent system — 252ec29
- [x] 1.7 `DESIGN.md` token values match the frames — 252ec29

### Phase 2: Client-Facing Gaps

#### Automated

- [x] 2.1 New frames export cleanly via `export_nodes` — 2a1e18f
- [x] 2.2 `snapshot_layout(problemsOnly: true)` on `guided_workout_logging.pen` returns no problems — 2a1e18f
- [x] 2.3 New frames reference Phase 1 components (`ref` nodes present) — 2a1e18f

#### Manual

- [x] 2.4 Completed, edit-window (editable + sealed), and comments screens reviewed for consistency — 2a1e18f
- [x] 2.5 One-handed mobile ergonomics + ≥44px touch targets verified — 2a1e18f

### Phase 3: Trainer Authoring Gaps

#### Automated

- [x] 3.1 `trainer_authoring.pen` exists; all frames export cleanly — ca54add
- [x] 3.2 `snapshot_layout(problemsOnly: true)` returns no problems — ca54add
- [x] 3.3 `get_variables` matches Phase 1 token set — ca54add

#### Manual

- [x] 3.4 Plan hub, session builder (create + edit), actuals review reviewed at both breakpoints — ca54add
- [x] 3.5 Consistency with existing trainer desktop screens confirmed — ca54add

### Phase 4: Public & Auth Surface

#### Automated

- [x] 4.1 `public_auth.pen` exists; all frames export cleanly — 44f4665
- [x] 4.2 `snapshot_layout(problemsOnly: true)` returns no problems — 44f4665
- [x] 4.3 Auth frames reference DS Input/Button components — 44f4665

#### Manual

- [x] 4.4 Landing, signin, signup (both variants), confirm-email reviewed — 44f4665
- [x] 4.5 Invite-token signup variant clearly distinct from standard signup — 44f4665

### Phase 5: Responsive Parity + Consistency Audit

#### Automated

- [ ] 5.1 `get_variables` returns identical token set across all `.pen` files
- [ ] 5.2 `snapshot_layout(problemsOnly: true)` returns no problems in any file
- [ ] 5.3 Full screenshot set exported (every screen, both breakpoints)
- [ ] 5.4 `npm run lint` passes

#### Manual

- [ ] 5.5 Full screenshot set reviewed end-to-end as one cohesive system
- [ ] 5.6 `DESIGN.md` reflects final component inventory
