---
date: 2026-07-03T08:34:00Z
researcher: AI Agent (Cursor)
repository: ZawilecxD/trAInR
topic: "AI trainer assistant for client Q&A, support, and plan drafts"
tags: [research, ai, product-proposal, safety, roadmap]
status: proposed
linear_issue: ZAW-54
---

# Research: AI trainer assistant for trAInR

## Executive summary

The requested feature is a major product direction change: clients should be
able to use an AI trainer to create plans, ask questions, and receive specific
training support. That capability conflicts with the current MVP non-goal:
`context/foundation/prd.md` says "No AI-powered plan generation or exercise
suggestions", and `context/foundation/roadmap.md` parks AI-powered plan
generation.

Recommendation: introduce AI in phases, with human approval and safety
boundaries first:

1. **AI trainer Q&A support** - clients can ask training questions in the
   context of their assigned plan and history, but the assistant stays inside
   wellness/training education and refuses medical, injury, medication,
   pregnancy, eating-disorder, self-harm, or emergency advice.
2. **AI plan draft requests** - AI can generate structured draft session or
   program ideas from client goals, available exercises, history, and
   constraints, but drafts are not assigned to a calendar until a human trainer
   reviews and approves them.
3. **Trainer copilot** - trainers can use the same engine to draft session
   templates, modifications, and response suggestions, all mapped into existing
   trAInR data contracts.
4. **Client self-service AI plans** - only consider later, after the product
   owner explicitly lifts the current non-goal and accepts the liability,
   safety, observability, and pricing implications.

This preserves trAInR's async-coaching thesis while allowing AI to reduce
trainer admin and improve client support. It also keeps AI outputs inside
auditable, structured workflows instead of letting a chatbot directly mutate
plans.

## Current product constraints

### trAInR positioning

- trAInR is built around an async coaching loop: exercise library -> session
  template -> assigned calendar session -> guided client logging -> trainer
  review (`PRODUCT.md`, `context/foundation/prd.md`).
- The product serves independent personal trainers and their clients, with
  strict role clarity: clients should not see trainer-only controls, and
  trainers should understand which clients need attention (`PRODUCT.md`).
