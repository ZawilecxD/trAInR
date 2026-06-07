## trAInR — Improved Idea Notes

> Result of comparing the original trAInR concept with a similar Polish gym-tracking app and refining scope through structured discussion. Features are grouped into MVP, Post-MVP High Priority, and Post-MVP Low Priority.

---

## MVP

### Authentication & Onboarding

- **Trainer accounts & authentication** — trainers register (email+password; Google sign-in as fast-follow), log in, manage their profile
- **Client onboarding via invite link** — trainer generates an invite link; client registers through it and is auto-assigned to that trainer
- **Client removal** — trainer can remove or reject a wrongly-assigned client (safety mechanism for leaked invite links)

### Exercise Library

- **Per-trainer exercise library** — trainers build a personal database of exercises (name, type, muscle groups, notes, optional video/photo link)
- **Exercise editing and archiving** — archived exercises remain visible in existing plans but not in library searches
- **Browsable/filterable library** — filter by type, muscle group

### Plan Templates

- **Plan template creation** — trainers compose reusable templates from their exercise library, organized into phases (warm-up / main / cooldown) with prescribed sets/reps/load
- **Plan template editing** — trainers can modify existing templates
- **Rest time per exercise** — trainer can specify rest duration per exercise in the plan (data field only; countdown timer is post-MVP)

### Plan Assignment

- **Assign plan to client** — trainer instantiates a template into a client-specific plan; one active plan per client. Trainer can personalize (move/remove/edit exercises per day)

### Client Calendar View

- **Month view with week view toggle** — clients see upcoming and past sessions laid out by month (default) with ability to switch to week view
- **Session status color-coding** — sessions visually distinguished by status (not started / finished / finished partially), visible to both client and trainer

### Guided Active Workout View (replaces bulk session logging)

- **Exercise-by-exercise guided flow** — shows one exercise at a time in prescribed order; designed for one-handed phone use at the gym
- **Exercise list menu** — sidebar/menu showing all exercises in the session for quick navigation and jumping between exercises
- **Set-level logging** — each set logged individually: reps (or time for timed exercises) + weight in kg (negative values for assisted exercises, zero/null for bodyweight)
- **Warm-up / working set flag** — each logged set is tagged as warm-up or working; only working sets count toward stats and hints
- **Previous performance hints** — shows averaged data from the last workout containing this exercise (regardless of which plan), so the client knows what weight/reps to target
- **No "in progress" state** — sessions are simply: not started, finished, or finished partially
- **Start / Edit are the same view** — "Start" opens the guided view empty; "Edit" reopens it with previously entered data
- **Session completion logic** — auto-determined by checking if all prescribed sets/reps were completed at 100%. Incomplete = "finished partially"
- **24-hour edit window** — logged data can be edited for 24 hours after first entry, then sealed (immutable)

### Session Comments

- **Bidirectional per-session comments** — both client and trainer can comment on a session (client can explain partial completion; trainer can give feedback)

### Statistics

- **Per-exercise history table** — shows past performances (weight, reps/time, sets) for each exercise across all sessions
- **Estimated 1RM** — calculated from logged working sets (e.g. Epley formula), displayed in per-exercise history
- **Volume / tonnage** — total weight moved (sets × reps × weight), displayed in per-exercise history

### Trainer Dashboard

- **Client overview** — trainers see all their clients, assigned plans, and recent session activity
- **Session detail view** — read-only list view of a client's session showing exercises, sets, weights, and session comments

---

## Post-MVP High Priority

### Enhanced Workout Experience

- **Explicit skip set action** — client can explicitly skip a set with an optional reason/comment (vs. absence of data in MVP)
- **RPE (Rate of Perceived Exertion)** — subjective effort rating per set (1–10 scale)
- **Workout duration tracking** — derived from timestamps of first and last logged set
- **Offline mode** — resilience to poor gym connectivity; local storage with sync when connection returns (service workers + IndexedDB for web)

### Enhanced Stats & Tracking

- **Advanced statistics** — volume trends, adherence metrics, training frequency counts
- **Personal records (PR) detection** — automatic detection and highlighting of personal bests per exercise

### Plan Management

- **Plan template duplication** — quick cloning of templates for creating variants

### Engagement & Tracking (from original roadmap)

- **Client goals** — target metric, target value, target date with status tracking
- **Weekly check-ins** — adherence score, recovery score, comments
- **Progress entries** — body weight, measurements, notes
- **Progress photo uploads**

### Communication & Scheduling (from original roadmap)

- **In-app notification system** — plan assigned, session reminder, check-in due
- **Email / push notifications**
- **Calendar export** — iCal, Google Calendar sync

---

## Post-MVP Low Priority

### Workout Enhancements

- **Rest timer UI** — countdown timer between sets using the rest duration already stored in the plan
- **Supersets / circuits** — grouping exercises for alternating execution
- **Per-exercise notes within a workout** — short note per exercise (e.g. "knee pain", "bad form") in addition to per-session comments

### Exercise Library Enhancements

- **Exercise duplicate detection** — fuzzy matching suggestions when creating new exercises to prevent duplicates
- **Resistance bands management** — trainer-managed named bands with predefined resistance values; replaces negative-kg workaround with a proper UI

### Plan & Program Features

- **Deload weeks** — planned lighter weeks as a dedicated feature in training cycles
- **Ready-made starter plan templates** — prebuilt common programs (e.g. "Upper/Lower 4-day split") trainers can clone and customize

### Data & Export

- **Data export (CSV)** — trainers and clients can export training history for external analysis

### Monetization & Business (from original roadmap)

- **Trainer subscription tiers** — free / pro / premium via Stripe
- **Subscription & invoice management**
- **Client capacity limits per tier**

### Scale & Intelligence (from original roadmap)

- **Multi-trainer gym / organization accounts**
- **AI-assisted plan generation** from client goals and history
- **Advanced analytics dashboard** — adherence heatmaps, client comparison
- **Audit event log** for compliance
- **Mobile apps** — native iOS & Android

---

## Non-Goals (unchanged)

1. No native mobile app at launch — web-only, responsive design
2. No subscription/billing system at launch — free tier only
3. No in-app messaging/chat — session comments are the feedback channel
4. No multi-trainer organizations at launch
5. No AI-powered plan generation at launch
6. No audit logging at launch

## Success Criteria

- A trainer can go from sign-up to assigning a first plan to a client in **under 10 minutes**
- **80%** of clients who receive a referral link successfully complete registration and view their first plan
- Clients log actual metrics for **≥ 60%** of their scheduled sessions within the first 4 weeks
- Trainers rate the plan-creation workflow **≥ 4/5** in a post-onboarding survey
- Client knows exactly what to do, in what order, and with what weight when they arrive at the gym (based on previous performance hints)
- Completing a full workout according to the plan does not require paper, spreadsheets, or another app
