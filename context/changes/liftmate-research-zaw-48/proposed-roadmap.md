---
date: 2026-07-01T15:11:00Z
researcher: AI Agent (Cursor)
git_commit: bdd3ddd
branch: cursor/research-liftmate-zaw-48-e722
repository: ZawilecxD/trAInR
topic: "Proposed trAInR roadmap from LiftMate research"
tags: [roadmap, research, competitor-analysis, linear-zaw-48]
status: proposed
linear_issue: ZAW-48
---

# Proposed roadmap: LiftMate-inspired changes for trAInR

This is a change-scoped proposal derived from `research.md`. It should not be
treated as an approved foundation roadmap update until the product direction is
reviewed.

## Roadmap principles

1. Preserve trAInR's async-coaching positioning.
2. Reuse existing Supabase/RLS, session, set-log, template, and comment models
   where possible.
3. Prefer explainable coaching signals over AI/autonomous plan changes.
4. Make the client phone experience more direct before adding broad analytics.
5. Promote existing proposed slices (`S-12`, `S-18`, `S-20`) rather than
   duplicating them.

## At a glance

| ID | Change ID | Outcome | Existing roadmap link | Prerequisites | Suggested status |
| --- | --- | --- | --- | --- | --- |
| LM-01 | `client-today-hub` | Client sees next actionable session, last result, streak/adherence, and direct plan/history actions | extends S-20, supports S-18 | S-05, S-06, S-08, S-13 | proposed |
| LM-02 | `post-workout-readiness-feedback` | Client can leave optional 1-5 readiness/wellbeing rating plus comment after completing a session | extends S-09/session comments | S-06, S-08, S-09 | proposed |
| LM-03 | `client-history-progress-flow` | Client can drill from session history to read-only session detail and per-exercise progress | consolidates S-12 + S-20 | S-06, S-08, S-13, S-19 | proposed |
| LM-04 | `client-consistency-streak` | Client and trainer see current/best weekly consistency streak | new small engagement slice | S-08 | proposed |
| LM-05 | `trainer-attention-cards` | Trainer dashboard highlights clients needing attention using explainable rules | extends S-07 + S-12 + LM-02 | LM-02, LM-03 | proposed |
| LM-06 | `guided-workout-rest-timer-polish` | Guided workout surfaces rest timer/progress and large active-set metrics more clearly | supports S-18 | S-06, S-14, S-19 | proposed |
| LM-07 | `product-walkthrough-demo` | Stakeholders can click through a trAInR demo/design deck covering key trainer/client flows | supports S-18 validation | S-18 direction approved | proposed |

## Recommended sequence

### LM-01: Client Today hub

**Outcome:** Client can open `/client/dashboard` and immediately understand
what to do next: today's/next session, status, trainer context, last session,
and direct actions for Start, Plan, History, and Comments.

**Why from LiftMate:** LiftMate's "Dzis / trening" screen is clearer than a
calendar-first entry point for a gym user holding a phone.

**trAInR fit:** Strong. It does not change the async model; it makes the
existing calendar/guided workout easier to enter.

**Scope notes:**

- Convert `/client/dashboard` from a welcome/minimal dashboard into a Today hub.
- Query the next not-started or in-progress assigned session.
- Show last finished/partial session summary if available.
- Link to `/client/plan` and session history/progress once LM-03 exists.
- Use `DESIGN.md` mobile-first layout: large title, high-contrast CTA, cards,
  thumb-zone actions.

**Risks:**

- Needs careful empty states for clients with no assigned sessions.
- Must avoid duplicating calendar logic; dashboard should summarize, not replace.

### LM-02: Post-workout readiness feedback

**Outcome:** After completing a session, a client can optionally leave a 1-5
readiness/wellbeing rating and comment. Trainer sees it read-only on the session
readout.

**Why from LiftMate:** LiftMate's feedback is small but powerful: structured
enough for trends, simple enough not to feel like a survey.

**trAInR fit:** Strong. trAInR already has session comments; structured feedback
can sit beside comments without becoming chat or AI.

**Scope notes:**

- Add a `session_feedback` or equivalent table with RLS.
- One feedback entry per client session; trainer read-only.
- Rating required only if user chooses to submit feedback; skipping is allowed.
- Preserve existing session comments unchanged.
- Add feedback display to trainer session readout and client finished summary.

**Risks:**

- Feedback timing must respect the 24h edit/seal model from S-13.
- Need a clear rule for whether feedback can be added after the edit window.

### LM-03: Client history and exercise progress flow

**Outcome:** Client can navigate: session history list -> read-only session
detail -> per-exercise progress. Trainer can reuse the same read-only detail
where appropriate.

**Why from LiftMate:** LiftMate turns logged numbers into visible progress and
keeps the drill-down understandable.

**trAInR fit:** Very strong. This directly consolidates existing proposed
roadmap items:

- S-12 `exercise-statistics`
- S-20 `finished-session-summary-for-client`

**Scope notes:**

- Treat S-12 and S-20 as one cohesive user journey.
- Start with raw history and simple trend values before estimated 1RM.
- Use working sets only for stats, respecting S-10 warm-up/working flags.
- Include finished, partially finished, and cancelled display decisions.
- Keep first version table/card based; advanced charts can follow later.

**Risks:**

- Stats query design must scale without exposing cross-tenant data.
- Estimated 1RM can mislead beginners; label as estimated and secondary.

