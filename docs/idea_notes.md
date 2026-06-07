## trAInR - MVP

### Core Problem

Personal trainers manage their clients through scattered spreadsheets, chat messages, and PDF plans. Clients lack a single place to view their training schedule, log progress, and communicate with their trainer — leading to poor adherence and wasted coaching time.

### Minimum Feature Set (MVP)

- **Trainer accounts & authentication** — trainers register, log in, manage their profile
- **Client onboarding via referral link** — trainer generates an invite link; client registers through it and is automatically assigned to that trainer
- **Exercise library (per-trainer)** — trainers build a personal database of exercises (name, type, muscle groups, notes, optional video/photo link) to reuse across plans
- **Plan templates** — trainers compose reusable training plan templates from their exercise library, organized into phases with prescribed sets/reps/load
- **Assign plans to clients** — trainers instantiate a template into a client-specific plan with a start date; the plan appears in the client's calendar view
- **Calendar day view for clients** — clients see their upcoming and past sessions laid out by day, with exercises and prescriptions for each session
- **Session logging & comments** — clients mark sessions as completed, record actual metrics (weight lifted, time, distance, etc.), and leave per-session notes visible to the trainer
- **Trainer dashboard** — trainers see an overview of all their clients, assigned plans, and recent session activity

### What is NOT in MVP Scope

- Mobile app (web-only first, responsive design for phone browsers)
- Subscription / billing system for trainers (free tier only at launch)
- Client goals and progress tracking (weight, measurements, check-ins)
- Advanced analytics and reports for trainers
- Notifications (email, push)
- Calendar integrations (Google Calendar, iCal export)
- Media asset uploads (progress photos, exercise demo videos hosted in-app)
- In-app messaging / chat between trainer and client
- Multi-trainer organizations or gym-level accounts
- AI-powered plan generation or exercise suggestions
- Audit logging

### Success Criteria

- A trainer can go from sign-up to assigning a first plan to a client in **under 10 minutes**
- **80%** of clients who receive a referral link successfully complete registration and view their first plan
- Clients log actual metrics for **≥ 60%** of their scheduled sessions within the first 4 weeks
- Trainers rate the plan-creation workflow **≥ 4/5** in a post-onboarding survey

---

## Full System — Post-MVP Roadmap

### Phase 2 — Engagement & Tracking

- Client goals (target metric, target value, target date) with status tracking
- Weekly check-ins (adherence score, recovery score, comments)
- Progress entries (body weight, measurements, notes)
- Progress photo uploads (MediaAsset)

### Phase 3 — Communication & Scheduling

- In-app notification system (plan assigned, session reminder, check-in due)
- CalendarEvent entity — proper time-slot scheduling with start/end times
- Email / push notifications
- Calendar export (iCal, Google Calendar sync)

### Phase 4 — Monetization & Business

- Trainer subscription tiers (free / pro / premium) via Stripe
- Subscription & Invoice management
- Client capacity limits per tier

### Phase 5 — Scale & Intelligence

- Multi-trainer gym / organization accounts
- AI-assisted plan generation from client goals and history
- Advanced analytics dashboard (volume trends, adherence heatmaps, client comparison)
- Audit event log for compliance
- Mobile apps (iOS & Android)

---

## ERD Sketch (Full System)

> Based on Excalidraw diagram (`app-coach-ERD.excalidraw`). Below is a text summary with suggested improvements marked with `[+]`.

### Entities

