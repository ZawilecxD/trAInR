# UI Redesign — Code Implementation Plan

## Overview

Apply the completed Pencil designs (`docs/pencil/*.pen`) and `DESIGN.md` into the Astro + React app: finish the token layer (OKLCH + leftover class sweep), ship the app shell (Topbar + mobile bottom navs), then restyle every shipped screen for visual parity — without new product features, fake metrics, or IA invention beyond presentation choices already decided (desktop modals for exercise/template CRUD; real-route bottom tabs only).

Parent design change: `context/changes/ui-redesign/` (ZAW-38). Linear: ZAW-56.

## Current State Analysis

- **Design coverage is done.** Four `.pen` files + exports under `context/changes/ui-redesign/exports/phase-5{,-guided}/` cover every shipped product surface at 1440px and 390px.
- **Token pass partially landed** (`5864de5`): cosmic-navy CSS variables, Geist + JetBrains Mono, semantic class migration across ~65 files, `src/lib/ui-classes.ts`. Leftovers: widespread `text-white`, `red-*` error banners, one `purple-*` in `PlanCalendar.tsx`.
- **Layout parity has not started.** Live screens still follow pre-redesign structure (e.g. trainer dashboard S-07 chrome vs Pencil `a0zwyQ` greeting/4-KPI/Clients sidebar). Shell is Topbar-only; Pencil mobile bottom navs are unimplemented.
- **Modal gap:** `TemplatesHub` already supports create/edit via `TemplateFormModal`; exercises still use full-page `/new` and `/[id]` only. Pencil designs both as desktop modals.
- **Data gap:** Pencil trainer KPIs include Sessions This Week / Missed This Week / Completed Today — not computed by `getTrainerDashboard` (`activeClientCount`, `clientsWithActivePlanCount`, `recentLoggedSessionCount` only). Decision: honest metrics only; omit unsupported KPI slots.
- **Client dashboard** is a stub (assigned trainer name); can compose next-session hub from existing `listMySessionsAsClient` without new features.

### Key Discoveries:

- Visual SoT: `DESIGN.md` code-side token table (hex) + Pencil frames; ignore Material-3 YAML frontmatter when it conflicts.
- QA SoT: PNG exports keyed by node id in `exports/phase-5/MANIFEST.md` and `exports/phase-5-guided/MANIFEST.md`.
- Fidelity: near-pixel for trainer/client dashboards, guided logging, and auth; structural layout match for authoring densest screens; light polish for landing.
- Deep-link rule: keep `/trainer/exercises|templates/{new,[id]}` full-page routes; desktop list hubs open modals (TemplatesHub pattern).

## Desired End State

Every shipped user-facing route renders in the cosmic-navy / electric-violet system and matches its Pencil counterpart at the agreed fidelity. Desktop uses Topbar; mobile authenticated app uses role-appropriate bottom nav. Lists that are tables on desktop collapse to cards on mobile. Exercise/template create-edit open as desktop modals from list hubs. No unsupported metrics shown. `npm run lint`, `npm run check`, and `npm run build` pass.

### Verification (change-level):

- Spot-check each phase against the matching export PNGs (checklist in Testing Strategy).
- No dual-palette leftovers on redesigned screens (`text-white` as body text, numbered `red-*`/`purple-*` for brand chrome).
- Bottom nav only links to real routes (no Progress/Profile stubs).
- ZAW-55 exercise-stats work remains untouched.

## What We're NOT Doing

- New product features, new metrics/services for Pencil-only KPIs, or fake Progress/Profile tabs.
- Light mode.
- Editing Pencil files / redesigning in design tools.
- Playwright visual-regression CI.
- Folding ZAW-55 (exercise stats pages) into this change.
- Pixel-perfect landing rewrite (light polish only).
- Changing form save semantics, RLS, or API contracts beyond UI presentation.

## Implementation Approach

Six phases matching the agreed sequence: foundation → shell → client surfaces → trainer hubs → trainer authoring → public/auth. Shared primitives (`PageShell`, `EmptyState`, `StatusBadge`) are extracted when first needed and reused. Each phase ends with lint/check (and tests when touched) plus manual visual QA vs exports before the next phase.

## Critical Implementation Details

