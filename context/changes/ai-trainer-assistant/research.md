---
date: 2026-07-17T18:33:00Z
researcher: AI Agent (Cursor)
repository: ZawilecxD/trAInR
topic: "AI trainer assistant for trainer-led client support, plan discussion, and reports"
tags: [research, ai, product-proposal, safety, roadmap]
status: proposed
linear_issue: ZAW-54
---

# Research: AI trainer assistant for trAInR

## Executive summary

The requested feature should be reframed from "AI for clients" to **AI for
trainers helping their clients**. The first useful slice is a trainer copilot
that helps the human trainer think through plan changes, choose exercise
alternatives for specific client situations, and generate progress reports with
proposed next steps.

This is a better fit for trAInR's current trainer-led async-coaching thesis than
client self-service AI. It still touches the current MVP non-goal
(`context/foundation/prd.md` says "No AI-powered plan generation or exercise
suggestions"), but it keeps the trainer as the accountable decision-maker:

1. **Plan-change discussion support** - trainers can ask AI to analyze a
   client's current plan, recent logs, comments, goals, and constraints, then
   suggest possible adjustments with assumptions and tradeoffs.
2. **Exercise alternatives and situation handling** - trainers can request
   preferred exercises or substitutions for situations such as missing
   equipment, low time, movement dislike, plateau, fatigue, travel, or
   technique concerns, without AI directly modifying the client's plan.
3. **Client progress reports** - trainers can generate a draft report that
   summarizes adherence, completed work, performance trends, friction points,
   and proposed next steps.
4. **Trainer-approved output only** - AI outputs stay as drafts,
   recommendations, or report text until the trainer edits and applies them.
   Client-facing AI chat and client-submitted plan drafts should remain later
   options, not the first implementation.

Recommendation: build a trainer-only assistant first. It should be grounded in
the trainer's own client data, constrained by safety rules, and designed around
editable artifacts rather than autonomous plan mutation.

## Current product constraints

### trAInR positioning

- trAInR is built around an async coaching loop: exercise library -> session
  template -> assigned calendar session -> guided client logging -> trainer
  review (`PRODUCT.md`, `context/foundation/prd.md`).
- The product serves independent personal trainers and their clients, with
  strict role clarity: clients should not see trainer-only controls, and
  trainers should understand which clients need attention (`PRODUCT.md`).
- The current PRD explicitly excludes AI-powered plan generation or exercise
  suggestions (`context/foundation/prd.md`, Non-Goals #10). A trainer-only
  copilot is still AI plan support, so product approval is needed, but the risk
  is lower than direct client self-service because trainer review is built in.
- The current roadmap parks AI-powered plan generation for the same reason
  (`context/foundation/roadmap.md`, Parked). This research recommends narrowing
  the parked item to "trainer assistant drafts and reports" before considering
  client-facing AI.

### Relevant shipped foundations

- Astro 6 SSR, React 19 islands, Tailwind 4, Supabase auth/RLS, Vercel adapter.
- API routes already follow a server-side pattern with `export const prerender =
  false`, zod validation, and role guards (`src/lib/api/guards.ts`).
- Existing domain data can feed trainer-facing AI context safely if scoped
  server-side: exercises, session templates, assigned sessions, set logs,
  trainer dashboard readouts, session comments, completion status,
  warm-up/working flags, and 24h edit window behavior.
- There is no AI provider layer, prompt/version registry, conversation store,
  usage metering, safety event table, or audit log today.

### Adjacent research already in repo

The LiftMate research recommends "explainable trainer attention cards" before
automatic AI decisions. It specifically says to prefer explainable coaching
signals over autonomous plan changes (`context/changes/liftmate-research-zaw-48`).

This AI proposal should build on that caution. AI can summarize, explain,
draft, compare options, and prepare trainer messages, but should not silently
change workout prescriptions.

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

Implication for trAInR: AI suggestions, report drafts, and plan-change options
should not be free-form text blobs only. The model should return a strict schema
that can be validated before anything is displayed, saved, or converted into
trainer-owned artifacts.

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
for the human trainer. It should help trainers reason faster about client
progress, plan changes, exercise choices, and communication. The trainer remains
responsible for deciding what reaches the client and what changes become part of
the durable plan.

### User stories

#### Trainer plan-change discussion

- As a trainer, I can select a client and ask how the current plan might be
  adjusted based on recent logs, comments, adherence, performance trends, and
  stated constraints.
- As a trainer, I receive several options with reasoning, assumptions, missing
  information, and risk/safety notes.
- As a trainer, I can convert an option into my own edited note, message,
  session-template draft, or future plan task, but AI does not directly assign
  anything.

#### Exercise alternatives for client situations

- As a trainer, I can ask for preferred exercises or substitutions for a
  client's situation: limited equipment, short session window, movement dislike,
  fatigue, plateau, travel, or technique concerns.
- The assistant grounds suggestions in the trainer's exercise library where
  possible and clearly marks when it is suggesting a new exercise not currently
  in the library.
- The assistant explains why each option fits, what to watch for, and when to
  avoid the option.

#### Progress report and next steps

- As a trainer, I can generate a draft client progress report for a selected
  date range.
- The report summarizes completed sessions, adherence, notable improvements,
  stalled areas, client comments, and proposed next steps.
- The trainer can edit tone, remove sensitive details, and decide whether the
  report is shared with the client.

#### Trainer copilot

- As a trainer, I can draft client messages, review notes, session-template
  ideas, and next-step checklists from the same AI workspace.
- The assistant explains its reasoning and highlights assumptions.
- Nothing is assigned to the client or shared with the client until I approve
  it.

## Scope recommendation

### In scope for the first implementation plan

- Server-side AI provider abstraction.
- Trainer-only AI workspace/API.
- Strictly scoped retrieval of trainer-owned client workout context.
- Safety classifier/red-flag routing before and after model output.
- Structured outputs for plan-change options, exercise alternatives, and
  progress reports.
- AI artifact persistence with draft/reviewed/applied states.
- Trainer editing flow before anything becomes client-facing or plan-changing.
- Usage/cost tracking and rate limiting.
- Audit/safety event logging.

### Out of scope for first implementation

- Fully autonomous AI plan assignment.
- AI changing existing sessions/templates directly.
- Client-facing AI chat.
- Client-submitted AI plan drafts.
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

Purpose: trainer-owned assistant threads, usually scoped to one client.

Candidate fields:

- `id`
- `owner_user_id`
- `trainer_id`
- `client_id` nullable
- `conversation_type` (`plan_discussion`, `exercise_alternatives`,
  `progress_report`, `general_trainer_support`)
- `title`
- `status` (`active`, `archived`)
- `created_at`
- `updated_at`

Access:

- Trainer sees only conversations they own.
- If a conversation is scoped to a client, the trainer must own that
  trainer-client relationship.
- Client access is not part of the first release.

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

### `ai_trainer_artifacts`

Purpose: structured AI-generated outputs that trainers can edit, save, share, or
apply manually.

Candidate fields:

- `id`
- `trainer_id`
- `client_id` nullable
- `source_conversation_id`
- `artifact_type` (`plan_change_options`, `exercise_alternatives`,
  `progress_report`, `client_message`, `session_template_draft`)
- `status` (`draft`, `edited`, `shared`, `applied`, `archived`)
- `title`
- `summary`
- `artifact_payload` jsonb
- `safety_notes`
- `trainer_edits` jsonb nullable
- `shared_with_client_at` nullable
- `applied_to_plan_at` nullable
- `converted_template_id` nullable
- `converted_session_ids` nullable jsonb
- `created_at`
- `updated_at`

Access:

- Trainer can create/read/update own artifacts.
- Client cannot read artifacts unless the trainer explicitly shares them.
- Applying an artifact to real templates/sessions must go through existing
  trainer-owned services and app validation.

### `ai_safety_events`

Purpose: explicit record of red flags, refusals, escalations, and moderation.

Candidate fields:

- `id`
- `user_id`
- `conversation_id` nullable
- `artifact_id` nullable
- `event_type`
- `risk_level`
- `trigger`
- `action_taken`
- `created_at`

Access:

- Trainer visibility should be limited to events from their own AI usage and
  assigned-client contexts that need follow-up.
- Admin/audit access is not currently modeled; decide before production
  launch.

### `ai_usage_events`

Purpose: cost/rate-limit accounting.

Candidate fields:

- `id`
- `user_id`
- `model`
- `feature` (`plan_discussion`, `exercise_alternatives`, `progress_report`,
  `trainer_copilot`)
- `input_tokens`
- `output_tokens`
- `provider_request_id`
- `created_at`

## Proposed API surface

All API route files must export `const prerender = false`.

### `POST /api/ai/conversations`

Creates or resumes a trainer-owned AI conversation.

Guard:

- `requireTrainer`.

Contract:

- Validates optional target client and conversation type.
- Trainer targeting a client must own that trainer-client relationship.
- Client role is rejected in the first release.

### `POST /api/ai/messages`

Sends a user message and returns assistant response.

Guard:

- `requireTrainer`.

Server responsibilities:

1. Validate message.
2. Load scoped trainer/client context server-side.
3. Run deterministic pre-safety checks.
4. Call provider with strict response schema.
5. Validate provider output.
6. Run post-safety checks.
7. Persist message, usage, and safety events.
8. Return structured response to UI.

### `POST /api/ai/artifacts`

Generates a trainer-owned AI artifact.

Guard:

- `requireTrainer`.
- Trainer can target only assigned clients.

Contract:

- Supported artifact types: plan-change options, exercise alternatives, progress
  report, client message, and session-template draft.
- Output is a draft only.
- Does not create session templates or assigned sessions.
- Payload must map to existing trAInR exercise/session/client-progress concepts
  where possible.

### `PATCH /api/ai/artifacts/[id]`

Trainer edits title, summary, content, status, and payload metadata.

### `POST /api/ai/artifacts/[id]/share`

Trainer shares a report or message with the client, if sharing is part of the
chosen product slice.

### `POST /api/ai/artifacts/[id]/apply`

Trainer applies an edited artifact through existing session-template/session
creation flows.

This endpoint should reuse existing session-template and plan-assignment
services rather than inserting related rows ad hoc.

## AI service architecture

### Directory proposal

- `src/lib/ai/provider.ts` - provider interface.
- `src/lib/ai/openai-provider.ts` or `src/lib/ai/anthropic-provider.ts` -
  concrete implementation.
- `src/lib/ai/schemas.ts` - zod schemas for request and strict provider output.
- `src/lib/ai/context.ts` - scoped data loaders for trainer-owned clients,
  workouts, sessions, logs, comments, and exercise library.
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

### Plan-change option shape

The assistant should return structured data like:

- `client_summary`: concise description of the client context used.
- `observations`: trends or facts from scoped app data, with citations.
- `options`: list of proposed changes.
  - `title`
  - `rationale`
  - `expected_benefit`
  - `tradeoffs`
  - `implementation_notes`
  - `confidence`
- `missing_information`: questions the trainer should answer before applying.
- `risk_level`: `none`, `low`, `medium`, `high`.
- `citations`: references to app context such as session dates, exercise names,
  or logged sets; never fabricate.
- `safety_notes`: boundaries, red flags, or trainer-review reminders.

### Exercise alternatives shape

The assistant should return structured data like:

- `situation_summary`
- `constraints`: equipment, time, movement preference, fatigue, skill, or other
  trainer-provided context.
- `preferred_options`
  - `title`
  - `exercise_id` nullable
  - `in_trainer_library`
  - `why_it_fits`
  - `setup_or_coaching_notes`
  - `avoid_when`
- `new_library_candidates`: optional suggestions not already in the trainer's
  library.
- `safety_notes`
- `requires_trainer_review`: always true.

### Progress report shape

The assistant should return structured data like:

- `report_title`
- `date_range`
- `client_facing_summary`
- `adherence_summary`
- `performance_trends`
- `notable_wins`
- `friction_points`
- `proposed_next_steps`
- `trainer_private_notes`
- `citations`
- `tone`: `supportive`, `direct`, `concise`, or `detailed`.
- `requires_trainer_edit`: always true.

Provider output must be validated with zod before persistence.

## Safety model

### Hard boundaries

The assistant must refuse or escalate:

- pain, injury diagnosis, or rehab programming,
- medication, pregnancy, chronic disease, or medical condition guidance,
- eating disorder, self-harm, or crisis language,
- nutrition prescriptions beyond general non-medical education,
- unsafe max-effort recommendations,
- requests to ignore trainer judgment or bypass trainer review,
- requests from a trainer to access another trainer's client data.

### Runtime guardrails

- Pre-check user input with deterministic keyword/intent rules.
- Post-check model output for prohibited claims and unsafe instructions.
- Always show product boundary language in AI surfaces.
- Prompt the trainer to gather more client information or refer out when the
  question is uncertain, medical, or outside training scope.
- Log safety refusals and escalations.
- Rate-limit repeated unsafe prompts.

### Human-in-the-loop rule

For the first implementation, AI can draft, compare, and summarize, but only a
trainer can:

- assign sessions to the calendar,
- change an existing assigned session,
- create a reusable template from an AI draft,
- approve a multi-session plan for a client,
- share a progress report or recommendation with the client.

## UX proposal

### Trainer surface

Add a trainer AI workspace from places where the trainer already reasons about a
client:

- client detail page,
- trainer dashboard attention cards,
- session template editor,
- assigned session detail,
- client progress/history view.

First version should be framed as "Assistant for this client" or "Draft next
steps" rather than "AI trainer". The interface should make it obvious that the
human trainer remains accountable.

Important UI states:

- onboarding disclosure before first use,
- context chips showing which client data the assistant can see,
- missing-data prompts,
- editable draft/report view,
- artifact status badges,
- safety refusal state,
- cost/rate-limit state if quota is reached.

Core trainer actions:

- discuss current plan changes,
- find exercise alternatives,
- draft client progress report,
- draft client message,
- save artifact,
- share report/message,
- apply edited artifact via existing plan/session flows.

The UI should avoid generic AI visual tropes that conflict with `PRODUCT.md`.
Keep the interface precise and workout-data-first.

## Implementation phases

### Phase 0: Product decision and roadmap amendment

Outcome: explicitly narrow or revise PRD Non-Goal #10 for trainer-only AI
assistance.

Work:

- Decide that the first release is trainer-only.
- Decide whether report sharing is part of the first release or save-only.
- Decide whether AI is part of `trAInR MVP` or post-MVP.
- Update `context/foundation/prd.md` and `context/foundation/roadmap.md` only
  after product approval.

### Phase 1: AI foundation and safety logging

Outcome: server-only AI infrastructure exists without client-facing AI or direct
plan mutation.

Work:

- Add provider interface and server-only env schema.
- Add AI database tables with RLS.
- Add scoped context loader.
- Add safety rules and usage logging.
- Add unit/integration tests for isolation, refusal, and output validation.

### Phase 2: Trainer plan discussion

Outcome: trainers can discuss a selected client's current plan and receive
structured, cited plan-change options.

Work:

- Add conversation API.
- Add trainer UI entry point from client detail/session surfaces.
- Persist messages and usage.
- Show context citations, assumptions, and missing information.
- Add E2E coverage for a normal plan discussion and a safety refusal.

### Phase 3: Exercise alternatives

Outcome: trainers can ask for exercise substitutions or preferred exercises for
specific client situations.

Work:

- Add guided prompt flows for equipment, time, preference, fatigue, plateau, and
  technique scenarios.
- Prefer exercises from the trainer's existing library.
- Mark new-library suggestions clearly.
- Display assumptions, missing data, and safety notes.
- Keep output as editable draft, not automatic writes.

### Phase 4: Progress reports

Outcome: trainers can generate draft progress reports and proposed next steps
for a selected client/date range.

Work:

- Add `ai_trainer_artifacts`.
- Add report-generation UI.
- Let trainer edit client-facing summary and private notes separately.
- Decide whether report sharing is included or deferred.

### Phase 5: Applying edited artifacts

Outcome: edited AI artifacts can assist existing trainer-owned template or
assigned-session workflows.

Work:

- Map artifact exercises to trainer-owned exercise library rows.
- Require manual resolution for unknown exercises.
- Use existing session-template and plan-assignment services.
- Log trainer application/share events.

## Testing strategy

### Unit tests

- Safety classifier/refusal rules.
- zod request schemas.
- zod provider output schemas.
- context loader ownership filtering.
- artifact-to-template/session mapping helpers.

### Integration tests

- RLS for all AI tables.
- trainer A cannot read trainer B AI conversations/artifacts.
- trainer cannot target unassigned client.
- client role cannot call trainer AI routes.
- AI API routes reject unauthorized roles.

### E2E tests

- trainer discusses a client plan and sees grounded options.
- trainer asks for injury/medical programming and gets refusal/escalation.
- trainer generates exercise alternatives for limited equipment.
- trainer generates and edits a progress report.
- applying an artifact requires exercise resolution and existing app flows.

### Evaluation tests

Create a small benchmark set of prompts before launch:

- safe plan-change discussion,
- unsafe injury advice,
- medication/pregnancy edge cases,
- trainer tries to access another trainer's client data,
- hallucination probe where context does not contain requested info,
- trainer asks for aggressive progression based on weak evidence.

Track pass/fail manually at first; automate once prompts stabilize.

## Observability and operations

Minimum production needs:

- AI request IDs in logs.
- Prompt/version IDs.
- token usage and cost events.
- refusal/escalation counts.
- artifact saved/shared/applied counts.
- report generation counts.
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
- Whether clients can see shared reports/messages only, or any AI provenance.
- Whether messages are stored in full text, summarized, redacted, or encrypted.
- Whether provider data retention needs enterprise settings before launch.

Default recommendation:

- store messages for continuity and audit in first private beta,
- disclose storage before first use,
- limit client visibility to trainer-shared artifacts only,
- add retention/deletion policy before broader release.

## Success criteria

### Product

- Trainers can get useful, bounded planning support without leaving trAInR.
- Trainers can generate draft progress reports and next-step recommendations
  faster than writing them from scratch.
- No AI-generated recommendation reaches a client calendar or client-facing
  report without trainer approval in the first version.

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

- **Product drift:** AI suggestions can weaken trainer accountability if the UI
  implies the assistant is the coach.
- **Safety liability:** plan-change advice can cross into medical/injury
  territory.
- **Data leakage:** AI context loading must respect trainer/client tenancy.
- **Cost creep:** trainer chat, alternatives, and report generation need quotas
  and usage tracking.
- **Hallucination:** assistant may invent history, exercises, or constraints if
  not forced to cite scoped context.
- **Trainer trust:** poor suggestions or reports can create more review work
  than they save.
- **Regulatory ambiguity:** health-adjacent coaching data may require stricter
  retention, consent, and audit decisions than current MVP scope.

## Open product decisions

1. Is the first AI release **trainer-only**, with no client-facing AI chat?
2. Should AI see only assigned workout data, or also comments, feedback, RPE,
   and future readiness signals?
3. Should progress reports be shareable with clients in the first release, or
   saved as trainer-private drafts only?
4. Should exercise alternatives prefer only the trainer's existing library, or
   can AI suggest new exercises for the trainer to add?
5. Is the first provider OpenAI, Anthropic, or selected later during
   implementation planning?
6. Is AI part of the current `trAInR MVP` Linear project or a post-MVP project?
7. What is the billing/usage model for trainer AI usage?

## Recommended Linear issue outcome

Create one tracking issue for product approval and detailed planning:

**Title:** `ai-trainer-assistant: scope trainer AI copilot and progress reports`

**Outcome:** Decide and plan a trainer-facing AI assistant that helps trainers
discuss plan changes, choose exercise alternatives for client situations, and
draft progress reports with proposed next steps, while preserving trainer
approval, Supabase/RLS isolation, structured outputs, safety logging, and
trAInR's async coaching positioning.

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
