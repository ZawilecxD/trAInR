# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-29 (cross-reference roadmap `Q-04: add-e2e-ci-gate` for E2E CI promotion)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in `area`"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/`, `tests/` (excludes docs, build output, lockfiles, and generated output).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                                                                                                                                                 | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Cross-tenant isolation breach** — Trainer A reads OR writes/deletes Trainer B's clients, templates, exercises, session logs, or invite/RPC-owned rows (or a client sees another client's data), despite the shipped RLS harness                                       | High   | Medium     | PRD §Non-Functional ("never visible to other trainers", "no cross-tenant data leakage"), §Access Control; archived Phase 1 harness complete; Q-02 hardening complete; Q-03 invite RPC gap still open; hot-spot dirs `supabase/`, `tests/integration/`                                                     |
| 2   | **Session-template write corruption or wrong prescription** — template create/edit inserts exercises then per-round sets without a proven transaction; a mid-sequence failure or round-form drift leaves partial rows, wipes exercises, or saves the wrong prescription | High   | High       | PRD §Non-Functional ("never silently disappears, corrupts, or partially saves… explicit error and can retry"); original interview concern about multi-step write failure; refresh hot-spot dir `src/lib/session-templates/`; user concern: session-template/round-form confidence                         |
| 3   | **Missing or drifted route authorization** — an API route omits or diverges from the auth/role guard and returns a 200 to an unauthenticated or wrong-role caller                                                                                                       | High   | Medium     | interview Q3 ("copy-paste the guard, hope I didn't miss one"), Q4; existing unit coverage stops at the guard helper, not the route inventory                                                                                                                                                              |
| 4   | **Invite-link abuse** — a leaked, expired, already-consumed, or wrong-client invite token still completes registration and auto-assigns the registrant to a trainer                                                                                                     | Medium | Medium     | PRD FR-003, FR-004 (Socrates: "if the link leaks, the wrong person gets assigned"); roadmap S-03; archived Phase 1 known-gap workflow; open Q-03 hardening change; hot-spot dir `supabase/`                                                                                                               |
| 5   | **Validation ↔ DB-constraint parity** — server-side Zod rules diverge from database checks (load `0`=bodyweight, negative=assisted; each round requires reps OR duration), so valid input is rejected or invalid input is persisted                                     | Medium | Medium     | roadmap §S-04 risk note ("template schema currently rejects negative" vs ERD); refresh research found stronger cross-domain divergence signal; hot-spot dirs `src/lib/session-templates/`, `src/lib/set-logs/`                                                                                            |
| 6   | **Guided-workout false safety on client logging** — a client believes set logs were saved, especially on mobile or quick navigation, but debounced autosave never persisted or failed silently; reload later shows missing data                                         | High   | Medium     | S-06 guided logging shipped; refresh hot-spot dirs `src/components/guided-workout/`, `src/lib/set-logs/`, `tests/e2e/`; user concerns: mobile guided-workout flow, autosave false-safety, E2E for session/template creation; §7 re-evaluation trigger for non-trivial client-side logging state has fired |

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                                            | Must challenge                                                                                                                                | Context `/10x-research` must ground                                                                                                       | Likely cheapest layer                                                                             | Anti-pattern to avoid                                                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| #1   | Acting as the wrong trainer/client, every read, update, delete, and RPC-owned operation returns empty or denied                                                                        | "the RLS harness is complete ⇒ every ownership edge is safe"; verify production-facing code uses anon / RLS-bound clients, not `service_role` | current RLS/RPC coverage, Q-03 invite gap, whether new tables/RPCs landed after Phase 1, how two real authenticated identities are seeded | integration (DB seeded with two trainers/clients)                                                 | mocking Supabase; testing reads only and not writes/deletes/RPCs                           |
| #2   | After a forced session-template create/edit failure, the DB holds either the complete intended template or the prior valid state; round counts and warmup/load fields reload correctly | "the happy-path template save or form unit test proves persistence"; "delete-then-reinsert is safe because FK cascade exists"                 | whether template writes are transactional, what failure injection is possible, how round-form payloads map to persisted rows              | integration for failure integrity; secondary E2E for critical template/session form reload        | asserting only the happy path; copying the service's cleanup logic as the test oracle      |
| #3   | Each protected route returns 401 with no session and 403 for the wrong role, before any data work happens                                                                              | "the guard helper has tests ⇒ every route calls it correctly"; an enumerated route inventory is required, not assumed                         | the full protected-route inventory; how to fabricate unauthenticated and wrong-role request context in Astro SSR                          | integration or handler-level test per route                                                       | re-testing the guard helper in isolation and assuming routes call it                       |
| #4   | Expired, already-consumed, malformed, or wrong-client invite tokens cannot complete registration or trainer assignment                                                                 | "valid-token signup works ⇒ expiry, single-use, and client ownership are enforced"; where is enforcement actually checked — RPC or app code?  | invite RPC logic, expiry/consumption enforcement point, token uniqueness, client identity binding, open Q-03 hardening scope              | integration (DB + RPC)                                                                            | testing only the valid-token signup; trusting client-supplied token state                  |
| #5   | Boundary loads (`0`, negative, null) and reps-XOR-duration rounds are accepted or rejected identically by Zod and by the DB check constraint                                           | "the schema unit test passing ⇒ the DB agrees"; the known roadmap divergence is real and must be reconciled                                   | DB constraints vs current Zod schemas across templates, workout sessions, and set logs; S-04 load semantics                               | unit (schema) + a thin integration assertion against DB constraints                               | a schema-only test that never confirms the DB actually agrees                              |
| #6   | A client can log a guided-workout set on mobile, navigate quickly, reload, and see the saved value; failed autosave is visible and retryable rather than silently lost                 | "debounce eventually fires ⇒ user data is safe"; "desktop happy path proves mobile"; "no visible error means save succeeded"                  | autosave lifecycle, navigation/unmount behavior, API failure handling, mobile-only navigation, current auth fixture shape                 | primary E2E target: narrow Playwright mobile/reload flow, backed by hook/component autosave tests | e2e for every UI detail; asserting spinner presence instead of persisted data after reload |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                           | Goal (one line)                                                                                                                           | Risks covered | Test types         | Status      | Change folder                                             |
| --- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------ | ----------- | --------------------------------------------------------- |
| 1   | RLS isolation harness                | Stand up the integration/DB test harness and prove Trainer A ≠ Trainer B for read, write, delete, and RPC access                          | #1            | integration        | complete    | context/archive/2026-06-07-testing-rls-isolation-harness/ |
| 2   | Route authorization coverage         | Every protected API route returns 401 (no session) and 403 (wrong role) before any data work                                              | #3            | integration        | not started | —                                                         |
| 3   | Service write-path integrity         | A forced mid-write failure leaves no partial rows and surfaces an explicit error, especially for session-template writes                  | #2            | integration        | not started | —                                                         |
| 4   | Invite + validation parity           | Expired/used/malformed invite tokens are rejected; Zod and DB constraints agree on loads and rounds                                       | #4, #5        | integration + unit | not started | —                                                         |
| 5   | Guided-workout + form E2E confidence | Prove guided-workout autosave/mobile first, then session-template/session creation form persistence where lower layers cannot give signal | #6, #2        | e2e + unit         | not started | —                                                         |

