---
project: trAInR
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
created: 2026-05-22
updated: 2026-05-22
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "both — workflow fragmentation across tools AND missing closed-loop session logging with performance feedback"
    - topic: "competitive insight"
      decision: "existing tools assume real-time supervision, not async coaching; price floor too high for solo trainers"
    - topic: "persona scope"
      decision: "independent personal trainer with own client roster"
    - topic: "auth strategy"
      decision: "email+password plus Google OAuth; same for both roles"
    - topic: "client onboarding"
      decision: "invite link → registration → auto-assign to trainer"
    - topic: "role model"
      decision: "two roles: Trainer and Client; no admin role in MVP"
    - topic: "client removal"
      decision: "trainer can remove/reject a wrongly-assigned client (safety mechanism)"
    - topic: "template model"
      decision: "template = single training session; trainer builds client plan by placing sessions on calendar days one-by-one from templates or from scratch"
  frs_drafted: 28
  quality_check_status: accepted
---

## Vision & Problem Statement

Independent personal trainers manage their clients through scattered spreadsheets, chat messages, and PDF plans. Every time they build a plan, assign it, or check adherence, they're hunting across 3+ tools — burning coaching time on admin. Clients suffer too: with no single place to see their schedule and log progress, adherence drops. The pain is both fragmentation (too many tools) and a missing feedback loop (no structured way for clients to log what they actually did and for trainers to see it).

Existing tools (Trainerize, TrueCoach) solve parts of this, but they're built for gyms and multi-trainer organizations — independent trainers pay a complexity tax for features they'll never use, at a price floor ($10–50/mo) that doesn't pencil for someone with 5–10 clients. More fundamentally, they assume the trainer watches the client train in real time. trAInR's insight: independent trainers work asynchronously — the client trains alone and reports back. The product needs to be built around that async coaching model: exercise library → plan template → assigned plan → client logs session → trainer reviews.

## User & Persona

### Primary persona

**Role:** Independent personal trainer
**Context:** Manages their own roster of 5–30 active clients. Not employed by a gym; not part of a multi-trainer organization. Handles everything: exercise programming, plan assignment, session follow-up, client communication.
**Moment they reach for trAInR:** When they sit down to build a new training plan, assign it to a client, or check whether a client actually did the prescribed workout — and currently have to piece this together across spreadsheets, WhatsApp, and PDFs.

### Secondary persona (client)

**Role:** Client of an independent trainer
**Context:** Receives training plans, needs to see their schedule day by day, and logs actual performance at the gym. Currently receives plans as PDFs or chat messages and has no structured way to report back. Trains alone — the trainer is not present.

## Access Control

**Authentication:** Email + password and Google OAuth. Both trainers and clients use the same authentication methods.

**Client onboarding flow:** Trainer generates an invite link. Client registers through it (email+password or Google) and is automatically assigned to that trainer.

**Client removal:** Trainer can remove or reject a wrongly-assigned client — safety mechanism for leaked invite links. Severs the trainer-client assignment.

**Role model:** Two roles, no admin in MVP.

| Role        | Can do                                                                                                                                                                              | Cannot do                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Trainer** | Manage own profile, build exercise library, create plan templates, assign plans to clients, view all their clients' sessions and logs, see trainer dashboard, remove/reject clients | See other trainers' data, access platform admin                |
| **Client**  | View own assigned plans, see calendar of sessions, use guided workout view to log session metrics, view own history and stats, leave/read session comments                          | See other clients' data, modify plans, access trainer features |

**Unauthenticated access:** None — all routes are gated. Unauthenticated visitors see login/register only. Invite links lead to a registration page.

## Success Criteria

### Primary

- A trainer can go from sign-up to assigning a first plan to a client in under 10 minutes.
- 80% of clients who receive an invite link successfully complete registration and view their first plan.

### Secondary

- Clients log actual metrics for >= 60% of their scheduled sessions within the first 4 weeks.
- Trainers rate the plan-creation workflow >= 4/5 in a post-onboarding survey.

### Guardrails

- Client data privacy: a trainer can only see their own clients' data — never another trainer's clients, plans, or session logs.
- Data integrity: logged workout data (sets, reps, weights, completion status) never silently disappears, corrupts, or partially saves. If a write fails, the client sees an explicit error and can retry.

### MVP flow (10 steps)

1. Trainer signs up (email+password or Google)
2. Trainer creates exercises in their exercise library (name, type, muscle groups, notes, optional video/photo link)
3. Trainer creates session templates from their exercises (single-session templates: phases with prescribed sets/reps/load, rest time)
4. Trainer generates an invite link
5. Client registers via the invite link, auto-assigned to trainer
6. Trainer builds the client's plan by placing sessions on specific calendar days (from a template or from scratch), personalizing exercises as needed
7. Client opens their calendar view (month default, week toggle), sees sessions with status color-coding (not started / finished / finished partially)
8. Client opens today's session — enters the guided active workout view: one exercise at a time, logs set-by-set (reps + weight or time), sees previous performance hints from last workout
9. Session completes; client and trainer can both comment on it
10. Trainer sees the logged session on their dashboard (read-only detail view)

