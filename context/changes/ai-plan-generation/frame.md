# Frame Brief: AI-generated training sessions and plans

> Framing step before `/10x-plan`. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

trAInR has no AI integration. Every training session is authored by hand by the
trainer: pick exercises from the library, set per-round reps/load/rest, place the
session on one calendar day. There is no way to produce a session — or a
multi-week plan — from a description of a client.

## Initial Framing (preserved)

- **Stated cause or approach**: the missing piece is an AI API integration —
  choose a provider (OpenAI, Claude, DeepSeek, OpenRouter) on quality-to-cost,
  and configure an agent role that is expert in sport, training planning, and
  periodization across strength and endurance.
- **Proposed direction**: integrate that API to create training sessions and
  session plans and assign them to the user, reusing the ZAW-57 / ZAW-58
  import/export work as the common data format.
- **Pre-dispatch narrowing**: not obtained. This frame ran as an autonomous
  cloud agent, so Step 1.5 could not be answered interactively. The scope
  questions are recorded under *Narrowing Signals* below with the assumption
  taken for each; each one is cheap to overturn and none changes the reframe.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Model capability / provider choice** — the model is not good enough at
   sport science, or the wrong provider is chosen, or the system prompt does not
   establish coaching expertise.  ← initial framing
2. **Grounding context availability** — trAInR does not store the client facts a
   coach programs against, so no prompt can produce individualized output.
3. **Output-to-domain data contract** — model output cannot be turned into valid
   trAInR rows, because every write path is UUID-bound.
4. **Domain model expressiveness** — a multi-week periodized plan, and an
   endurance prescription, have nowhere to live in the schema.
5. **Write path and authority** — there is no bulk session write, and "assigns
   them to the user" contradicts the trainer-accountability model.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| **1. Model capability is the blocker** | Two blinded expert studies find input detail dominates model choice: 25 licensed professionals rated GPT-5.1 vs Gemini Flash 2.5 resistance programs with *no significant difference* on any of quality, clarity, relevance, safety, usefulness (all P>.05, [preprint](https://doi.org/10.2196/preprints.93865)); 12 coaching experts found detailed prompts beat sparse prompts on nearly every criterion (p=0.000–0.037, [Biol Sport 2025](https://doi.org/10.5114/biolsport.2025.145911)); a crossover study found detailed input raised expert ratings on Personality, Safety, Feasibility *and* lowered output variance ([Biol Sport 2026](https://doi.org/10.5114/biolsport.2026.154148)). Model spread exists but is second-order (FITT-VP: Claude 3.7 50.2 vs DeepSeek R1 40.3 of 60, [Front Physiol 2026](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2026.1846567/full)). All four candidate providers already support schema-constrained output. | **WEAK** |
