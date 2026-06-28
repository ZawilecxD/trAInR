# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-28 (stack, gates, and rollout status refresh)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
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

| #   | Risk (failure scenario)                                                                                                                                                                                                                                                            | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Cross-tenant isolation breach** — Trainer A reads OR writes/deletes Trainer B's clients, templates, exercises, or session logs (or a client sees another client's data), because RLS is the sole enforcement and several service operations query by `id` alone                  | High   | High       | PRD §Non-Functional ("never visible to other trainers", "no cross-tenant data leakage"), §Access Control; interview Q1, Q2 ("can't review RLS SQL"), Q3 ("change a query, hope RLS holds"), Q4; hot-spot dir `supabase/migrations/` (3 commits/30d) |
| 2   | **Partial-write corruption on multi-step saves** — a template create/edit inserts exercises then per-round sets with no real transaction; a mid-sequence failure leaves orphaned/partial rows or wipes exercises on edit. Same pattern will own client set-logging when S-06 ships | High   | High       | PRD §Non-Functional ("never silently disappears, corrupts, or partially saves… explicit error and can retry"); interview Q1, Q2 ("multi-step write failed halfway, no transaction"), Q4; hot-spot dir `src/lib/session-templates/` (14 commits/30d) |
| 3   | **Missing or drifted route authorization** — an API route omits or diverges from the auth/role guard and returns a 200 to an unauthenticated or wrong-role caller                                                                                                                  | High   | Medium     | interview Q3 ("copy-paste the guard, hope I didn't miss one"), Q4; two divergent guard patterns observed across routes; existing unit coverage stops at the guard helper, not the routes                                                            |
| 4   | **Invite-link abuse** — a leaked, expired, or already-consumed invite token still completes registration and auto-assigns the registrant to a trainer                                                                                                                              | Medium | Medium     | PRD FR-003, FR-004 (Socrates: "if the link leaks, the wrong person gets assigned"); roadmap S-03; hot-spot dir `supabase/migrations/`; partially mitigated by FR-006 removal                                                                        |
| 5   | **Validation ↔ DB-constraint parity** — server-side Zod rules diverge from database checks (load `0`=bodyweight, negative=assisted; each round requires reps OR duration), so valid input is rejected or invalid input is persisted                                                | Medium | Medium     | roadmap §S-04 risk note ("template schema currently rejects negative" vs ERD); hot-spot dir `src/lib/session-templates/` (14 commits/30d)                                                                                                           |

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                          | Must challenge                                                                                                                                                | Context `/10x-research` must ground                                                                                                                | Likely cheapest layer                                                                 | Anti-pattern to avoid                                                                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| #1   | Acting as Trainer B, every read, update, and delete of Trainer A's rows — direct table access, by-id access, and via RPC — returns empty or denied   | "logged-in ⇒ allowed"; **verify the server Supabase client uses the anon / RLS-bound key, not `service_role`** (a service-role key silently bypasses all RLS) | actual RLS policies per table; whether removal/assignment RPCs are `SECURITY DEFINER`; how to run two real authenticated identities against the DB | integration (DB seeded with two trainers) or pgTAP — no unit test can prove isolation | mocking Supabase (mocks cannot prove RLS); testing reads only and not writes/deletes      |
| #2   | After a forced mid-write failure, the DB holds either the complete record or nothing — never a partial record; the caller receives an explicit error | "the happy-path insert succeeding means rollback works"; "FK cascade is intentional cleanup"                                                                  | whether a DB transaction/RPC exists or cleanup is app-level; what failure injection is possible; FK `ON DELETE` behavior                           | integration (real DB, inject failure mid-sequence)                                    | asserting only the happy path; copying the service's own cleanup logic as the test oracle |
| #3   | Each protected route returns 401 with no session and 403 for the wrong role, before any data work happens                                            | "the guard is on the route I looked at ⇒ it's on every route"; an enumerated route inventory is required, not assumed                                         | the full protected-route inventory; how to fabricate unauthenticated and wrong-role request context in Astro SSR                                   | integration or handler-level test per route                                           | re-testing the guard helper in isolation (already covered) and assuming routes call it    |
| #4   | An expired, already-consumed, or malformed token cannot complete registration or trainer assignment                                                  | "happy-path signup working ⇒ expiry and single-use are enforced"; where is expiry actually checked — RPC or app code?                                         | invite RPC logic, the expiry/consumption enforcement point, token uniqueness guarantees                                                            | integration (DB + RPC)                                                                | testing only the valid-token signup; trusting client-supplied token state                 |
| #5   | Boundary loads (`0`, negative, null) and reps-XOR-duration rounds are accepted or rejected identically by Zod and by the DB check constraint         | "the schema unit test passing ⇒ the DB agrees"; the known roadmap divergence is real and must be reconciled                                                   | the exact DB `check` constraints vs current Zod schema; the S-04 load-semantics gap                                                                | unit (schema) + a thin integration assertion against the DB constraint                | a schema-only test that never confirms the DB actually agrees                             |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                    | Goal (one line)                                                                                                             | Risks covered | Test types         | Status      | Change folder                                             |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------ | ----------- | --------------------------------------------------------- |
| 1   | RLS isolation harness         | Stand up the integration/DB test harness and prove Trainer A ≠ Trainer B for read, write, delete, and RPC access            | #1            | integration        | complete    | context/archive/2026-06-07-testing-rls-isolation-harness/ |
| 2   | Route authorization coverage  | Every protected API route returns 401 (no session) and 403 (wrong role) before any data work                                | #3            | integration        | not started | —                                                         |
| 3   | Service write-path integrity  | A forced mid-write failure leaves no partial rows and surfaces an explicit error, especially for session-template writes    | #2            | integration        | not started | —                                                         |
| 4   | Invite + validation parity    | Expired/used/malformed invite tokens are rejected; Zod and DB constraints agree on loads and rounds                         | #4, #5        | integration + unit | not started | —                                                         |
| 5   | Guided-workout E2E confidence | Prove critical guided-workout autosave/mobile and trainer session/template form flows where lower layers cannot give signal | TBD in §2     | e2e + unit         | not started | —                                                         |