**Status vocabulary** (fixed — parser literals): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer                  | Tool       | Version | Notes                                                                                                                                                 |
| ---------------------- | ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit                   | Vitest     | 4.x     | wired; `node` env via `vitest.config.ts`, `include: src/**/*.test.ts`; meaningful suite across `src/lib/` domains                                     |
| integration (DB / RLS) | Vitest     | 4.x     | wired via `vitest.integration.config.ts`, `include: tests/integration/**/*.test.ts`, Supabase env setup, and CI `test-integration` job                |
| API route / handler    | Vitest     | 4.x     | planned for §3 Phase 2; guard helpers have unit coverage, but route-level 401/403 inventory is still open                                             |
| e2e                    | Playwright | 1.x     | wired via `playwright.config.ts` and `npm run test:e2e`; `tests/e2e/seed.spec.ts` is the current exemplar; local-only, not CI-gated today (roadmap `Q-04: add-e2e-ci-gate` tracks promoting it to a PR gate) |
| accessibility          | none       | —       | out of scope for this rollout unless a future guided-workout/mobile phase identifies a behavior that cannot be proven by cheaper deterministic checks |

**Stack grounding tools (current session):**

- Docs: Context7 — available; use for current Astro, Vitest, Playwright, and Supabase testing APIs when planning new rollout phases. checked: 2026-06-28
- Search: Exa.ai — available; use only for current tool discovery/status, then prefer official docs as evidence. checked: 2026-06-28
- Runtime/browser: Playwright config exists in-repo; use the local E2E layer only when lower layers cannot prove the user-visible failure. checked: 2026-06-28
- Provider/platform: GitHub (CI gate wiring) + Linear (issue linking) are available; Supabase CLI backs the local/CI integration harness. checked: 2026-06-28

Use docs MCPs for current framework/library APIs and setup details. Use
search MCPs for discovery or current status only, then prefer official docs
as the evidence. Do not use MCP docs/search to infer code failure anchors;
those belong in per-phase `/10x-research`.

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase `N`" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate                          | Where      | Required?                   | Catches                                                            |
| ----------------------------- | ---------- | --------------------------- | ------------------------------------------------------------------ |
| lint + typecheck              | local + CI | required                    | syntactic / type drift                                             |
| unit                          | local + CI | required (in place)         | validation/logic regressions in `src/lib/`                         |
| integration (RLS isolation)   | local + CI | required (Phase 1 complete) | cross-tenant leaks, broken isolation                               |
| integration (route authz)     | local + CI | required after §3 Phase 2   | unauthenticated / wrong-role access                                |
| integration (write integrity) | local + CI | required after §3 Phase 3   | partial-write corruption                                           |
| E2E critical flows            | local      | planned / selective         | full browser regressions that lower layers cannot prove (CI promotion tracked by roadmap `Q-04: add-e2e-ci-gate`) |
| `npm test` step in CI         | CI on PR   | required (in place)         | unit regressions reaching `main`                                   |
| `npm run test:integration`    | CI on PR   | required (in place)         | Supabase-backed RLS/RPC regressions reaching `main`                |
| `npm run test:e2e`            | local      | not CI-gated today (see roadmap `Q-04`) | trainer/client browser flows that need cookies, navigation, reload |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase `N`."

