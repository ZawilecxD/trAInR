# trAInR — UI Design Prompt for Google Stitch

> Paste-ready prompt set for **[Google Stitch](https://stitch.withgoogle.com/)** (Gemini-powered UI design).
> Target state: the **full v1 roadmap is complete** (slices F-01 + S-01 → S-14). This document describes the entire surface area of the product so the generated UI covers every screen.
>
> **How to use:** Stitch works best one screen (or one tight flow) at a time. Start by pasting **Section 1 (Master Design System)** as your first message to establish style, then paste each screen prompt from **Section 4** in its own turn. Sections 2–3 give context you can fold into any prompt. Keep the design-system language identical across prompts so screens stay visually consistent.

---

## 0. TL;DR for the AI

> Design **trAInR**, a mobile-first web app for **independent personal trainers** and **their clients**. Trainers build an exercise library, compose session templates, and assign workouts to a client's calendar. Clients open the assigned session at the gym and log every set one-handed on their phone, then trainers review the logged data. The product replaces the spreadsheet + chat + PDF chaos that independent trainers live in today. It must feel **focused, athletic, and effortless** — calm enough for desk planning, bold and thumb-friendly enough for a noisy gym floor.

---

## 1. Master Design System Prompt (paste this first)

```
You are designing the UI for "trAInR" — a mobile-first web app that helps independent
personal trainers program workouts and lets their clients log training at the gym.

PRODUCT IN ONE LINE
An async coaching tool: trainer builds exercises -> composes session templates ->
assigns sessions to a client's calendar -> client logs real sets at the gym ->
trainer reviews the results. One tool, replacing spreadsheets + chat + PDFs.

TWO USER TYPES (one app, role-based)
- Trainer: plans at a desk on laptop or tablet; manages 5-30 clients. Needs dense,
  efficient authoring views (library, template builder, calendar assignment, dashboard).
- Client: uses a phone in portrait, often one-handed, mid-workout at the gym. Needs
  large tap targets, minimal reading, and a guided "one exercise at a time" flow.

DESIGN PRINCIPLES
1. Mobile-first, phone-at-the-gym. Portrait by default. Primary client actions
   (see today's session, log a set, advance to next exercise) reachable with one thumb.
2. Glanceable. Status, progress, and "what to do next" readable in under 2 seconds.
3. Calm authoring, energetic execution. Planning screens are clean and structured;
   the live workout screen is bold, high-contrast, and motivating.
4. Trustworthy data. Logged numbers are precious — never hide save state. Show clear
   saved / saving / error-retry feedback.
5. Low cognitive load. Progressive disclosure; never show a trainer-only control to a client.

VISUAL DIRECTION
- Modern athletic-tech aesthetic. Confident, clean, a little energetic. Not a corporate
  SaaS dashboard, not a neon gamer app. Think "premium training app + focused productivity tool".
- Generous whitespace, strong typographic hierarchy, rounded corners (~10px / 0.625rem),
  soft shadows on cards, clear separation between sections.
- Large, legible numbers for weights/reps/timers (this is a logging app — numbers are the hero).
- Supports BOTH light and dark mode. Dark mode is important for gym/evening use.

COLOR PALETTE
- Base / neutral surfaces: near-white in light mode, near-black charcoal in dark mode
  (neutral grays, no strong tint). Cards slightly raised from background.
- Primary action / brand accent: an energetic athletic color — electric blue or
  vivid violet — used for primary buttons, active states, and the brand mark.
  Use it sparingly so it reads as "action".
- Secondary accent: a warm energetic tone (amber/orange) for highlights and emphasis.
- Semantic status colors (used consistently across calendar, badges, dashboard):
    * Not started  -> neutral / muted gray
    * Finished     -> success green
    * Finished partially -> amber / orange (warning, not error)
    * Error / destructive -> red
- Warm-up sets render in a muted/secondary tone; working sets render in full-strength color.

TYPOGRAPHY
- Clean geometric or humanist sans-serif (e.g. Inter / Geist style). 
- Strong scale: oversized numerals and headings on the workout-logging screen; compact,
  scannable type on dense authoring/list screens.

COMPONENTS & SYSTEM (the build target — design to fit it)
- Built with shadcn/ui "new-york" variant, Tailwind CSS v4, lucide icons.
- Use shadcn primitives: Button, Card, Input, Select, Tabs, Dialog, Sheet, Badge,
  Table, Calendar, Avatar, DropdownMenu, Accordion, Tooltip, Toast/Sonner.
- Corner radius token ~0.625rem. Subtle borders, subtle shadows.
- Provide an icon-forward but label-supported navigation.

DELIVERABLE
A cohesive, responsive design system and the set of screens listed below. Keep spacing,
type scale, color usage, and component styling consistent across every screen.
```

---

## 2. Product context (background — fold into prompts as needed)

**The problem trAInR solves:** Independent trainers juggle spreadsheets, WhatsApp, and PDFs to build plans, assign them, and check whether clients actually trained. Clients have no structured way to see their schedule or log results. trAInR closes that feedback loop in one async tool.

**The core loop (memorize this — every screen serves it):**

1. Trainer builds an **exercise library** (name, type, muscle groups, notes, optional video link).
2. Trainer composes a **session template** — exercises grouped into phases (warm-up / main / cool-down), each exercise prescribed **per round** (set 1: 10×50 kg + 2 min rest, set 2: 8×60 kg, …).
3. Trainer **assigns a session** to a specific day on a client's calendar (from a template or from scratch), personalizing exercises as needed.
4. Client sees it on their **calendar**, opens the **guided workout view**, and logs each set one-handed.
5. Trainer reviews logged data on their **dashboard** and in **read-only session detail**.

**Two roles, no admin:**

| Role | Primary device | Does |
| --- | --- | --- |
| **Trainer** | Laptop / tablet | Library, templates, calendar assignment, dashboard, client management, read-only review |
| **Client** | Phone (portrait) | Calendar, guided workout + set logging, exercise stats, session comments |

**Non-goals (do NOT design these):** native app shell, billing/subscription screens, in-app chat, push/email notification center, AI plan generation, progress-photo uploads, multi-trainer org/admin, multi-week program builder. Keep the surface lean.

---

## 3. Information architecture & navigation

Design distinct navigation for the two roles (role is known after login).

**Trainer (desktop-first, responsive down to tablet):**
- Persistent left sidebar or top nav: **Dashboard · Clients · Exercises · Templates · Calendar**
- Account menu (avatar): profile, theme toggle, sign out.

**Client (phone-first):**
- Bottom tab bar (thumb zone): **Today · Calendar · Stats · Profile**
- A session opened from Today/Calendar enters a focused full-screen guided flow (nav minimized).

**Shared / unauthenticated:**
- Marketing-light **sign in** / **sign up** screens.
- **Invite landing → registration** screen (client arrives via a trainer's invite link).
- **Check your email** confirmation screen.

---

## 4. Screens to design (one prompt per screen)

> Each block is a self-contained Stitch prompt. Prepend the relevant device note and reuse the Master Design System language. Status colors and components must match across all screens.

### A. Authentication & onboarding

**A1 — Sign in**
```
Design a clean, mobile-first sign-in screen for trAInR. Email + password fields, a
"Sign in with Google" button, "forgot password" link, and a link to sign up. Centered
card on a calm background, brand mark on top. Light and dark variants.
```

**A2 — Sign up (trainer)**
```
Design a sign-up screen for a trainer: display name, email, password, and Google sign-up.
Same visual language as sign in. Brief reassuring tagline about building plans in minutes.
```

**A3 — Invite landing → client registration**
```
Design the screen a client lands on after tapping a trainer's invite link. Show the
inviting trainer's name/avatar ("Train with [Trainer Name]"), then a quick registration
form (display name, email, password, or Google). One primary CTA "Join & get started".
Mobile-first, friendly, low-friction. Show a subtle note that they'll be auto-assigned
to this trainer.
```

**A4 — Check your email / confirmation**
```
Design a simple "check your inbox" confirmation screen after sign-up: large icon,
short message, resend link, back-to-sign-in link.
```

### B. Trainer — Exercise library (S-01)

**B1 — Exercise library list**
```
Design the trainer's exercise library (desktop-first, responsive). A searchable, filterable
list/grid of exercises. Filters: exercise type (strength / cardio / flexibility / other)
and muscle group; plus a text search. Each exercise card shows name, type chip, primary
muscle-group tags, and an optional video-link indicator. Prominent "New exercise" button.
Empty state encouraging the trainer to add their first exercise. Light and dark.
```

**B2 — Create / edit exercise**
```
Design a create/edit exercise form (modal/sheet on mobile, panel on desktop): name,
exercise type (select), default metric (reps+weight / time / distance), muscle groups
(multi-select with primary/secondary roles), notes (textarea), optional video/photo URL.
Save and cancel. Validation states. Clean, fast to fill.
```

### C. Trainer — Session templates (S-02, S-14)

**C1 — Templates list**
```
Design the session-templates list for a trainer: cards showing template name, short
description, number of exercises, and phase breakdown (warm-up/main/cool-down counts).
"New template" CTA. Empty state.
```

**C2 — Template builder (the most complex authoring screen)**
```
Design a session-template builder (desktop-first). The template is organized into three
ordered phases: Warm-up, Main, Cool-down. Within each phase, an ordered, reorderable list
of exercises (drag handles). For each exercise show its name and a compact PER-ROUND
prescription table: each set/round as a row with reps (or duration), load in kg, and rest
time. Support different prescriptions per round (set 1: 10 reps x 50kg, set 2: 8 x 60kg,
set 3: 6 x 70kg). Allow add/remove sets per exercise, add exercise from library (search
picker), reorder exercises, set notes per exercise. Header: template name + description.
Sticky save. Make the per-round table dense but legible. Light and dark.
```

### D. Trainer — Clients & assignment (S-03, S-04, S-11)

**D1 — Clients list**
```
Design the trainer's clients view: list of assigned clients with avatar, name, plan status,
last activity (e.g. "logged a session 2 days ago"), and a quick status indicator for whether
they're keeping up. "Invite client" button that surfaces a generated invite link to copy/share.
Per-client overflow menu with "Remove client" (soft remove, confirm dialog). Empty state with
invite CTA.
```

**D2 — Generate invite link (dialog)**
```
Design a dialog that shows a freshly generated single-use invite link with a copy button,
a share affordance, an expiry note, and a "generate new link" action.
```

**D3 — Assign session to calendar (S-04)**
```
Design the flow where a trainer places a session on a specific day of a client's calendar.
Start from a client's calendar (month view). Tapping a day opens an assignment panel: choose
"From template" (searchable template picker) or "From scratch". After picking, show an
editable session: reorder/remove/edit exercises and tweak the per-round prescription for THIS
client (personalization), set the session name and date. Confirm to place it. Desktop-first,
works on tablet.
```

### E. Client — Calendar & today (S-05)

**E1 — Today (client home)**
```
Design the client's "Today" screen (phone, portrait). Hero card for today's session: session
name, phase/exercise count, status, and a big primary "Start workout" button. If no session
today, a calm empty/rest-day state. Below: a peek at the next upcoming session. Bottom tab bar
(Today / Calendar / Stats / Profile).
```

**E2 — Calendar (month + week)**
```
Design the client's calendar (phone-first). Default month view with a toggle to week view.
Days with sessions show a colored dot/pill by status: not started (gray), finished (green),
finished partially (amber). Tapping a day shows that day's session(s) in a list below the
calendar with status and a "Open" action. Clear month/week toggle. Light and dark.
```

### F. Client — Guided workout & logging (S-06, S-08, S-10, S-13)

**F1 — Guided workout view (the signature screen)**
```
Design the guided active-workout view for a client (phone, portrait, ONE-HANDED use — this is
the most important screen). Show ONE exercise at a time in prescribed order. Top: exercise name,
phase label, position indicator ("Exercise 3 of 8"), and an optional video link. Center: the
prescription for the current exercise as per-round rows, and large, easy inputs to log each set —
reps + weight in kg (or a timer/duration for timed exercises). Inputs use big steppers / number
pads, huge tap targets in the thumb zone. Each set row has a quick toggle to flag warm-up vs
working set (warm-up muted, working full-strength). Show a subtle "last time" hint per exercise
(previous performance: weight x reps from the last session containing this exercise). Clear
SAVED / saving / retry-on-error feedback per set. Bottom: large "Next exercise" / "Previous"
controls and a button to open the exercise-list menu (jump to any exercise). A way to mark the
session finished / finished partially when done. Bold, energetic, high-contrast; numbers are the
hero. Light and dark.
```

**F2 — Exercise list / session overview menu (S-06 nav)**
```
Design the in-session exercise list menu (sheet/overlay on phone): all exercises in the session
grouped by phase (warm-up/main/cool-down), each with completion state (logged sets count vs
prescribed), tap to jump to that exercise. A header with overall session progress.
```

**F3 — Edit logged session (list view) (S-06 FR-020 / S-13)**
```
Design the EDIT view for an already-logged session (NOT the guided flow): a scrollable list
showing all exercises and their logged sets at once for quick corrections. Inline editing of
reps/weight/time and warm-up flag. Show a clear notice when the 24h edit window is still open
("Editable for 23h"), and a sealed/locked state (read-only, lock icon) once the window closes.
```

### G. Stats & feedback (S-12, S-09)

**G1 — Exercise statistics / history (client)**
```
Design a per-exercise history screen for a client (phone-first). Pick/See an exercise, then a
history table of past performances (date, sets, reps/time, weight). Show estimated 1RM (Epley)
labeled "estimated", and volume/tonnage (sets x reps x weight) per session. A simple trend line
chart is welcome but keep numbers primary. Only working sets count. Empty state for exercises
with no logged history yet.
```

**G2 — Session comments (bidirectional)**
```
Design a session comments thread usable by both client and trainer (no live chat — simple
threaded notes). Each comment shows author avatar/name, body, timestamp. Composer at the bottom.
Appears within a session detail context. Mobile-first, also fits the trainer's desktop session
detail.
```

### H. Trainer — Dashboard & review (S-07)

**H1 — Trainer dashboard**
```
Design the trainer dashboard (desktop-first, responsive). Top: summary tiles (active clients,
sessions completed this week, sessions needing attention). Main: a recent-activity feed of
client session logging (client name, session, status badge, time). Surface clients who need
attention (missed/partial sessions) clearly. Quick links into a client's calendar or session
detail. Calm, scannable, data-forward. Light and dark.
```

**H2 — Read-only session detail (trainer review)**
```
Design a read-only session-detail view for the trainer reviewing a client's logged session.
Show session name, date, status, and each exercise grouped by phase with prescribed vs ACTUAL
logged sets side by side (reps/weight/time, warm-up vs working). Include the session comments
thread. No editing controls — review only. Works on desktop and phone.
```

### I. Shared

**I1 — Profile & settings**
```
Design a simple profile/settings screen: avatar, display name, email, light/dark theme toggle,
sign out. Minimal — no billing, no notifications center. Same for both roles with role-appropriate
fields.
```

**I2 — Empty / loading / error states**
```
Design a consistent set of empty states (no exercises, no templates, no clients, no sessions,
no history), a loading skeleton style for lists and cards, and an inline error-with-retry pattern
(especially for failed set saves). These must feel cohesive with the rest of the system.
```

---

## 5. Cross-cutting requirements (apply to every screen)

- **Responsive:** trainer authoring screens are desktop/tablet-first but must degrade gracefully; client screens are phone-portrait-first. All primary client actions reachable one-handed in the thumb zone.
- **Light + dark mode:** both required; dark mode tuned for gym/evening use.
- **Status color system (consistent everywhere):** not started = neutral gray · finished = green · finished partially = amber · error/destructive = red. Warm-up sets muted; working sets full-strength.
- **Numbers are the hero:** weights, reps, timers, 1RM, and tonnage use the largest legible type, especially in the guided workout view.
- **Save-state honesty:** logged data must always show saved / saving / error-retry. Never silently fail.
- **Accessibility:** WCAG AA contrast, ≥44px tap targets on client screens, visible focus states, labels on all icon-only controls.
- **Component fidelity:** design to shadcn/ui "new-york" + Tailwind v4 + lucide icons, radius ≈ 0.625rem, subtle borders/shadows, so the output maps cleanly onto the existing codebase.

---

## 6. Suggested generation order in Stitch

1. Master Design System (Section 1) — establish style.
2. **F1 — Guided workout view** (the signature, hardest screen) — lock the visual energy early.
3. **E1 / E2 — Today + Calendar** (client core).
4. **H1 / H2 — Dashboard + read-only review** (trainer core).
5. **C2 — Template builder** (most complex authoring).
6. **B1/B2, D1/D3** — library, clients, assignment.
7. **A1–A4** — auth/onboarding.
8. **G1/G2, I1/I2** — stats, comments, profile, states.

Iterate on each screen with follow-up prompts (e.g. "make the set-logging inputs larger and move them into the bottom thumb zone", "tighten the per-round table density") rather than regenerating from scratch.