| **2. Grounding context is absent** | `profiles` has six columns — `id, role, display_name, avatar_url, created_at, updated_at` — and not one is coaching-relevant (`supabase/migrations/20260526120000_enums_profiles_helpers.sql:43`). No goal, target event, training age, equipment access, weekly availability, session time budget, injuries, bodyweight, age, sex, or tested max exists anywhere. PRD Non-Goal #3 parks client goals explicitly (`context/foundation/prd.md:188`); none of FR-001…FR-028 captures a client attribute. What *does* exist and is usable: per-set logs (reps, load, duration, RPE, warm-up flag), session status/adherence, free-text session comments, and derived Epley e1RM + tonnage (`src/lib/exercise-stats/calculations.ts:56,69`). | **STRONG** |
| **3. No usable output-to-domain contract** | `create_workout_session` takes `p_exercises jsonb` where every element must carry an `exercise_id` UUID, and raises `exercise not found or not owned by trainer` for anything else (`supabase/migrations/20260608130000_workout_session_rpcs.sql:144`). `sessionExerciseInputSchema` enforces the same at the API edge (`src/lib/workout-sessions/schemas.ts:23`). A language model cannot emit those UUIDs. Resolving by name is not currently safe either: `exercises.name` has **no** unique constraint per trainer (`supabase/migrations/20260526120200_exercise_library.sql:19`). A new trainer's whole vocabulary is 20 seeded exercises, 19 strength and 1 cardio (`supabase/migrations/20260620140200_starter_exercise_seed.sql`). No export, import, or name-based serialization exists anywhere in `src/`. ZAW-57 and ZAW-58 specify exactly this missing format and both are in Backlog, unimplemented. | **STRONG** |
| **4. Domain model cannot express a plan** | `client_plans` is `id, trainer_id, client_id, name, status, start_date` — no end date, no goal, no weeks, no blocks (`supabase/migrations/20260526120300_templates_and_plans.sql:166`). It is auto-created with the literal name `'Training plan'` on first session write (`20260608130000_workout_session_rpcs.sql:51`), so it is an implicit bucket, not a designed program. PRD Non-Goal #12 parks multi-week programs (`context/foundation/prd.md`). `exercise_phase` is `warm_up / main / cool_down` — within-session, not periodization (`20260526120000_enums_profiles_helpers.sql:27`). For endurance: `exercise_metric` includes `'distance'` (line 16) but `session_exercise_sets` has only `prescribed_reps`, `prescribed_duration_seconds`, `prescribed_load_kg`, `rest_after_seconds` (`20260608120000_session_exercise_sets.sql:8`) and `set_logs` only `reps, duration_seconds, load_kg` (`20260526120400_sessions_logging_comments.sql:97`). Distance, pace, HR zone, and interval structure are **not storable**. | **STRONG** |
| **5. No bulk write path; assignment authority undecided** | `create_workout_session` creates exactly one session per call, `SECURITY DEFINER`, keyed on `auth.uid()` being the assigned trainer (`20260608130000_workout_session_rpcs.sql:95`). There is no multi-session or transactional path, so a 12-week plan is N independent calls with no atomicity — ZAW-57 flags the same gap. Sessions become uneditable once started (line 282). The only roles are `trainer` and `client` (`src/lib/api/guards.ts:11,23`), and prior research already concluded AI must not assign: "only a trainer can assign sessions to the calendar" (`context/changes/ai-trainer-assistant/research.md:530`). | **STRONG** |

## Narrowing Signals

Scope questions that would normally be asked before dispatch, with the
assumption taken. None changes the reframe; each is cheap to overturn.

- **Who is "the user" that gets assigned to?** Assumed *the trainer's client*,
  with the trainer approving. The codebase has exactly two roles and no
  self-coaching path; a client cannot own a plan. If you actually meant a
  self-serve solo athlete, that is a different product, not this change.
- **Is "session plan" one session or a multi-week program?** Assumed
  *multi-week*, since single-session generation is already covered by session
  templates. This is what makes Dimension 4 load-bearing.
- **Is endurance in the first slice?** Assumed *deferred*. Strength is fully
  expressible today; endurance is not storable at all, so including it converts
  this from a feature into a schema project.
- **Does AI write directly, or draft for approval?** Assumed *draft for
  approval*, consistent with the decision already recorded for ZAW-54.

## Cross-System Convention

This codebase has confronted "who is allowed to create a training object" once
before and answered the same way both times. S-16 (ad-hoc client-logged
sessions) was **parked** precisely because it "changes creation ownership"
and needs "client-scoped session creation, session provenance, and trainer
dashboard semantics" first (`context/foundation/roadmap.md:344`). The ZAW-54
AI research reached the identical conclusion independently: AI may "summarize,
explain, draft, compare options" but "should not silently change workout
prescriptions" (`context/changes/ai-trainer-assistant/research.md:83`).

The house convention is therefore explicit: **a new writer of training data does
not get direct write access until provenance, ownership, and review are
modeled.** An AI generator is a new writer. The leading hypothesis matches the
convention.

The LiftMate research reinforces it from the product side — prefer "explainable
trainer attention cards" over "automatic AI decisions"
(`context/changes/liftmate-research-zaw-48/research.md`).

## Reframed Problem Statement

> **The actual problem to plan around is**: trAInR has no machine-writable
> representation of a training plan and no client profile to program against, so
> the model call is the last component to build, not the first.

The initial framing was not wrong about wanting AI — it was wrong about where
the difficulty sits. Provider choice and system-prompt expertise are the two
cheapest, most reversible decisions in this change, and the published evidence
says they are also the least consequential: the same prompt across different
frontier models produced statistically indistinguishable expert ratings, while
the same model given richer input improved on every rated dimension. Meanwhile
three genuine blockers sit underneath the model call — a UUID-bound write path a
model cannot satisfy, a client profile that does not exist, and a plan object
that is a bare auto-created row named `'Training plan'`.