### Priority tiers (if time runs short, cut from Tier 3 first)

**Tier 1 — Core loop:** Auth + onboarding, exercise library, plan templates, plan assignment, calendar view (with status color-coding), guided workout view (set-level logging + previous performance hints), rest time per exercise (data field), trainer dashboard.

**Tier 2 — High value, product proves itself without:** Warm-up/working set flag, bidirectional session comments, manual session completion marking (finished vs partially finished), client removal safety mechanism.

**Tier 3 — Pressure valve (drop first):** Statistics (per-exercise history, estimated 1RM, volume/tonnage), 24h edit window for logged data.

### Timeline

- mvp_weeks: 3
- after_hours_only: true
- hard_deadline: null

## Functional Requirements

### Authentication & Onboarding

- FR-001: Trainer can register with email+password or Google OAuth. Priority: must-have
  > Socrates: Counter-argument considered: "Dual auth doubles the auth surface — ship email+password first, Google as fast-follow." Resolution: kept; acknowledged implementation cost but dual auth lowers onboarding friction. Consider email+password first if time is tight.
- FR-002: Trainer can log in and log out. Priority: must-have
  > Socrates: Counter-argument considered: "If sessions expire too aggressively, trainers lose work mid-plan-creation." Resolution: kept; session duration is a design detail. Ensure reasonable session length.
- FR-003: Trainer can generate an invite link for a new client. Priority: must-have
  > Socrates: Counter-argument considered: "Trainers might prefer to just add a client by email — invite links add a sharing step through an external channel." Resolution: kept; invite link is the chosen onboarding model. Direct email-based onboarding could be a future alternative.
- FR-004: Client can register via an invite link and be auto-assigned to that trainer. Priority: must-have
  > Socrates: Counter-argument considered: "If the link leaks, the wrong person gets assigned." Resolution: kept; mitigated by FR-006 (client removal). Invite links should have expiry or usage limits.
- FR-005: Client can log in and log out. Priority: must-have
  > Socrates: No counter-argument; it stands as written. Account creation is justified by active session logging at the gym.
- FR-006: Trainer can remove or reject a wrongly-assigned client. Priority: must-have [Tier 2]
  > Socrates: Counter-argument considered: "Removing a client could orphan their workout data — what happens to logged sessions?" Resolution: kept; data lifecycle on removal needs a design decision (delete data vs. sever assignment and retain data). Captured as open question.

### Exercise Library

- FR-007: Trainer can create exercises (name, type, muscle groups, notes, optional video/photo link). Priority: must-have
  > Socrates: Counter-argument considered: "A pre-populated exercise database would save trainers from entering common exercises." Resolution: kept as manual-only for MVP; pre-populated library is a future enhancement.
- FR-008: Trainer can edit exercises. Priority: must-have
  > Socrates: Counter-argument considered: "Archiving exercises for existing plans vs. deletion." Resolution: revised — archiving removed from MVP. Edit only. Archiving with plan-preservation logic deferred to post-MVP.
- FR-009: Trainer can browse and filter their exercise library by type and muscle group. Priority: must-have
  > Socrates: No counter-argument; it stands as written. Filtering is lightweight and useful even at small library sizes.

### Session Templates

- FR-010: Trainer can create a reusable session template from their exercise library, organized into phases (warm-up/main/cooldown) with prescribed sets/reps/load and rest time per exercise. Priority: must-have
  > Socrates: No counter-argument; it stands as written. Templates are single-session units — a template represents one training session, not a multi-day plan.
- FR-011: Trainer can edit existing session templates. Priority: must-have
  > Socrates: Clarification: editing a template does NOT retroactively update sessions already placed on client calendars. Templates are snapshots at the time of session creation.

### Plan Building & Assignment

- FR-012: Trainer can create a session on a specific day of a client's calendar — either from a session template or from scratch — and personalize exercises (move/remove/edit). One active plan (collection of sessions) per client. Priority: must-have
  > Socrates: Counter-argument considered: "Placing sessions one-by-one is tedious for a 4-week plan (16+ manual placements). Needs bulk placement or 'repeat weekly' shortcut." Resolution: kept for MVP; one-by-one placement is the minimum. Bulk/repeat is a high-priority post-MVP improvement.

### Client Calendar View

- FR-013: Client can view their assigned plan in a month view (default) with the ability to switch to week view. Priority: must-have
  > Socrates: No counter-argument; it stands as written. Month + week toggle covers overview and detail needs.
