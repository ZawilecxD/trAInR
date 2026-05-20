---
project: trAInR
version: 1
status: draft
created: 2026-05-20
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

Independent personal trainers manage their clients through scattered spreadsheets, chat messages, and PDF plans. Every time they build a plan, assign it, or check adherence, they're hunting across 3+ tools — burning coaching time on admin. Clients suffer too: with no single place to see their schedule and log progress, adherence drops.

Existing tools (Trainerize, TrueCoach) solve parts of this but are too complex and expensive for independent trainers who just need a clean, focused workflow. trAInR's insight: a trainer managing 5–30 clients doesn't need enterprise feature depth — they need a fast path from exercise library → plan template → assigned client plan → client logs results.

## User & Persona

### Primary persona

**Role:** Independent personal trainer
**Context:** Manages their own roster of 5–30 active clients. Not employed by a gym; not part of a multi-trainer organization. Handles everything: exercise programming, plan assignment, session follow-up, client communication.
**Moment they reach for trAInR:** When they sit down to build a new training plan, assign it to a client, or check whether a client actually did the prescribed workout — and currently have to piece this together across spreadsheets, WhatsApp, and PDFs.

### Secondary persona

**Role:** Client of an independent trainer
**Context:** Receives training plans, needs to see their schedule day by day, and logs actual performance (weight lifted, reps completed, etc.). Currently receives plans as PDFs or chat messages and has no structured way to report back.

## Success Criteria

### Primary
- A trainer can go from sign-up to assigning a first plan to a client in under 10 minutes.
- 80% of clients who receive a referral link successfully complete registration and view their first plan.

### Secondary
- Clients log actual metrics for >= 60% of their scheduled sessions within the first 4 weeks.
- Trainers rate the plan-creation workflow >= 4/5 in a post-onboarding survey.

### Guardrails
- Client data privacy: a trainer can only see their own clients' data — never another trainer's clients, plans, or session logs.

## User Stories

### US-01: Trainer onboards a client and assigns their first plan

- **Given** a registered trainer with at least one exercise and one plan template
- **When** they generate an invite link, the client registers through it, and the trainer assigns the plan template to the client
- **Then** the client sees their sessions in a calendar view and can log actual metrics for each session, and the trainer sees the logged activity on their dashboard

#### Acceptance Criteria
- Invite link leads to a registration page; client is auto-assigned to the trainer on completion
- Assigned plan appears in the client's calendar with the sessions the trainer scheduled
- Client can record weight/reps for strength exercises and time/distance for cardio exercises
- Trainer dashboard reflects the client's logged session within the same page load

## Functional Requirements

### Authentication & Onboarding
- FR-001: Trainer can register with email+password or Google sign-in. Priority: must-have
  > Socrates: Counter-argument considered: "Supporting both email+password AND Google doubles the auth surface — ship one first." Resolution: acknowledged; dual auth adds implementation cost but lowers onboarding friction. Consider shipping email+password first, Google as fast-follow if needed.
- FR-002: Trainer can log in and log out. Priority: must-have
  > Socrates: Counter-argument considered: "If sessions expire too aggressively, trainers lose work mid-plan-creation." Resolution: kept; session duration is a design detail, not an FR change. Ensure reasonable session length.
- FR-003: Trainer can generate an invite link for a new client. Priority: must-have
  > Socrates: Counter-argument considered: "Trainers might prefer to just add a client by email instead of generating a link." Resolution: kept; invite link is the chosen onboarding model. Adding by email could be a future alternative.
- FR-004: Client can register via an invite link and be auto-assigned to that trainer. Priority: must-have
  > Socrates: Counter-argument considered: "If the link leaks, the wrong person gets assigned — trainer needs a way to remove/reject." Resolution: kept; invite links should have expiry or usage limits. Trainer needs ability to remove a client (defensive requirement).
- FR-005: Client can log in and log out. Priority: must-have
  > Socrates: Counter-argument considered: "Clients won't bother creating an account." Resolution: kept; clients use the app actively during sessions to log reps/weights on the go — account creation is justified by the ongoing interaction, not just viewing a plan.

### Exercise Library
- FR-006: Trainer can create exercises (name, type, muscle groups, notes, optional video/photo link). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-007: Trainer can edit and archive exercises. Priority: must-have
  > Socrates: Counter-argument considered: "Archiving an exercise in active client plans could break those plans or confuse the client." Resolution: kept; archived exercises must remain visible in existing plans but not appear in library searches for new plans.
- FR-008: Trainer can browse and filter their exercise library. Priority: must-have
  > Socrates: Counter-argument considered: "With < 50 exercises, full-text search is overkill — a simple list with filters is enough." Resolution: revised; changed from "search" to "filter" for MVP. A filterable list (by type, muscle group) is sufficient at small library sizes.

### Plan Templates
- FR-009: Trainer can create a reusable plan template from their exercise library, organized into phases with prescribed sets/reps/load. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-010: Trainer can edit plan templates. Priority: must-have
  > Socrates: Counter-argument considered: "Duplicate is a nice-to-have — trainers can create a new template from scratch for MVP." Resolution: revised; split edit (must-have) from duplicate (nice-to-have).
- FR-010b: Trainer can duplicate plan templates. Priority: nice-to-have

### Plan Assignment
- FR-011: Trainer can assign a plan template to a client, creating a per-client copy that the trainer can personalize (move/remove/edit exercises per day). One active plan per client. Priority: must-have
  > Socrates: Clarification from user: it's NOT a rigid snapshot with a start date. Trainer assigns a copy of the template, then sets training sessions per calendar day and can tweak exercises per client. One active plan per client at a time.

