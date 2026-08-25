---
date: 2026-07-01T15:11:00Z
researcher: AI Agent (Cursor)
git_commit: bdd3ddd
branch: cursor/research-liftmate-zaw-48-e722
repository: ZawilecxD/trAInR
topic: "LiftMate competitive/product research for trAInR"
tags: [research, competitor-analysis, ux, roadmap, linear-zaw-48]
status: complete
external_sources:
  liftmate_repository: https://github.com/jdemb/LiftMate
  liftmate_demo: https://jdemb.github.io/liftmate-demo/
  liftmate_commit: 0ce0c59
linear_issue: ZAW-48
---

# Research: LiftMate ideas for trAInR

## Research question

Analyze LiftMate's repository and demo to identify:

1. what LiftMate implements and presents well,
2. what trAInR can learn from its product flow and visual style,
3. which changes should be considered for trAInR's roadmap.

## Sources reviewed

- LiftMate public repo: <https://github.com/jdemb/LiftMate>
- LiftMate interactive demo: <https://jdemb.github.io/liftmate-demo/>
- LiftMate README at commit `0ce0c59`
- LiftMate docs:
  - `README.md`
  - `documents/idea-notes.md`
  - `documents/idea-expansion-notes.md`
  - `context/foundation/prd.md`
  - `context/foundation/prd-expansion.md`
  - `context/foundation/roadmap.md`
  - `apps/mobile/design/prezentacja-funkcji.md`
  - `apps/mobile/design/mapa-implementacji.md`
  - `apps/mobile/design/LiftMate.dc.html`
- trAInR baseline:
  - `context/foundation/prd.md`
  - `context/foundation/roadmap.md`
  - `DESIGN.md`
  - current `src/pages/` and `src/components/` structure

## Executive summary

LiftMate and trAInR target the same broad problem: trainer-client workout
coordination. The important difference is product posture:

- **LiftMate** is mobile-first and demo-first. It is optimized around a simple
  "today's workout" experience, visible motivation, live trainer-led sessions,
  history, progress, and trainer guidance.
- **trAInR** is web-first and async-coaching-first. It is stronger in reusable
  exercise libraries, richer session-template structure, calendar assignment,
  Supabase RLS isolation, and an already shipped async guided-workout loop.

The most useful LiftMate ideas for trAInR are not the live-session model itself.
trAInR's PRD explicitly differentiates around asynchronous coaching, where the
client trains alone. The strongest transferable ideas are:

1. **A client "Today" home instead of a calendar-first client entry point.**
2. **Per-exercise progress and history made visible to the client.**
3. **Post-workout readiness/wellbeing feedback as structured signal.**
4. **Trainer guidance cards that prioritize clients needing attention.**
5. **A lightweight motivation layer: weekly streak/current-best streak.**
6. **A polished mobile presentation style with clear screen inventory, strong
   typography, sticky bottom navigation, and concise benefit copy.**

## LiftMate functionality inventory

### Product and architecture

LiftMate is a Flutter mobile app with an ASP.NET Core API, Entity Framework,
SQL Server/Azure SQL, JWT auth, and SignalR realtime updates. Its README states
that the mobile app handles trainer and trainee UI/state/token refresh/live
sync, while the API handles auth, role/relationship authorization, training
logic, REST endpoints, and SignalR.

This makes LiftMate a native/mobile-style product, while trAInR remains an Astro
SSR web app with React islands and Supabase. The architecture itself is not a
model to copy, but the mobile-first product decisions are relevant.

### Core user flows shown in repo and demo

LiftMate's demo and implementation map cover 17 screens:

- onboarding: welcome, role choice, signup, trainer pairing,
- trainer: dashboard, trainee detail, workout-set library, set builder, add
  exercise, assign set, live session,
- trainee: today/workout, live session view, post-workout feedback, history,
  session detail, exercise progress.

Core functions:

- trainer-trainee pairing via short invite code,
- one trainer to many trainees,
- trainer dashboard with trainee cards, active-session count, invite code,
  and weekly streak indicators,
- reusable global workout sets assignable to one or many trainees,
- workout-set builder with three exercise types:
  - reps + weight,
  - reps only,
  - time,
- configurable rest time on workout sets and live session rest timer,
- shared live session with trainer-editable values and trainee read-only/live
  view,
- trainee self-start/self-edit workout mode,
- active-session recovery after reconnect/reopen,
- saved results projected into next session,
- post-workout rating/comment,
- trainer guidance for stagnating weight or low wellbeing,
- chronological training history,
- session detail with every exercise/set,
- per-exercise progress over time,
- weekly streak/current-best streak.