| Entity                     | Key Fields                                                                                                                                             | Notes                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| **Trainer**                | id, email, displayName, subscriptionTier, subscriptionStatus, createdAt                                                                                | Auth via external provider (e.g. Supabase Auth)                |
| **Client**                 | id, trainerId (FK), firstName, lastName, status, joinedAt                                                                                              | `[+]` Add `email`, `authId` for login; `[+]` Add `avatarUrl`   |
| **InviteLink** `[+]`       | id, trainerId (FK), token, expiresAt, maxUses, usedCount                                                                                               | `[+]` New entity — tracks referral links                       |
| **Goal**                   | id, clientId (FK), title, targetMetric, targetValue, targetDate, status                                                                                | Post-MVP                                                       |
| **ExerciseLibraryItem**    | id, trainerId (FK, nullable=global), name, exerciseType, trainingModality, difficultyLevel, youtubeUrl, photoUrl, defaultNotes, isArchived, timestamps | Trainer's personal exercise DB                                 |
| **MuscleGroup**            | id, name, region, isActive                                                                                                                             | System-wide reference data                                     |
| **ExerciseMuscleGroup**    | exerciseId (FK), muscleGroupId (FK), role (primary/secondary)                                                                                          | Many-to-many join                                              |
| **ExerciseTag**            | id, trainerId (FK, nullable=global), name, color                                                                                                       | Custom tags per trainer                                        |
| **ExerciseTagMap**         | exerciseId (FK), tagId (FK)                                                                                                                            | Many-to-many join                                              |
| **PlanTemplate**           | id, trainerId (FK), name, description, trainingModality, status, version, timestamps                                                                   | Reusable plan blueprints                                       |
| **PlanTemplatePhase**      | id, templateId (FK), phaseType, name, sortOrder, phaseNotes                                                                                            | Warm-up / main / cooldown etc.                                 |
| **PlanTemplateExercise**   | id, templatePhaseId (FK), exerciseId (FK), sortOrder, restAfterSeconds, exerciseNotes, prescription (JSON)                                             | `[+]` prescription JSON holds sets/reps/load/duration flexibly |
| **TemplateTagMap**         | templateId (FK), tagId (FK)                                                                                                                            | Many-to-many join                                              |
| **ClientPlan**             | id, trainerId, clientId, sourceTemplateId, sourceTemplateVersion, name, trainingModality, status, startDate, timestamps                                | Snapshot of template assigned to a specific client             |
| **ClientPlanPhase**        | id, clientPlanId (FK), phaseType, name, sortOrder, phaseNotes                                                                                          | Mirrors template phases, editable per client                   |
| **ClientPlanExercise**     | id, clientPlanPhaseId (FK), exerciseId (FK), sortOrder, restAfterSeconds, exerciseNotes, prescription (JSON)                                           | Mirrors template exercises, editable per client                |
| **ProgramAssignment**      | id, trainerId, clientId, templateId, clientPlanId, startDate, status, assignedAt                                                                       | Links trainer → template → client plan                         |
| **WorkoutSession**         | id, assignmentId (FK), clientPlanId (FK), clientId (FK), scheduledAt, status, sessionNotes                                                             | One calendar day's workout                                     |
| **WorkoutSessionExercise** | id, sessionId (FK), clientPlanExerciseId (FK), exerciseId (FK), sortOrder, plannedPrescription (JSON), actualMetrics (JSON), exerciseNotes             | Planned vs actual per exercise                                 |
| **ProgressEntry**          | id, clientId (FK), date, weight, measurements (JSON), note                                                                                             | Post-MVP body metrics                                          |
| **CheckIn**                | id, clientId (FK), weekStart, adherenceScore, recoveryScore, comment                                                                                   | Post-MVP weekly pulse                                          |
| **MediaAsset**             | id, ownerType, ownerId, assetType, storagePath, createdAt                                                                                              | Polymorphic file storage                                       |
| **CalendarEvent**          | id, trainerId, clientId, sessionId (FK), startAt, endAt, status                                                                                        | Post-MVP time-slot scheduling                                  |
| **Notification**           | id, trainerId, clientId, type, scheduledAt, sentAt                                                                                                     | Post-MVP                                                       |
| **Subscription**           | id, trainerId (FK), provider, externalId, plan, status, renewalAt                                                                                      | Post-MVP billing                                               |
| **Invoice**                | id, trainerId (FK), subscriptionId (FK), amount, currency, status, issuedAt                                                                            | Post-MVP billing                                               |
| **AuditEvent**             | id, actorId, actorRole, action, targetType, targetId, createdAt                                                                                        | Post-MVP compliance log                                        |

### Suggested ERD Improvements `[+]`

1. **Add `InviteLink` entity** — currently there's no way to model the referral link flow; this entity lets trainers generate, expire, and track invite links
2. **Add `email` and `authId` to Client** — clients need to log in; the current schema only stores name and status
3. **Add `SessionComment` entity** (id, sessionId FK, authorId, authorRole, body, createdAt) — separates conversation thread from the single `sessionNotes` field, enabling back-and-forth between trainer and client per session
4. **Consider `DayTemplate`** (a named group of exercises for a single day) as a mid-level building block between individual exercises and multi-week PlanTemplates — aligns with "store whole training session plans as building blocks"
5. **Add soft-delete (`deletedAt`)** to ExerciseLibraryItem, PlanTemplate, ClientPlan — safer than hard deletes for referenced data