- The current PRD explicitly excludes AI-powered plan generation or exercise
  suggestions (`context/foundation/prd.md`, Non-Goals #10).
- The current roadmap parks AI-powered plan generation for the same reason
  (`context/foundation/roadmap.md`, Parked).

### Relevant shipped foundations

- Astro 6 SSR, React 19 islands, Tailwind 4, Supabase auth/RLS, Vercel adapter.
- API routes already follow a server-side pattern with `export const prerender =
  false`, zod validation, and role guards (`src/lib/api/guards.ts`).
- Existing domain data can feed AI context safely if scoped server-side:
  exercises, session templates, assigned sessions, set logs, trainer dashboard
  readouts, session comments, completion status, warm-up/working flags, and
  24h edit window behavior.
- There is no AI provider layer, prompt/version registry, conversation store,
  usage metering, safety event table, or audit log today.

### Adjacent research already in repo

The LiftMate research recommends "explainable trainer attention cards" before
automatic AI decisions. It specifically says to prefer explainable coaching
signals over autonomous plan changes (`context/changes/liftmate-research-zaw-48`).

This AI proposal should build on that caution. AI can summarize, explain,
draft, and escalate, but should not silently change workout prescriptions.

## External research summary

### AI API capabilities

Modern model APIs now support structured, schema-constrained outputs and strict
tool/function calling:

- OpenAI's Responses API supports structured outputs via `text.format` with
  JSON Schema, and tool/function calls can use strict schemas.
  Sources:
  - https://developers.openai.com/api/docs/guides/migrate-to-responses
  - https://developers.openai.com/api/docs/guides/function-calling
- Anthropic supports structured JSON outputs and strict tool use with
  grammar-constrained sampling.
  Sources:
  - https://platform.claude.com/docs/en/build-with-claude/structured-outputs
  - https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use

Implication for trAInR: AI plan drafts should not be free-form text blobs. The
model should return a strict schema that can be validated before anything is
displayed, saved, or converted into session templates.

### Safety guidance for health and wellness assistants

Health and wellness AI guidance consistently recommends layered guardrails:

- Do not rely on a disclaimer alone.
- Define the assistant's scope and hard refusal boundaries.
- Keep high-impact decisions human-reviewed.
- Use deterministic checks for red-flag topics.
- Log prompts, model versions, safety decisions, and human approvals.
- Deploy gradually and monitor real conversations.

Sources:

- Frontiers FAST framework for conversational AI health coach evaluation:
  https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2025.1460236/full
- Oura's guardrail and clinician-in-the-loop discussion:
  https://ouraring.com/blog/how-oura-evaluates-generative-ai-to-earn-trust/
- Governance playbook for AI health advisors:
  https://askqbot.com/governance-playbook-for-ai-health-and-wellness-advisors

Implication for trAInR: this feature needs product, data, safety, and
observability work. It is not just an API call.

## Recommended product shape

### Feature thesis

AI should act as a **trainer assistant**, not as an unaccountable replacement
for the human trainer. It should help clients understand their assigned plan,
prepare better questions, and request drafts. It should help trainers move
faster. Final plan assignment remains trainer-owned until the product explicitly
chooses self-service AI training.

### User stories

#### Client Q&A

- As a client, I can ask why today's session includes an exercise, how to
  interpret a prescribed set, or how to make a logged result clearer for my
  trainer.
- As a client, I receive answers grounded in my assigned sessions and logged
  history, with clear boundaries when a question is medical or unsafe.
- As a client, I can escalate a question to my trainer when the assistant is
  uncertain or out of scope.

#### Client plan draft request

- As a client, I can describe a goal, availability, constraints, and equipment.
- The assistant can generate a structured draft plan or session proposal.
- The draft is clearly marked "AI draft - trainer review required".
- The trainer can review, edit, reject, or convert it into existing session
  templates/assigned sessions.

#### Trainer copilot

- As a trainer, I can ask the assistant to draft a session template or adjust an
  existing session using a client's recent logs and comments.
- The assistant explains its reasoning and highlights assumptions.
- Nothing is assigned to the client until I approve it.

## Scope recommendation

### In scope for the first implementation plan

- Server-side AI provider abstraction.
- AI conversation API for authenticated clients and trainers.
- Strictly scoped retrieval of user-specific workout context.
- Safety classifier/red-flag routing before and after model output.
- Structured outputs for Q&A responses and plan drafts.
- AI draft persistence with review status.
- Trainer approval flow for drafts before calendar assignment.
- Usage/cost tracking and rate limiting.
- Audit/safety event logging.

### Out of scope for first implementation

- Fully autonomous AI plan assignment.
- AI changing existing sessions/templates directly.
- Medical, injury diagnosis, medication, pregnancy, nutrition prescription, or
  mental health advice.
- Realtime voice coaching.
- Native mobile app.
- Fine-tuning on private user data.
- Multi-agent automation that writes directly to Supabase without app-level
  validation.

## Proposed data model

New Supabase tables must have RLS enabled with granular per-operation policies.

### `ai_conversations`

Purpose: conversation threads for client Q&A and trainer copilot.

Candidate fields:

- `id`
- `owner_user_id`
- `role_scope` (`client` or `trainer`)
- `trainer_id` nullable
- `client_id` nullable
- `title`
- `status` (`active`, `archived`)
- `created_at`
- `updated_at`

Access:

- Client sees only conversations they own.
- Trainer sees their own conversations and conversations explicitly escalated
  by assigned clients.

### `ai_messages`

Purpose: auditable message history.

Candidate fields:

- `id`
- `conversation_id`
- `sender` (`user`, `assistant`, `system`, `safety`)
- `content`
- `structured_payload` jsonb nullable
- `model`
- `prompt_version`
- `input_token_count`
- `output_token_count`
- `created_at`

Access:

- Inherited from `ai_conversations`.
- Consider retention limits and redaction policy before storing sensitive
  health-like free text.

### `ai_plan_drafts`

Purpose: structured plans generated by AI, awaiting review.

Candidate fields:

- `id`
- `created_by_user_id`
- `client_id`
- `trainer_id`
- `source_conversation_id`
- `status` (`draft`, `submitted_for_review`, `approved`, `rejected`,
  `converted`)
- `goal_summary`
- `constraints`
- `draft_payload` jsonb
- `safety_notes`
- `reviewed_by_trainer_id` nullable
- `reviewed_at` nullable
- `converted_template_id` nullable
- `converted_session_ids` nullable jsonb
- `created_at`
- `updated_at`

Access:

- Client can create/read own drafts and submit for trainer review.
- Trainer can read/review drafts for assigned clients.
- Only trainer approval can convert a draft into real templates/sessions.

### `ai_safety_events`

Purpose: explicit record of red flags, refusals, escalations, and moderation.

Candidate fields:

- `id`
- `user_id`
- `conversation_id` nullable
- `plan_draft_id` nullable
- `event_type`
- `risk_level`
- `trigger`
- `action_taken`
- `created_at`

Access:

- Trainer visibility should be limited to assigned-client events that need
  trainer follow-up.
- Admin/audit access is not currently modeled; decide before production
  launch.

### `ai_usage_events`

Purpose: cost/rate-limit accounting.

Candidate fields:

- `id`
- `user_id`
- `model`
- `feature` (`client_qa`, `plan_draft`, `trainer_copilot`)
- `input_tokens`
- `output_tokens`
- `provider_request_id`
- `created_at`

## Proposed API surface

All API route files must export `const prerender = false`.

### `POST /api/ai/conversations`

Creates or resumes an AI conversation.

Guard:

- `requireAuthenticated`.

Contract:

- Validates role, optional target client, and conversation type.
- Trainer targeting a client must own that trainer-client relationship.

### `POST /api/ai/messages`

Sends a user message and returns assistant response.

Guard:

- `requireAuthenticated`.

Server responsibilities:

1. Validate message.
2. Load scoped user context server-side.
3. Run deterministic pre-safety checks.
4. Call provider with strict response schema.
5. Validate provider output.
6. Run post-safety checks.
7. Persist message, usage, and safety events.
8. Return structured response to UI.

### `POST /api/ai/plan-drafts`

Generates a plan or session draft.

Guard:

- Client can create only for self.
- Trainer can create only for assigned client.

Contract:

- Output is a draft only.
- Does not create session templates or assigned sessions.
- Draft payload must map to existing trAInR exercise/session concepts.

### `POST /api/ai/plan-drafts/[id]/submit`

Client submits a draft for trainer review.

### `POST /api/ai/plan-drafts/[id]/review`

Trainer approves, rejects, or requests changes.

### `POST /api/ai/plan-drafts/[id]/convert`

Trainer converts approved draft into existing session template/session creation
flows.

This endpoint should reuse existing session-template and plan-assignment
services rather than inserting related rows ad hoc.

## AI service architecture

### Directory proposal

- `src/lib/ai/provider.ts` - provider interface.
- `src/lib/ai/openai-provider.ts` or `src/lib/ai/anthropic-provider.ts` -
  concrete implementation.
- `src/lib/ai/schemas.ts` - zod schemas for request and strict provider output.
- `src/lib/ai/context.ts` - scoped data loaders for workouts, sessions, logs,
  comments, and exercise library.
- `src/lib/ai/safety.ts` - deterministic safety rules and refusal/escalation
  helpers.
- `src/lib/ai/service.ts` - orchestration.
- `src/pages/api/ai/...` - thin API route handlers.

### Provider selection

Start with one provider behind an interface. Do not build a multi-provider
router in the first slice unless there is an immediate operational need.

Provider requirements:

- Strict structured outputs or strict tool calling.
- Server-side API key only.
- Reasonable latency for chat-style response.
- Provider request IDs exposed for debugging.
- Clear data retention controls.

### Environment variables

Add server-only env schema entries in `astro.config.mjs` only when implementing:

- `AI_PROVIDER`
- `AI_API_KEY`
- `AI_MODEL`

Never expose these to client-side code and never commit `.env` values.

## Structured output contracts

### Q&A response shape

The assistant should return structured data like:

- `answer`: concise markdown/plain text.
- `scope`: `education`, `plan_explanation`, `logging_help`, `out_of_scope`,
  or `escalate_to_trainer`.
- `risk_level`: `none`, `low`, `medium`, `high`.
- `citations`: references to app context such as session dates, exercise names,
  or logged sets; never fabricate.
- `recommended_actions`: small list of safe actions, such as "ask your trainer"
  or "review today's session".
- `trainer_escalation`: nullable object with reason and suggested message.

### Plan draft shape

The assistant should return structured data like:

- `goal_summary`
- `assumptions`
- `client_constraints`
- `sessions`
  - `title`
  - `target_date_offset` or `week/day`
  - `phase`
  - `exercises`
  - `sets`
  - `reps_or_duration`
  - `load_guidance`
  - `rest_seconds`
  - `notes`
- `safety_notes`
- `requires_trainer_review`: always true in first implementation.

Provider output must be validated with zod before persistence.

## Safety model

### Hard boundaries

The assistant must refuse or escalate:

- pain, injury diagnosis, or rehab programming,
- medication, pregnancy, chronic disease, or medical condition guidance,
- eating disorder, self-harm, or crisis language,
- nutrition prescriptions beyond general non-medical education,
- unsafe max-effort recommendations,
- requests to ignore the trainer's plan,
- requests from a trainer to access another trainer's client data.

### Runtime guardrails

- Pre-check user input with deterministic keyword/intent rules.
- Post-check model output for prohibited claims and unsafe instructions.
- Always show product boundary language in AI surfaces.
- Offer escalation to trainer for plan-specific uncertainty.
- Log safety refusals and escalations.
- Rate-limit repeated unsafe prompts.

### Human-in-the-loop rule

For the first implementation, AI can draft and explain, but only a trainer can:

- assign sessions to the calendar,
- change an existing assigned session,
- create a reusable template from an AI draft,
- approve a multi-session plan for a client.

## UX proposal

### Client surface

Add an AI entry point from the client area only after the client has enough
context:

- client dashboard / Today hub,
- current session page,
- finished summary page,
- plan page.

First version should be framed as "Ask about your plan" rather than "AI doctor"
or "replace your trainer".

Important UI states:

- onboarding disclosure before first use,
- plan-context chips showing what the assistant can see,
- visible "Ask trainer" escalation CTA,
- draft status badges,
- safety refusal state,
- cost/rate-limit state if quota is reached.

### Trainer surface

Add trainer review surfaces:

- list of client-submitted AI drafts,
- draft detail with assumptions and safety notes,
- edit before convert,
- reject/request-changes message,
- convert to session template or assigned sessions.

The UI should avoid generic AI visual tropes that conflict with `PRODUCT.md`.
Keep the interface precise and workout-data-first.

## Implementation phases

### Phase 0: Product decision and roadmap amendment

Outcome: explicitly lift or revise PRD Non-Goal #10.

Work:

- Decide whether AI plan generation is trainer-approved only or client
  self-service.
- Decide whether AI is part of `trAInR MVP` or post-MVP.
- Update `context/foundation/prd.md` and `context/foundation/roadmap.md` only
  after product approval.

### Phase 1: AI foundation and safety logging

Outcome: server-only AI infrastructure exists without user-facing plan creation.

Work:

- Add provider interface and server-only env schema.
- Add AI database tables with RLS.
- Add scoped context loader.
- Add safety rules and usage logging.
- Add unit/integration tests for isolation, refusal, and output validation.

### Phase 2: Client AI Q&A

Outcome: clients can ask bounded questions about assigned plans and logged
history.

Work:

- Add conversation API.
- Add client UI entry point.
- Persist messages and usage.
- Support trainer escalation.
- Add E2E coverage for a normal answer and a safety refusal.

### Phase 3: Trainer copilot

Outcome: trainers can draft session/template ideas using client context.

Work:

- Add trainer-side prompt flows.
- Reuse structured draft schema.
- Display assumptions, missing data, and safety notes.
- Keep output as editable draft, not automatic writes.

### Phase 4: Client AI plan draft request

Outcome: clients can request a draft plan and submit it for trainer review.

Work:

- Add `ai_plan_drafts`.
- Add client draft request UI.
- Add trainer review queue.
- Add approve/reject/request-changes flow.

### Phase 5: Conversion to real trAInR plans

Outcome: approved drafts can be converted into existing templates or assigned
calendar sessions.

Work:

- Map draft exercises to trainer-owned exercise library rows.
- Require manual resolution for unknown exercises.
- Use existing session-template and plan-assignment services.
- Log trainer approval and conversion.

## Testing strategy

### Unit tests

- Safety classifier/refusal rules.
- zod request schemas.
- zod provider output schemas.
- context loader ownership filtering.
- draft-to-template/session mapping helpers.

### Integration tests

- RLS for all AI tables.
- trainer A cannot read trainer B AI conversations/drafts.
- client cannot submit draft for another client.
- trainer cannot review draft for unassigned client.
- AI API routes reject unauthorized roles.

### E2E tests

- client asks a safe plan question and sees grounded response.
- client asks injury/medical question and gets refusal/escalation.
- client creates draft and submits to trainer.
- trainer reviews and rejects/approves draft.
- approved draft conversion requires exercise resolution.

### Evaluation tests

Create a small benchmark set of prompts before launch:

- safe plan explanation,
- unsafe injury advice,
- medication/pregnancy edge cases,
- client tries to access another client's data,
- hallucination probe where context does not contain requested info,
- trainer asks for aggressive progression based on weak evidence.

Track pass/fail manually at first; automate once prompts stabilize.

## Observability and operations

Minimum production needs:

- AI request IDs in logs.
- Prompt/version IDs.
- token usage and cost events.
- refusal/escalation counts.
- draft approval/rejection counts.
- model latency.
- error rate by endpoint.
- safety event review workflow.

Q-05 production observability is currently parked. If AI ships before Q-05,
AI-specific logging must still land with the feature because unsafe AI behavior
requires evidence and review.

## Privacy and data retention

Open decisions before implementation:

- How long to retain AI conversation content.
- Whether users can delete AI conversations.
- Whether trainer can see client AI questions by default or only escalated
  threads.
- Whether messages are stored in full text, summarized, redacted, or encrypted.
- Whether provider data retention needs enterprise settings before launch.

Default recommendation:

- store messages for continuity and audit in first private beta,
- disclose storage before first use,
- limit trainer visibility to escalated/submitted items,
- add retention/deletion policy before broader release.

## Success criteria

### Product

- Clients can get useful, bounded help without leaving trAInR.
- Trainers receive better-prepared questions and useful draft starting points.
- No AI-generated plan reaches a client calendar without trainer approval in
  the first version.

### Safety

- Red-flag prompts refuse or escalate consistently.
- Assistant does not diagnose, prescribe medical care, or invent client data.
- Safety events are logged and reviewable.

### Technical

- AI provider key is server-only.
- All new tables have RLS and integration coverage.
- Provider output is schema-validated before persistence.
- Existing plan/template/session services remain the only path to durable plan
  assignment.

## Risks

- **Product drift:** client self-service plans can weaken trAInR's trainer-led
  async coaching position.
- **Safety liability:** plan advice can cross into medical/injury territory.
- **Data leakage:** AI context loading must respect trainer/client tenancy.
- **Cost creep:** chat and draft generation need quotas and usage tracking.
- **Hallucination:** assistant may invent history, exercises, or constraints if
  not forced to cite scoped context.
- **Trainer trust:** poor drafts can create more review work than they save.
- **Regulatory ambiguity:** health-adjacent coaching data may require stricter
  retention, consent, and audit decisions than current MVP scope.

## Open product decisions

1. Is the first AI release **trainer-approved only** or should clients ever get
   self-service plan assignment?
2. Should AI see only assigned workout data, or also comments, feedback, RPE,
   and future readiness signals?
3. Can trainers opt clients into AI, or is it enabled globally?
4. Are AI conversations visible to trainers by default, or only when escalated?
5. Is the first provider OpenAI, Anthropic, or selected later during
   implementation planning?
6. Is AI part of the current `trAInR MVP` Linear project or a post-MVP project?
7. What is the billing/usage model once clients can chat with AI?

## Recommended Linear issue outcome

Create one tracking issue for product approval and detailed planning:

**Title:** `ai-trainer-assistant: scope AI Q&A and trainer-approved plan drafts`

**Outcome:** Decide and plan an AI trainer assistant that lets clients ask
bounded plan questions and request AI-generated plan drafts, while preserving
trainer approval, Supabase/RLS isolation, structured outputs, safety logging,
and trAInR's async coaching positioning.

## References

- Product context: `PRODUCT.md`
- PRD non-goal: `context/foundation/prd.md`
- Roadmap parked AI item: `context/foundation/roadmap.md`
- LiftMate research: `context/changes/liftmate-research-zaw-48/research.md`
- LiftMate proposed roadmap:
  `context/changes/liftmate-research-zaw-48/proposed-roadmap.md`
- OpenAI Responses API:
  https://developers.openai.com/api/docs/guides/migrate-to-responses
- OpenAI function calling:
  https://developers.openai.com/api/docs/guides/function-calling
- Anthropic structured outputs:
  https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Anthropic strict tool use:
  https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use
- FAST framework:
  https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2025.1460236/full
- Oura AI guardrails:
  https://ouraring.com/blog/how-oura-evaluates-generative-ai-to-earn-trust/
- AI health advisor governance:
  https://askqbot.com/governance-playbook-for-ai-health-and-wellness-advisors