## What LiftMate does better than trAInR today

### 1. Client entry point is more focused

LiftMate starts the client in a "Dzis / trening" screen: assigned workout,
start button, trainer context, streak, and last workout. This is more direct
than trAInR's current client experience, where `/client/dashboard` is minimal
and the richer client surface is the calendar at `/client/plan`.

trAInR's calendar is valuable for async coaching, but a phone-at-the-gym user
usually needs "what do I do now?" before "what does my month look like?"

**Transferable idea:** Add a client Today hub that surfaces the next actionable
session, last session summary, streak/consistency, and direct links to plan and
history.

### 2. Motivation is visible without becoming a game

LiftMate uses a simple weekly streak: current and best streak, counted by weeks
with at least one completed workout. This is intentionally small and avoids
heavy gamification.

trAInR currently has statuses, comments, and guided logging, but no visible
motivation/adherence layer. The trAInR PRD parks broader analytics, but a streak
or consistency indicator is a low-complexity complement to async coaching.

**Transferable idea:** Add a client consistency card and trainer-visible
regularity signal. Use it as adherence context, not as a social leaderboard.

### 3. History has a clear drill-down path

LiftMate's history flow is strong:

1. reverse-chronological session list,
2. session detail with duration, exercise count, set count, feedback,
3. exercise rows that link to per-exercise progress,
4. progress screen with current value, delta, start-to-now comparison, and
   recent values.

trAInR already has proposed S-12 exercise statistics and proposed S-20 client
finished-session summary. LiftMate demonstrates that these two should be linked
into one client-facing journey, not built as isolated screens.

**Transferable idea:** Promote S-12/S-20 as a cohesive "history and progress"
experience: session summary -> exercise detail -> progress trend.

### 4. Post-workout feedback is structured and useful

LiftMate's post-workout flow asks "How do you feel after training?", captures
a 1-5 rating, optional comment, allows skip, and shows feedback in session
detail. The expansion PRD explicitly preserves feedback as read-only for the
trainer and does not interpret free-text automatically.

trAInR has bidirectional session comments, but comments alone are not easy to
aggregate. A structured rating creates a signal for trainer triage without
requiring AI or text analysis.

**Transferable idea:** Add optional post-session readiness/wellbeing rating,
then show it in trainer dashboards and session readouts.

### 5. Trainer guidance turns history into action

LiftMate's trainer guidance checks:

- stagnation: same reps+weight exercise across three recent sessions where the
  third top weight is not higher than the first,
- wellbeing: average of last three feedback ratings is 3 or lower,
- one active guidance item per signal until marked read.

This is deliberately explainable and non-automatic: it does not change workout
sets or prescribe AI decisions.

trAInR's trainer dashboard already has session readout, but prioritization is
under-specified in the PRD. LiftMate gives a good conservative model: small,
auditable rules that surface "needs attention" clients.

**Transferable idea:** Add explainable trainer attention cards after structured
feedback and exercise stats exist.

### 6. Demo and screen inventory communicate the product better

LiftMate's static demo is a polished walkthrough with:

- phone frame,
- sticky screen index grouped by Onboarding/Trainer/Trainee,
- current-screen note and related requirements,
- concise product copy,
- complete visual coverage of the app's key flows.

trAInR has strong implementation docs but no public interactive demo or visual
screen inventory. For stakeholder review, LiftMate is easier to understand.

**Transferable idea:** Build a lightweight trAInR product walkthrough or design
deck once the UI redesign direction is ready.

### 7. Mobile visual system is more cohesive in the demo

LiftMate's demo uses:

- dark charcoal base (`#101216`, `#0c0d10`, `#191c22`),
- electric blue primary (`#3a82f6`),
- green success (`#21c97a`, `#7ee0ad`),
- muted gray text (`#969ba3`, `#686d75`),
- Space Grotesk for headings,
- Manrope for body,
- rounded cards/buttons,
- bottom navigation for role flows,
- large exercise names and numeric values during workout.

trAInR already has a target `DESIGN.md` with a premium dark athletic direction
and Geist/JetBrains Mono typography, but the shipped UI still has hardcoded
cosmic classes and inconsistent token usage. LiftMate validates the direction:
dark mobile-first, large numbers, tight screen hierarchy, action buttons in
thumb-friendly areas.

**Transferable idea:** Use LiftMate as evidence to prioritize S-18 UI redesign,
especially client execution and dashboard surfaces.

## Where trAInR is already stronger

### 1. Async coaching model is clearer