- FR-014: Sessions are visually distinguished by status (not started / finished / finished partially), visible to both client and trainer. Priority: must-have
  > Socrates: No counter-argument; it stands as written. Three statuses are clear and cover the meaningful states.

### Guided Active Workout View

- FR-015: Client can open a session and step through exercises one at a time in prescribed order (designed for one-handed phone use). Priority: must-have
  > Socrates: Counter-argument considered: "Some advanced lifters prefer seeing all exercises at once — the guided flow is opinionated." Resolution: kept; the guided view is the core differentiator for gym use. Advanced users can use the exercise list menu (FR-016) to jump around.
- FR-016: Client can navigate between exercises via an exercise list menu. Priority: must-have
  > Socrates: No counter-argument; it stands as written. The menu serves both as navigation and as an overview for users who want to see the full session.
- FR-017: Client can log each set individually: reps + weight in kg (or time for timed exercises). Negative values for assisted exercises, zero/null for bodyweight. Priority: must-have
  > Socrates: No counter-argument; it stands as written. Set-by-set logging matches real gym behavior.
- FR-018: Trainer can mark each prescribed round as warm-up or working when building session templates and assigning sessions. Client can flag each logged set as warm-up or working; when a log matches a prescribed round, it inherits that round's default and the client may override at log time. Only working logged sets count toward stats and hints. Priority: must-have [Tier 2]
  > Socrates: Counter-argument considered: "Client-only flagging is simpler and matches gym reality where warm-up volume varies." Resolution: revised — trainer prescribes intent to reduce client tap burden; client override preserves flexibility. Stats and hints use logged sets only.
- FR-019: Client sees performance data from the last workout containing this exercise (previous performance hints — raw data, not averaged). Priority: must-have
  > Socrates: Counter-argument considered: "Averaging across different rep ranges is misleading." Resolution: revised — show raw data from the last session containing this exercise (what weight/reps they did last time), not a computed average.
- FR-020: Starting a new session uses the guided one-exercise-at-a-time view; editing a previously logged session (if not yet locked) uses a list view showing all exercises. Priority: must-have
  > Socrates: Clarification from user: editing should use a list view (all exercises visible) rather than the guided view. The guided flow is for the live workout; editing is for quick corrections after the fact.
- FR-021: Client manually marks a session as "finished" or "finished partially". Priority: must-have [Tier 2]
  > Socrates: Counter-argument considered: "Auto-detection by comparing logged vs prescribed has edge cases (partial sets, different rep counts)." Resolution: revised — manual completion for MVP. Client explicitly chooses their completion status. Auto-detection deferred.
- FR-022: Logged data can be edited for 24 hours after first entry, then sealed (immutable). Priority: must-have [Tier 3]
  > Socrates: No counter-argument; it stands as written. Sealing prevents retroactive number inflation. For MVP, if this is cut (Tier 3), data remains always-editable.

### Session Comments

- FR-023: Both client and trainer can comment on a session (bidirectional). Priority: must-have [Tier 2]
  > Socrates: No counter-argument; it stands as written. If cut (Tier 2), fall back to one-way client→trainer notes.

### Statistics

- FR-024: Client can view a per-exercise history table showing past performances (weight, reps/time, sets) across all sessions. Priority: must-have [Tier 3]
  > Socrates: Counter-argument considered: "No history exists at launch — useless until client has weeks of data." Resolution: kept; the feature is low-cost and the data accumulates from day one. History visibility motivates continued logging.
- FR-025: Estimated 1RM is calculated from logged working sets (Epley formula) and displayed in per-exercise history. Priority: must-have [Tier 3]
  > Socrates: Counter-argument considered: "1RM formulas are inaccurate above 10 reps and misleading for beginners." Resolution: kept; acknowledged limitations. Display with appropriate context (e.g., "estimated").
- FR-026: Volume/tonnage (sets x reps x weight) is calculated and displayed in per-exercise history. Priority: must-have [Tier 3]
  > Socrates: Counter-argument considered: "Tonnage without trend context is meaningless — needs comparison to previous weeks." Resolution: kept; even a single number shows workout density. Trend comparison is a post-MVP enhancement.

### Trainer Dashboard

- FR-027: Trainer can see an overview of all their clients, assigned plans, and recent session activity. Priority: must-have
  > Socrates: Counter-argument considered: "With 20+ clients, a flat activity feed is noise — needs priority signals (missed sessions, recent completions)." Resolution: kept; dashboard should surface clients who need attention. Exact prioritization logic deferred to design.
- FR-028: Trainer can view a read-only detail view of a client's session showing exercises, sets, weights, and session comments. Priority: must-have
  > Socrates: Counter-argument considered: "Trainer should be able to annotate or flag specific sets." Resolution: kept as read-only for MVP. Trainer annotation/flagging of exercises and sets is post-MVP.