**Status vocabulary** (fixed — parser literals): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer                  | Tool       | Version | Notes                                                                                                                                                 |
| ---------------------- | ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit                   | Vitest     | 4.x     | wired; `node` env via `vitest.config.ts`, `include: src/**/*.test.ts`; meaningful suite across `src/lib/` domains                                     |
| integration (DB / RLS) | Vitest     | 4.x     | wired via `vitest.integration.config.ts`, `include: tests/integration/**/*.test.ts`, Supabase env setup, and CI `test-integration` job                |
| API route / handler    | Vitest     | 4.x     | planned for §3 Phase 2; guard helpers have unit coverage, but route-level 401/403 inventory is still open                                             |
| e2e                    | Playwright | 1.x     | wired via `playwright.config.ts` and `npm run test:e2e`; `tests/e2e/seed.spec.ts` is the current exemplar; local-only, not CI-gated today             |
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
"Required for §3 Phase <N>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate                          | Where      | Required?                   | Catches                                                            |
| ----------------------------- | ---------- | --------------------------- | ------------------------------------------------------------------ |
| lint + typecheck              | local + CI | required                    | syntactic / type drift                                             |
| unit                          | local + CI | required (in place)         | validation/logic regressions in `src/lib/`                         |
| integration (RLS isolation)   | local + CI | required (Phase 1 complete) | cross-tenant leaks, broken isolation                               |
| integration (route authz)     | local + CI | required after §3 Phase 2   | unauthenticated / wrong-role access                                |
| integration (write integrity) | local + CI | required after §3 Phase 3   | partial-write corruption                                           |
| E2E critical flows            | local      | planned / selective         | full browser regressions that lower layers cannot prove            |
| `npm test` step in CI         | CI on PR   | required (in place)         | unit regressions reaching `main`                                   |
| `npm run test:integration`    | CI on PR   | required (in place)         | Supabase-backed RLS/RPC regressions reaching `main`                |
| `npm run test:e2e`            | local      | not CI-gated today          | trainer/client browser flows that need cookies, navigation, reload |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase <N>."

### 6.1 Adding a unit test

- **Location**: next to the unit under test in `src/lib/<domain>/` (e.g. `src/lib/exercises/`).
- **Naming**: `<module>.test.ts`.
- **Reference test**: `src/lib/exercises/schemas.test.ts`, `src/lib/api/guards.test.ts`.
- **Run locally**: `npm test` (or `npx vitest <path>`).

### 6.2 Adding an integration test (DB / RLS)

- TBD — see §3 Phase 1 (the isolation harness and its conventions are established there: two-trainer fixtures, RLS-bound client, mid-write failure injection).

### 6.3 Adding a route authorization test

- TBD — see §3 Phase 2 (how to fabricate unauthenticated and wrong-role request context for an Astro SSR endpoint).

### 6.4 Adding a test for a new API endpoint

- **Test type**: integration (preferred) — assert request → response shape AND the persisted side-effect, then 401/403 for unauth/wrong-role.
- **Pattern**: TBD — see §3 Phase 2.
- **When to add e2e instead**: only if the failure mode requires the full deployed shape (cookie + middleware + handler crossing). Not planned in this rollout.

### 6.5 Adding a validation/DB-parity test

- TBD — see §3 Phase 4 (asserting Zod and the DB `check` constraint agree on the same boundary inputs).

### 6.6 Per-rollout-phase notes

(Optional. After each phase lands, `/10x-implement` appends a 2–3 line note
here capturing anything surprising the rollout phase taught.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **shadcn/ui primitives** (`button`, `input`, `badge`, `alert-dialog`, etc.) — vendored; the library is the test. Re-evaluate only if a primitive is forked and customized. (Source: Phase 2 interview Q5.)
- **Pixel-perfect / snapshot tests of `.astro` layout and marketing pages** — brittle, catch nothing real. Re-evaluate if a page encodes critical conditional logic. (Source: Phase 2 interview Q5.)
- **Detailed UI / component rendering** — only the most critical UI path warrants a test, and none rises to that bar in this rollout. Re-evaluate if a client-facing logging interaction (S-06) ships with non-trivial client-side state. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-07
- Stack versions last verified: 2026-06-07
- AI-native tool references last verified: 2026-06-07

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive (e.g. S-06 guided logging lands and set-logging integrity becomes the live #1),
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