The reframe changes what gets built first. Once a name-based, validated plan
transfer format and its exercise-resolution layer exist, AI generation is just
one more producer of that format, sitting alongside file import — and it becomes
a small, testable slice instead of an all-at-once integration. That format is
already specified in ZAW-57 and ZAW-58. **Those issues are not merely "related"
to this work; ZAW-57 is its prerequisite**, and building it first yields import/
export as a shipped feature even if the AI slice is later deferred.

On the knowledge question specifically: the thing to supplement is not textbook
sport science, which frontier models already carry. It is (a) the client facts
that constitute a needs analysis, which trAInR does not store; (b) the trainer's
own library and defaults as a closed vocabulary the model must select from
rather than invent; and (c) programming invariants enforced as deterministic
post-generation validation — load relative to tested capacity, weekly set volume
per muscle group, session count against stated availability — rather than as
prompt text a model may quietly ignore. Guideline frameworks worth encoding as
that validation layer, not as prose: FITT-VP, and the ACSM 2026 resistance
training position stand ([overview of reviews](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/)),
which notably also finds complex periodization is *not* consistently superior
for general healthy adults — a caution against making periodization the
headline feature.

## Confidence

**HIGH** — four of five dimensions returned STRONG evidence with direct schema
and RPC citations; the initial framing's dimension returned WEAK against two
independent blinded expert studies; and the reframe matches a convention this
team has already applied twice (S-16, ZAW-54) to the same underlying question.

## What Changes for `/10x-plan`

Plan the **plan-transfer format and exercise-resolution layer (ZAW-57/ZAW-58)
first**, as a standalone shippable slice, then a **client training-profile**
capture, and only then the model call as a third producer of the same validated
format — emitting trainer-reviewable drafts, never direct assignment. Treat
provider selection as a late, swappable decision behind one interface, and treat
multi-week periodization and endurance prescription as explicit schema
questions to answer before scoping, not as prompt-engineering.

## Reference: provider landscape

Recorded because it was asked for; the choice belongs to `/10x-plan`, after the
output schema exists and can be benchmarked. Priced per million tokens.

| Model | In / Out | Notes for this use case |
| --- | --- | --- |
| Gemini 2.5 Flash | $0.30 / $2.50 | Native response-schema; strong cost/quality floor for drafting |
| GPT-5 | $1.25 / $10.00 | Strict `json_schema` structured outputs, lowest schema-failure class |
| Claude Sonnet 4.6 | $3.00 / $15.00 | Strict tool use; Claude scored highest on FITT-VP expert ratings |
| DeepSeek V4 Flash | $0.14 / $0.28 | Cheapest by far, but weakest measured schema adherence and lowest FITT-VP score |
| OpenRouter | pass-through | One interface across all of the above; requires `require_parameters: true` so requests only route to endpoints that genuinely support `json_schema`, otherwise it silently degrades to `json_object` |

Given plan generation is low-volume (a handful of calls per client per block)
and quality is trainer-visible, token price is unlikely to be the deciding
factor; schema adherence on a deeply nested plan payload is. OpenRouter behind
the provider interface keeps the decision reversible and lets the same benchmark
set run across candidates once the output schema is fixed.

## References

- Session write path: `supabase/migrations/20260608130000_workout_session_rpcs.sql:95,144,282`
- Plan container: `supabase/migrations/20260526120300_templates_and_plans.sql:166`
- Prescription columns: `supabase/migrations/20260608120000_session_exercise_sets.sql:8`
- Enums: `supabase/migrations/20260526120000_enums_profiles_helpers.sql:9,16,27,43`
- Exercise library: `supabase/migrations/20260526120200_exercise_library.sql:19`
- API schemas: `src/lib/workout-sessions/schemas.ts:23`
- Role guards: `src/lib/api/guards.ts:11`
- Derived signals: `src/lib/exercise-stats/calculations.ts:56`
- Prior AI research: `context/changes/ai-trainer-assistant/research.md` (ZAW-54)
- Prior ownership precedent: `context/foundation/roadmap.md:344` (S-16 parked)
- Product commitments: `context/foundation/prd.md:188` (Non-Goals #3, #10, #12)
- Linear: [ZAW-57](https://linear.app/zawilecxd/issue/ZAW-57/add-importexport-for-training-plans), [ZAW-58](https://linear.app/zawilecxd/issue/ZAW-58/add-importexport-for-exercise-library)