## User Stories

### US-01: Trainer onboards a client and assigns their first session

- **Given** a registered trainer with at least one exercise and one session template
- **When** they generate an invite link, the client registers through it, and the trainer creates a session on a specific day of the client's calendar (from a template or from scratch)
- **Then** the client sees the session in their calendar view and can open the guided workout view to log actual metrics, and the trainer sees the logged activity on their dashboard

#### Acceptance Criteria

- Invite link leads to a registration page; client is auto-assigned to the trainer on completion
- Trainer can place a session on any future calendar day for the client
- Session appears in the client's calendar with "not started" status
- Client can log weight/reps/time per set in the guided workout view
- Trainer dashboard reflects the client's logged session

## Business Logic

A trainer composes reusable session templates from their exercise library; when placed on a client's calendar, the system creates a personalized training session that the client executes through a guided flow and logs against — with previous performance data shown as hints to close the prescription-to-execution feedback loop.

The domain rule consumes three inputs: (1) the trainer's exercise definitions (name, type, muscle groups, prescription parameters), (2) a session template structure (phases with ordered exercises and prescribed sets/reps/load/rest time), and (3) per-client session customization (exercises personalized per calendar day). The output is a scheduled training session visible to the client in their calendar, where opening a session enters the guided workout view showing exercises one at a time with their prescriptions and previous performance data. The client encounters the rule as "open today's session → see what to do and what I did last time → log what I actually did." The trainer encounters the feedback as session completion data on their dashboard.

## Non-Functional Requirements

- Mobile-browser usable: the app is responsive and built mobile-first for phone use at the gym. All primary client interactions (viewing today's session, logging metrics per exercise in the guided view) work well on a phone screen.
- Data integrity: logged workout data (sets, reps, weights, completion status, comments) never silently disappears, corrupts, or partially saves. If a write fails, the client sees an explicit error and can retry.
- Privacy: strict cross-tenant data isolation enforced at the database level (RLS). A trainer's data (exercises, templates, clients, session logs) is invisible to other trainers. A client's data is visible only to their assigned trainer. No cross-tenant data leakage at any layer.

## Non-Goals

1. **No native mobile app** — web-only first; responsive design for phone browsers covers the gym use case.
2. **No subscription/billing system** — free tier only at launch. Monetization deferred.
3. **No client goals and progress tracking** — no weight/measurement/check-in tracking. Post-MVP.
4. **No advanced analytics or reports** — no volume trends, adherence heatmaps, or client comparison. Post-MVP.
5. **No notifications** — no email or push notifications. Post-MVP.
6. **No calendar integrations** — no Google Calendar sync, no iCal export. Post-MVP.
7. **No media asset uploads** — no progress photos or exercise demo videos hosted in-app. External links (YouTube, etc.) only.
8. **No in-app messaging/chat** — session comments (FR-023) are the only in-app feedback channel.
9. **No multi-trainer organizations or gym-level accounts** — single-trainer model only.
10. **No AI-powered plan generation or exercise suggestions** — all plan creation is manual.
11. **No audit logging** — no compliance event log.
12. **No plan templates (multi-week programs)** — sessions are placed on the calendar one-by-one from single-session templates or from scratch. Grouping session templates into reusable multi-week programs is post-MVP.
13. **No offline mode** — requires internet connection. Offline resilience (service workers, IndexedDB sync) is post-MVP.
14. **No pre-populated exercise database** — trainers build their library from scratch. Starter exercise packs are post-MVP.

## Forward: tech-stack

The existing project scaffold uses Astro 6 SSR with React 19 islands, Tailwind CSS 4, Supabase (auth + database), shadcn/ui, and Cloudflare Workers deployment. This context will be picked up by downstream stack selection / assessment.

## Open Questions

1. **What happens to client data when a trainer removes a client?** — Options: delete all client workout data, or sever the trainer-client assignment but retain client data (client can still log in and see their history). Owner: user. Block: no (affects FR-006 implementation detail, not product shape).

## Quality cross-check

All elements present. No gaps. Status: accepted.

## Forward: tech-stack

The existing project scaffold uses Astro 6 SSR with React 19 islands, Tailwind CSS 4, Supabase (auth + database), shadcn/ui, and Cloudflare Workers deployment. This context will be picked up by downstream stack selection / assessment.

## Forward: post-MVP features

From the improved idea notes, post-MVP features are organized into high-priority and low-priority tiers. See `docs/improved_idea_notes.md` for the full list. Key items: explicit skip-set action, RPE per set, workout duration tracking, offline mode, advanced statistics, plan template duplication, client goals, weekly check-ins, progress entries, notifications, calendar export, rest timer UI, supersets/circuits, exercise duplicate detection, data export, subscription tiers, multi-trainer accounts, AI plan generation.