LiftMate emphasizes live/shared sessions. trAInR's core insight is different:
independent trainers usually coach asynchronously, and clients train alone.
trAInR should not pivot toward trainer-led realtime sessions unless user
research proves that need.

### 2. Calendar-based assignment fits trAInR's positioning

LiftMate assigns a set to a trainee; trAInR assigns sessions to dates on a
client calendar. For async programming, dated sessions are a stronger model
because the trainer can plan a week/month and review adherence.

### 3. Session prescription is richer

trAInR supports session templates with phases, per-round prescriptions, rest,
warm-up/working flags, and session personalization. LiftMate's set model is
more direct, but less expressive.

### 4. Data integrity and tenancy are more central in trAInR

trAInR's Supabase schema/RLS and integration test focus are better aligned with
multi-tenant privacy requirements for a web SaaS. LiftMate has role/relationship
authorization, but trAInR's repository has more explicit RLS hardening.

## Style analysis

### LiftMate strengths

- **Glanceable mobile screens:** one main goal per screen.
- **Clear role language:** trainer vs trainee selected up front.
- **Strong data hierarchy:** exercise names and live values dominate workout
  screens.
- **Bottom navigation:** role-specific nav keeps primary areas accessible.
- **Trainer dashboard cards:** count, active sessions, invite code, trainees,
  streaks, and status are visible in one place.
- **Direct CTAs:** "Start workout", "Assign", "Finish and save training".
- **Human copy:** Polish microcopy is specific and task-focused.

### LiftMate style risks

- The demo uses many inline styles and hardcoded colors; this works for a
  presentation, not as a maintainable app design system.
- The mobile-native bottom nav is appropriate for Flutter, but trAInR must adapt
  it carefully for web SSR/responsive layouts.
- Live trainer-led copy is not aligned with trAInR's async-coaching positioning.

### trAInR style implication

trAInR should keep its `DESIGN.md` direction rather than copy LiftMate's exact
blue palette. The useful LiftMate pattern is structural: focused mobile screens,
large data readouts, thumb-zone CTAs, concise role-specific navigation, and
trainer attention cards.

## Feature gap matrix

| Area | LiftMate | trAInR today | Recommendation |
| --- | --- | --- | --- |
| Client home | Today/workout hub | Minimal dashboard + calendar | Add client Today hub |
| Calendar | Not central | Strong month/week plan view | Keep as async planning core |
| Templates | Workout sets | Rich session templates/phases | Keep trAInR model |
| Multi-client assignment | Assign one set to many trainees | Assign dated sessions per client | Consider bulk/repeat separately, not LiftMate clone |
| Live trainer session | SignalR realtime shared session | Async guided workout | Do not prioritize realtime yet |
| Workout UX | Large live values, rest timer | Guided logging with prescription fill | Continue mobile polish via S-18/S-20 |
| Rest timer | Prominent controls/progress | Rest prescriptions exist; timer UX depends on guided flow | Add stronger timer UI in guided workout polish |
| Feedback | 1-5 rating + comment | Session comments | Add structured post-workout feedback |
| History | Session list -> detail -> exercise progress | Trainer readout; S-12/S-20 proposed | Build client history/progress flow |
| Motivation | Weekly streak/current best | None | Add lightweight consistency streak |
| Trainer guidance | Stagnation/low-feeling cards | Dashboard readout, prioritization underspecified | Add explainable attention cards |
| Demo | Interactive phone-screen deck | No public product walkthrough | Build demo/design walkthrough after UI redesign |

## Strategic recommendations

1. **Do not copy LiftMate's realtime core.** It is useful inspiration, but
   trAInR's async model is the sharper market position.
2. **Promote client-facing progress and feedback.** These are already hinted in
   trAInR's PRD/roadmap and strongly validated by LiftMate.
3. **Make trainer dashboard "needs attention" explicit.** Pair structured
   feedback and exercise stats into explainable guidance cards.
4. **Add a mobile-first Today hub before expanding advanced planning.** This
   makes the client experience immediately easier without changing the core
   data model.
5. **Use LiftMate's demo format for communication.** A concise interactive
   walkthrough would help validate trAInR flows before or during S-18.

## Proposed next-step framing

The roadmap candidates in `proposed-roadmap.md` are ordered to preserve
trAInR's existing architecture and avoid building trainer guidance before the
signals it depends on exist:

1. Today hub and client summary polish.
2. Structured post-workout feedback.
3. Exercise history/progress.
4. Lightweight streak/adherence.
5. Trainer attention cards.
6. Product walkthrough/demo.