- **Token authority:** `DESIGN.md` § Design Tokens (code-side reference) wins over Stitch frontmatter. Convert those hex values to OKLCH in `global.css` for the shadcn layer; keep semantic names stable (`--primary`, `--success`, etc.).
- **Honest KPIs:** On trainer dashboard, adopt Pencil layout (greeting, Invite CTA, two-column body, Clients sidebar, Quick actions). Stat row may only show computable values from `TrainerDashboardSummary` / activity (e.g. Active clients; optionally restyle `clientsWithActivePlanCount` / `recentLoggedSessionCount` as secondary honest stats). Do **not** render Missed This Week / Sessions This Week / Completed Today without backend support.
- **Bottom nav route set:** Client: Dashboard + My Plan (+ highlight Workout only when on `/client/sessions/*`). Trainer: Dashboard / Clients / Exercises / Templates. Hide Topbar primary nav on small screens when bottom nav is visible (avoid duplicate chrome); keep account/sign-out reachable (Topbar compact or account affordance — prefer keeping a slim top account row rather than inventing Profile).
- **Modal + routes:** Desktop list → modal; mobile may keep full-page editors. Do not break bookmarks to `/new` and `/[id]`.

## Phase 1: Foundation (OKLCH + token sweep + shared primitives)

### Overview

Finish the design-token layer and introduce the small shared UI helpers later phases consume.

### Changes Required:

#### 1. OKLCH conversion in global CSS

**File**: `src/styles/global.css`

**Intent**: Convert canonical DESIGN.md color tokens from hex to OKLCH while preserving semantic names and dark-only behavior (`html.dark` already set in Layout).

**Contract**: `:root` / theme tokens still expose the same CSS variable names; visual hex equivalence within normal conversion tolerance; typography utilities (`display-hero`, `headline-lg`, `stat-readout`, `label-caps`, `data-mono`, `surface-card`) remain.

#### 2. Leftover class sweep

**File**: `src/**/*.{astro,tsx,ts}` (esp. error banners, `PlanCalendar.tsx`, body `text-white`)

**Intent**: Replace remaining dual-palette leftovers with semantic tokens (`text-foreground`, `text-destructive` / destructive surface recipes, remove stray `purple-*`).

**Contract**: No numbered palette classes used for brand chrome on shipped UI; modal scrims (`bg-black/50`) may remain. Prefer a shared error-banner class rather than one-off `red-*` strings.

#### 3. Shared primitives

**File**: `src/components/` (new small Astro/React helpers as needed), `src/lib/ui-classes.ts`

**Intent**: Add `EmptyState`, promote `pageShellClass` / `surfaceCardClass` / `authCardClass` usage, and a `StatusBadge` (or thin wrapper) aligned with DESIGN.md Badge/Status.

**Contract**: EmptyState API: title + optional description + optional action slot; StatusBadge variants map to success / warning / muted (not-started). First consumers can land in Phase 1 smoke usage or Phase 3+ lists — components must exist and be importable by end of Phase 1.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run check` passes
- `npm run test` passes (no intentional test regressions from class renames)
- Grep gate: no `bg-purple-`, `text-purple-`, `border-purple-` under `src/` for brand chrome; `text-white` only where intentionally on primary/destructive fills (document exceptions if any)

#### Manual Verification:

- Spot-check `/`, `/auth/signin`, `/trainer/dashboard` still render with cosmic-navy surfaces and Geist
- Error banners still readable (destructive token contrast)

**Implementation Note**: Pause for human confirmation before Phase 2.

---

## Phase 2: App shell (Topbar + mobile bottom navs)

### Overview

Make authenticated chrome match DESIGN.md / Pencil shell: Topbar on desktop, role bottom navs on mobile.

### Changes Required:

#### 1. Topbar parity

**File**: `src/components/Topbar.astro`

**Intent**: Align logo color, active chip (soft elevated fill, not full pill), inactive muted text, height/hairline with Pencil Topbar `J8Z6hl`.

**Contract**: Trainer and client nav item sets unchanged; active state uses semantic tokens; responsive behavior coordinates with bottom nav (hide primary link row on `md` down when bottom nav shows).

#### 2. Client + trainer bottom nav

**File**: new component under `src/components/` (e.g. `BottomNav.astro` or role-specific), wired from `src/layouts/Layout.astro`

**Intent**: Ship mobile bottom tab bars matching Pencil trainer tabs and client real-route tabs; ≥44px targets.

**Contract**: Visible only when authenticated + viewport matches mobile shell rule; links only to existing routes (client: `/client/dashboard`, `/client/plan`; session routes highlight Workout if present in design without adding Progress/Account). Trainer: `/trainer/dashboard|clients|exercises|templates`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` / `npm run check` pass
- Layout still wraps all pages; no middleware changes required for nav