### LM-04: Client consistency streak

**Outcome:** Client sees current and best weekly consistency streak; trainer sees
a small regularity signal on client cards.

**Why from LiftMate:** A weekly streak motivates without overbuilding
gamification.

**trAInR fit:** Medium-high. It supports adherence, but should remain secondary
to coaching quality.

**Scope notes:**

- Count weeks Monday-Sunday with at least one finished or partially finished
  session.
- Exclude cancelled and not-started sessions.
- Store or compute current/best streak; decide during planning based on query
  cost and timezone handling.
- Show streak on LM-01 Today hub and trainer dashboard cards.

**Risks:**

- Timezone/week-boundary rules must be explicit and tested.
- Streaks can demotivate after a missed week; copy should be supportive.

### LM-05: Trainer attention cards

**Outcome:** Trainer dashboard highlights clients needing attention using
explainable, dismissible guidance cards.

**Why from LiftMate:** LiftMate's guidance rules are concrete: stagnating load
or low wellbeing across recent sessions.

**trAInR fit:** Strong after LM-02 and LM-03 exist. It upgrades the trainer
dashboard without automatic program changes.

**Candidate rules:**

- **Low readiness:** last three feedback ratings average <= 3.
- **Stalled load:** same strength exercise has no top-working-load increase
  across the last three comparable completed sessions.
- **Missed adherence:** client has no finished/partial session in the current
  scheduled week while assigned sessions exist.
- **Comment needs reply:** client left a session comment after the trainer's
  last comment.

**Scope notes:**

- Start read-only and explainable: "Why am I seeing this?"
- Let trainer mark a card as reviewed/dismissed.
- Do not auto-edit sessions/templates.
- Use existing dashboard surface from S-07.

**Risks:**

- Comparable exercise matching can be wrong if exercises are cloned/renamed.
- Too many cards create noise; cap and prioritize.

### LM-06: Guided workout rest timer and active-set polish

**Outcome:** During guided workout, rest timer and active set values are more
glanceable, with stronger progress affordances and thumb-zone controls.

**Why from LiftMate:** LiftMate's live session screens make exercise number,
exercise name, set values, rest timer, and next action visually dominant.

**trAInR fit:** Strong as part of S-18 UI redesign and guided-workout polish.

**Scope notes:**

- Preserve existing guided workout data flow and debounced logging.
- Add persistent rest timer/progress treatment using prescribed rest values.
- Make active exercise and active set visually dominant.
- Align with `DESIGN.md` typography: large numerals, mono labels, bottom CTA.

**Risks:**

- Avoid disrupting existing autosave/navigation reliability.
- Needs mobile E2E coverage because this is a gym-critical path.

### LM-07: Product walkthrough demo

**Outcome:** A stakeholder can click through a trAInR walkthrough that covers
public landing, trainer dashboard, exercise library, templates, assignment,
client Today hub, guided workout, comments/feedback, and progress.

**Why from LiftMate:** LiftMate's demo communicates the product's value faster
than README text alone.

**trAInR fit:** Medium. This is not product functionality, but it improves
review, sales, and design iteration.

**Scope notes:**

- Build after S-18 direction is approved to avoid throwaway visuals.
- Can start as static Astro pages or a docs-only HTML prototype.
- Use seeded/demo data; never expose real Supabase data.

**Risks:**

- Demo can drift from implementation unless maintained with a clear owner.
- Should not block product improvements.

## Existing roadmap promotion proposal

If this research is accepted, update `context/foundation/roadmap.md` as follows:

1. Add `client-today-hub` before or alongside S-20.
2. Reframe S-12 and S-20 as a combined history/progress user journey, or add a
   note that they should be planned together.
3. Add `post-workout-readiness-feedback` before trainer guidance.
4. Add `client-consistency-streak` as a small engagement/adherence slice.
5. Add `trainer-attention-cards` after feedback and progress data exist.
6. Add `guided-workout-rest-timer-polish` under S-18 UI redesign or as an S-18
   sub-slice.
7. Add `product-walkthrough-demo` as a docs/design-support slice, not a core MVP
   dependency.

## Not recommended now

### Realtime trainer-led sessions

LiftMate's SignalR shared live-session model is impressive, but it pulls trAInR
away from its async-coaching thesis. It also adds substantial complexity:
presence, concurrent edits, conflict rules, reconnection, authorization, and
mobile network behavior.

Recommendation: keep realtime trainer-led sessions parked unless user research
shows independent trainers frequently supervise client sessions live.

### Native mobile app

LiftMate benefits from Flutter and APK distribution, but trAInR's current bet is
responsive web. A native app would duplicate auth, routing, release, and testing
surfaces.

Recommendation: improve mobile web UX first; revisit native only after the core
web experience proves retention.

### Heavy gamification

LiftMate keeps motivation narrow. trAInR should do the same. Avoid badges,
leaderboards, social feeds, or complex achievements until retention data
justifies them.

## Planning handoff

Best first implementation candidate: **LM-01 Client Today hub**, because it:

- improves the weakest client-facing entry point,
- reuses existing session/calendar/guided workout data,
- does not require new analytics tables,
- supports S-18 UI direction,
- creates a natural destination for later feedback, streak, and history cards.

Best first data-backed enhancement: **LM-02 Post-workout readiness feedback**,
because it provides structured signal for later trainer attention cards while
remaining additive to existing session comments.