### 6.1 Adding a unit test

- **Location**: next to the unit under test in `src/lib/<domain>/` (e.g. `src/lib/exercises/`).
- **Naming**: `<module>.test.ts`.
- **Reference test**: `src/lib/exercises/schemas.test.ts`, `src/lib/api/guards.test.ts`.
- **Run locally**: `npm test` (or `npx vitest <path>`).

### 6.2 Adding an integration test (DB / RLS)

- **Location**: `tests/integration/<area>/<scenario>.test.ts`.
- **Config**: `npm run test:integration` uses `vitest.integration.config.ts`, `tests/integration/setup.ts`, and `INTEGRATION_SUPABASE_URL`, `INTEGRATION_SUPABASE_ANON_KEY`, `INTEGRATION_SUPABASE_SERVICE_ROLE_KEY`.
- **Fixture pattern**: use helpers from `tests/integration/helpers/`; seed with the admin/service-role helper, then assert behavior through anon/RLS-bound authenticated clients.
- **Reference tests**: `tests/integration/rls/*.test.ts`, `tests/integration/security-definer/*.test.ts`, `tests/integration/starter-exercise-seed.test.ts`.
- **Run locally**: start Supabase first, then run `npm run test:integration`.

### 6.3 Adding a route authorization test

- TBD — see §3 Phase 2 (how to fabricate unauthenticated and wrong-role request context for an Astro SSR endpoint).

### 6.4 Adding a test for a new API endpoint

- **Test type**: integration (preferred) — assert request → response shape AND the persisted side-effect, then 401/403 for unauth/wrong-role.
- **Pattern**: TBD — see §3 Phase 2.
- **When to add e2e instead**: only if the failure mode requires the full browser shape (cookie + middleware + handler crossing, navigation, reload, or mobile layout). Risk #6 is the primary E2E target; Risk #2 template/session form persistence is secondary.

### 6.5 Adding a validation/DB-parity test

- TBD — see §3 Phase 4 (asserting Zod and the DB `check` constraint agree on the same boundary inputs).

### 6.6 Adding an E2E test

- **Location**: `tests/e2e/<flow>.spec.ts`.
- **Config**: `npm run test:e2e` uses `playwright.config.ts`, starts `npm run dev`, and currently runs locally rather than in CI (roadmap `Q-04: add-e2e-ci-gate` covers wiring it into CI against an ephemeral Supabase).
- **Reference test**: `tests/e2e/seed.spec.ts` for role-based locators, API response waits, unique names, reload assertion, and cleanup.
- **Best first target**: Risk #6 guided-workout mobile autosave/reload. Prove a client logs a set, navigates or reloads, and sees persisted data. Do not test shadcn primitives or every UI detail.
- **Secondary target**: Risk #2 trainer template/session form persistence. Prove multi-round template or session creation survives submit + reload; keep failure-injection and rollback assertions in integration tests.

### 6.7 Per-rollout-phase notes

(Optional. After each phase lands, `/10x-implement` appends a 2–3 line note
here capturing anything surprising the rollout phase taught.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **shadcn/ui primitives** (`button`, `input`, `badge`, `alert-dialog`, etc.) — vendored; the library is the test. Re-evaluate only if a primitive is forked and customized. (Source: Phase 2 interview Q5.)
- **Pixel-perfect / snapshot tests of `.astro` layout and marketing pages** — brittle, catch nothing real. Re-evaluate if a page encodes critical conditional logic. (Source: Phase 2 interview Q5.)
- **Generic UI / component rendering** — do not test components just because they render. The narrow exception is behavior that lower layers cannot prove: guided-workout autosave/mobile persistence and critical trainer form flows called out in §2 and §3. (Source: Phase 2 interview Q5 + 2026-06-28 refresh concerns.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-28
- Stack versions last verified: 2026-06-28
- AI-native tool references last verified: 2026-06-28

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive (e.g. S-06 guided logging lands and set-logging integrity becomes the live #1),
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- E2E moves from local-only to CI-gated (tracked by roadmap `Q-04: add-e2e-ci-gate`), or the Playwright project matrix changes,
- guided-workout autosave/mobile confidence changes enough to alter Risk #6 priority,
- §7 negative-space no longer matches what the team believes.