#### Manual Verification:

- Desktop trainer: Topbar matches export chrome (compare `a0zwyQ.png` top strip)
- Mobile width (~390): bottom nav appears; Topbar primary links not duplicated; tabs navigate correctly for both roles
- Logged-out public pages: no bottom nav

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: Client surfaces (dashboard, calendar, guided logging)

### Overview

Near-pixel client mobile-led surfaces: guided logging modes, client dashboard hub from existing data, client calendar layout alignment.

### Changes Required:

#### 1. Guided logging visual parity

**File**: `src/components/guided-workout/*`, `src/pages/client/sessions/[sessionId].astro`

**Intent**: Restyle overview, exercise logging, nav menu sheet, completed, edit-list (editable + sealed), and comments embed to match `guided_workout_logging.pen` exports (near-pixel).

**Contract**: `GuidedWorkoutHub` modes unchanged (`overview` | `guided` | `edit-list` | `completed`); sealed remains edit-list variant; no logging behavior changes; touch targets ≥44px on primary controls.

#### 2. Client dashboard hub

**File**: `src/pages/client/dashboard.astro` (+ small presentational component if needed)

**Intent**: Replace stub with Pencil hub layout using assigned trainer + next/upcoming session from existing `listMySessionsAsClient` (and active plan presence already implied by that path).

**Contract**: No new RPCs/tables; empty states via shared EmptyState when no plan/sessions; links into `/client/plan` and `/client/sessions/[id]`.

#### 3. Client calendar

**File**: `src/components/plans/ClientCalendarHub.tsx`, related calendar components, `src/pages/client/plan.astro`

**Intent**: Structural/near layout match to Client Calendar frames (`h25CmH` / `GNOsD`) — shell, card surfaces, status chips — without changing month/week semantics.

**Contract**: Existing navigation to sessions preserved; EmptyState on empty days/lists where redesign touches empties.

### Success Criteria:

#### Automated Verification:

- `npm run lint` / `npm run check` / `npm run test` pass
- Existing guided-workout unit tests still pass

#### Manual Verification:

- Compare mobile + desktop guided screens to `exports/phase-5-guided/*.png`
- Client dashboard shows real next-session/trainer content or EmptyState — never fake metrics
- Client plan calendar usable on ~390 and desktop

**Implementation Note**: Pause for human confirmation before Phase 4.

---

## Phase 4: Trainer hubs (dashboard, clients, exercises, templates)

### Overview

Restyle trainer list/hub screens and dashboard to Pencil desktop-led designs; add exercise modal-on-list; ensure mobile card collapse.

### Changes Required:

#### 1. Trainer dashboard

**File**: `src/components/trainer/TrainerDashboardOverview.astro`, `src/pages/trainer/dashboard.astro`

**Intent**: Rebuild layout to match `a0zwyQ` / `XwiiA` (greeting header, Invite CTA, activity feed, Clients sidebar, Quick actions) using honest summary fields only.

**Contract**: Data still from `getTrainerDashboard`; unsupported Pencil KPIs omitted; EmptyState when no clients/activity; Invite links to `/trainer/clients` (or existing invite entry).

#### 2. Clients roster

**File**: `src/pages/trainer/clients.astro`, `src/components/trainer/InviteClientPanel.tsx`

**Intent**: Match Trainer Clients frames — search chrome, stat strip if data exists, Client Card visual, invite panel — without new roster fields.

**Contract**: Preserve invite generate/copy and remove-client flows; add client-side search filter over existing roster if design requires Search Input; EmptyState for empty roster/invites.

#### 3. Exercises list + desktop modal CRUD

**File**: `src/pages/trainer/exercises/*`, `src/components/exercises/*` (new modal shell mirroring `TemplateFormModal`)

**Intent**: Restyle library list (desktop table / mobile cards); open create/edit in desktop modal from index; keep `/new` and `/[id]` full pages.

**Contract**: Same `ExerciseForm` submission behavior; modal follows TemplatesHub state pattern; DeleteConfirmDialog remains for destructive confirms if applicable.

#### 4. Templates list polish

**File**: `src/components/session-templates/TemplatesHub.tsx`, related filters/modal

**Intent**: Visual parity with Trainer Templates frames; ensure mobile stacked cards; EmptyState; modal shell tokens match Modal Shell.