### Client Experience
- FR-012: Client can view their assigned plan in a month view (summarizing planned sessions) with the ability to switch to week view. Priority: must-have
  > Socrates: Clarification from user: not day-view-only. Default is month view summarizing planned sessions; client can switch to week view to see detail ahead.
- FR-013: Client can mark a session as completed and record actual metrics — weight+reps for strength exercises, time+distance for cardio exercises. Priority: must-have
  > Socrates: Clarification from user: metrics are exercise-type-dependent. Strength = weight + reps. Cardio = time + distance. Not all four fields on every exercise.
- FR-014: Client can leave per-session notes visible to the trainer. Priority: must-have
  > Socrates: Counter-argument considered: "One-way notes (client → trainer) without trainer reply feels like shouting into a void." Resolution: kept for MVP; one-way is the minimum viable feedback channel. Trainer can respond through plan adjustments. Two-way messaging is post-MVP.

### Trainer Dashboard
- FR-015: Trainer can see an overview of all their clients, assigned plans, and recent session activity. Priority: must-have
  > Socrates: Counter-argument considered: "With 20+ clients, a flat list of recent activity is noise — needs filtering or priority signals." Resolution: kept; dashboard should surface clients who need attention (missed sessions, recent completions) rather than a raw activity feed. Detail deferred to design.

## Non-Functional Requirements

- Mobile-browser usable: the app is fully functional on a phone held in one hand at the gym. All primary client interactions (viewing today's session, logging metrics per exercise) are operable with one-handed thumb reach on a standard phone screen.
- Data integrity: a logged session (completed status, recorded metrics, notes) never silently disappears, corrupts, or partially saves. If a write fails, the client sees an explicit error and can retry.
- Privacy: a trainer's data (exercises, templates, clients, session logs) is invisible to other trainers. A client's data is visible only to their assigned trainer. No cross-tenant data leakage.

## Business Logic

A trainer composes reusable plan templates from their exercise library; when assigned to a client, the system creates a personalized, calendar-mapped training plan that the client executes and logs against — closing the feedback loop between prescription and actual performance.

The domain rule consumes three inputs: (1) the trainer's exercise definitions (name, type, muscle groups, prescription parameters), (2) a plan template structure (phases with ordered exercises and prescribed sets/reps/load), and (3) per-client customization (which exercises on which days, adjusted prescriptions). The output is a scheduled training plan visible to the client as a calendar of sessions, where each session lists the exercises to perform with their prescriptions. The client encounters the rule as "open today's session → see what to do → log what I actually did." The trainer encounters the feedback as session completion data on their dashboard.

## Access Control

**Authentication:** Email + password and Google sign-in. Both trainers and clients use the same authentication methods.

**Client onboarding flow:** Trainer generates a referral/invite link. Client registers through it (email+password or Google), and is automatically assigned to that trainer. Subsequent logins work identically to trainer logins.

**Role model:** Two roles.

| Role | Can do | Cannot do |
|---|---|---|
| **Trainer** | Manage own profile, build exercise library, create plan templates, assign plans to clients, view all their clients' sessions and logs, see trainer dashboard | See other trainers' data, access platform admin |
| **Client** | View own assigned plans, see calendar of sessions, log session metrics and notes, view own history | See other clients' data, modify plans, access trainer features |

**Unauthenticated access:** None — all routes are gated. Unauthenticated visitors see login/register only. Invite links lead to a registration page.

## Non-Goals

1. **No native mobile app** — web-only first; responsive design for phone browsers covers the gym use case.
2. **No subscription/billing system** — free tier only at launch. Monetization is a post-MVP concern.
3. **No client goals and progress tracking** — no weight/measurement/check-in tracking. Post-MVP roadmap item.
4. **No advanced analytics or reports** — no volume trends, adherence heatmaps, or client comparison. Post-MVP roadmap item.
5. **No notifications** — no email or push notifications. Post-MVP roadmap item.
6. **No calendar integrations** — no calendar sync or export. Post-MVP roadmap item.
7. **No media asset uploads** — no progress photos or exercise demo videos hosted in-app. External links to video platforms only.
8. **No in-app messaging/chat** — trainer and client communicate outside the app. Per-session notes (FR-014) are the only in-app feedback channel.
9. **No multi-trainer organizations or gym-level accounts** — single-trainer model only. Post-MVP roadmap item.
10. **No AI-powered plan generation or exercise suggestions** — all plan creation is manual. Post-MVP roadmap item.
11. **No audit logging** — no compliance event log. Post-MVP roadmap item.

## Open Questions

1. **Invite link expiry and usage-limit policy** — FR-004's Socrates round established that invite links need expiry or usage limits, but no specific values (e.g., 7-day expiry, single-use vs. multi-use) were set. Owner: user. Non-blocking for PRD, blocking for implementation.
2. **Client removal capability** — FR-004's Socrates round identified the need for a trainer to remove or reject a wrongly-assigned client, but no FR covers this explicitly. Should FR-016 be added? Owner: user. Non-blocking for PRD, important for safety.
3. **Archived exercise behavior in active plans** — FR-007 established that archived exercises must remain visible in existing plans but not appear in library searches. Exact UX for how this looks to the client (greyed out? labeled "archived"?) is undefined. Owner: user. Non-blocking.
4. **Dashboard prioritization strategy** — FR-015 acknowledged that a flat activity list won't scale to 20+ clients and should surface clients needing attention (missed sessions, recent completions). Specific prioritization rules and filtering UX are deferred. Owner: user. Non-blocking.