**Contract**: Existing modal-on-list + full-page routes remain; delete confirm unchanged behaviorally.

### Success Criteria:

#### Automated Verification:

- `npm run lint` / `npm run check` / relevant Vitest pass
- Exercise/template create-edit still work via modal and via full-page routes

#### Manual Verification:

- Compare to `exports/phase-5/{a0zwyQ,XwiiA,FdB6a,U0AyO,tIOyo,wxxGT,S3vm8b,zqQ4j}.png`
- Dashboard shows no fabricated week/missed/today KPIs
- Mobile exercises/templates are cards, not an unusable table

**Implementation Note**: Pause for human confirmation before Phase 5.

---

## Phase 5: Trainer authoring (plan hub, session builder, actuals review)

### Overview

Structural layout match for densest trainer tools — split panes / section hierarchy per `trainer_authoring.pen` — without changing form semantics or save behavior.

### Changes Required:

#### 1. Client plan hub

**File**: `src/components/plans/ClientPlanHub.tsx`, `src/pages/trainer/clients/[clientId]/plan.astro`

**Intent**: Align split-pane chrome, session row cards, and CTAs with Plan Hub frames.

**Contract**: Calendar assign/edit/view links and `TemplatePickerModal` behavior unchanged.

#### 2. Session builder

**File**: `src/components/workout-sessions/SessionForm.tsx`, session new/edit pages

**Intent**: Match builder section hierarchy / surfaces / primary actions to Session Builder frames (create + edit); keep phase/exercise/round model and validation.

**Contract**: No schema or payload changes; structural CSS/layout only.

#### 3. Actuals review

**File**: `src/components/workout-sessions/SessionActualsReview.tsx`, `SessionExerciseSummary.tsx`, comments thread styling

**Intent**: Structural/near parity with Actuals Review frames; status chips via StatusBadge.

**Contract**: Read-only review + comments behavior unchanged.

### Success Criteria:

#### Automated Verification:

- `npm run lint` / `npm run check` / `npm run test` pass
- Session form unit/validation tests still pass

#### Manual Verification:

- Desktop + mobile authoring usable; primary actions thumb-reachable on mobile
- Compare to `trainer_authoring.pen` frames / any available exports; if no PNG export set, use live Pencil screenshots via `export_nodes` during QA
- Save/assign/delete still succeed

**Implementation Note**: Pause for human confirmation before Phase 6.

---

## Phase 6: Public & auth

### Overview

Light landing polish; near-pixel auth screens (sign-in, sign-up, invite signup, confirm-email).

### Changes Required:

#### 1. Landing light polish

**File**: `src/components/Welcome.astro`, `src/pages/index.astro`

**Intent**: Token/typography/CTA polish only — not a full marketing rebuild.

**Contract**: Keep single-composition hero rules already in product; no new sections mandated by Pencil if they expand scope beyond polish.

#### 2. Auth screens near-pixel

**File**: `src/pages/auth/*.astro`, `src/components/auth/*`

**Intent**: Match `public_auth.pen` Sign In / Sign Up / Join as Client / Confirm Email frames (desktop + mobile) using `authCardClass` / shared inputs.

**Contract**: Invite-token branch remains distinct; form POST/API behavior unchanged; confirm-email drops emoji-centric stub in favor of designed empty/confirm content.

### Success Criteria:

#### Automated Verification:

- `npm run lint` / `npm run check` / `npm run build` pass
- Auth-related unit tests pass if present

#### Manual Verification:

- Sign-in, sign-up, invite signup, confirm-email match Pencil closely at ~1440 and ~390
- Landing still loads; CTAs work; no bottom nav on public pages
- End-to-end smoke: sign-in → trainer dashboard shell looks coherent with Phases 2–4

**Implementation Note**: Final human sign-off closes the change after Progress is complete.

---

## Testing Strategy

### Unit Tests:

- Update snapshots/class assertions only when tests pin on old class strings.
- Add/adjust tests for any pure helpers introduced for dashboard greeting or next-session selection (prefer `src/lib/`).

### Integration Tests:

- No new Supabase flows required; keep existing invite/session tests green.

### Manual Testing Steps:

1. Per phase, open the listed export PNGs beside `npm run dev` at 1440 and ~390 widths.
2. Trainer: dashboard → clients (invite) → exercises modal create → templates modal edit → plan hub → session builder → actuals.
3. Client: dashboard hub → plan calendar → start/log session through guided modes including sealed edit-list.
4. Auth: landing → sign up / sign in / confirm-email; invite-token signup still distinct.
5. Confirm bottom nav route set and no fabricated KPIs/tabs.

## Performance Considerations

Bottom nav and Topbar are light Astro components — avoid shipping heavy client islands for chrome. Modal forms reuse existing React islands; do not double-mount list+page forms unintentionally.

## Migration Notes

- Prior commit `5864de5` is the baseline token migration; Phase 1 continues it (OKLCH + leftovers), do not re-run `scripts/migrate-ui-tokens.mjs` blindly.
- No DB migrations.
- Working tree may include Geist import path fix (`@fontsource-variable/geist/index.css`) — keep it.

## References

- Parent design: `context/changes/ui-redesign/{plan,plan-brief,research,phase-5-audit}.md`
- Spec: `DESIGN.md`
- Pencil: `docs/pencil/{trainer_dashboard,guided_workout_logging,trainer_authoring,public_auth}.pen`
- Exports: `context/changes/ui-redesign/exports/phase-5{,-guided}/`
- Linear: ZAW-56 (parent design ZAW-38; ZAW-55 out of scope)
- Patterns: `TemplatesHub.tsx` + `TemplateFormModal.tsx`; `src/lib/ui-classes.ts`; `getTrainerDashboard` in `src/lib/trainer-dashboard/service.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Foundation (OKLCH + token sweep + shared primitives)

#### Automated

- [ ] 1.1 `npm run lint` passes
- [ ] 1.2 `npm run check` passes
- [ ] 1.3 `npm run test` passes (no intentional test regressions from class renames)
- [ ] 1.4 Grep gate: no brand `purple-*` under `src/`; `text-white` only on intentional fill exceptions

#### Manual

- [ ] 1.5 Spot-check `/`, `/auth/signin`, `/trainer/dashboard` still render with cosmic-navy + Geist
- [ ] 1.6 Error banners still readable (destructive token contrast)

### Phase 2: App shell (Topbar + mobile bottom navs)

#### Automated

- [ ] 2.1 `npm run lint` / `npm run check` pass
- [ ] 2.2 Layout still wraps all pages; no middleware changes required for nav

#### Manual

- [ ] 2.3 Desktop trainer Topbar matches export chrome
- [ ] 2.4 Mobile ~390: bottom nav works for trainer + client; no duplicate primary nav; public pages have no bottom nav

### Phase 3: Client surfaces (dashboard, calendar, guided logging)

#### Automated

- [ ] 3.1 `npm run lint` / `npm run check` / `npm run test` pass
- [ ] 3.2 Existing guided-workout unit tests still pass

#### Manual

- [ ] 3.3 Guided logging matches `exports/phase-5-guided` at mobile + desktop
- [ ] 3.4 Client dashboard uses real data or EmptyState — no fake metrics
- [ ] 3.5 Client plan calendar usable at ~390 and desktop

### Phase 4: Trainer hubs (dashboard, clients, exercises, templates)

#### Automated

- [ ] 4.1 `npm run lint` / `npm run check` / relevant Vitest pass
- [ ] 4.2 Exercise/template create-edit work via modal and full-page routes

#### Manual

- [ ] 4.3 Hubs match `exports/phase-5` trainer PNGs (dashboard/clients/exercises/templates)
- [ ] 4.4 Dashboard shows no fabricated week/missed/today KPIs
- [ ] 4.5 Mobile exercises/templates use stacked cards

### Phase 5: Trainer authoring (plan hub, session builder, actuals review)

#### Automated

- [ ] 5.1 `npm run lint` / `npm run check` / `npm run test` pass
- [ ] 5.2 Session form unit/validation tests still pass

#### Manual

- [ ] 5.3 Authoring usable desktop + mobile vs `trainer_authoring.pen`
- [ ] 5.4 Save/assign/delete still succeed

### Phase 6: Public & auth

#### Automated

- [ ] 6.1 `npm run lint` / `npm run check` / `npm run build` pass
- [ ] 6.2 Auth-related unit tests pass if present

#### Manual

- [ ] 6.3 Auth screens near-pixel vs `public_auth.pen` at ~1440 and ~390
- [ ] 6.4 Landing polish + CTAs; no bottom nav on public pages
- [ ] 6.5 Smoke: sign-in → trainer dashboard shell coherent with earlier phases
