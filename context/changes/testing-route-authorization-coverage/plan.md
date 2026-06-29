# Route Authorization Coverage Implementation Plan

## Overview

Add integration-level handler tests proving every protected API route returns **401** (no session) and **403** (wrong role) before any data work. This closes test-plan Risk #3 and lands the `integration (route authz)` CI gate. Reuses the Phase 1 Vitest integration harness; does not re-test `guards.ts` in isolation.

## Current State Analysis

- **22 protected HTTP handlers** across 11 route files (16 trainer, 6 client) use either Pattern A (`requireTrainer` / `requireClient` on `context.locals`) or Pattern B (inline `getUser()` + `profiles.role` query in `invites` and `trainer-clients`).
- **3 public** auth routes (`signin`, `signup`, `signout`) — out of scope for 401/403 matrix.
- `src/lib/api/guards.test.ts` covers the guard helpers only (6 unit tests); no route imports.
- Phase 1 harness exists: `vitest.integration.config.ts`, `tests/integration/helpers/fixtures.ts`, CI `test-integration` job with local Supabase.
- Middleware populates `locals` for pages but does **not** gate `/api/*`; handlers own authorization.

### Key Discoveries:

- Pattern A (`src/lib/api/guards.ts:8-30`) returns `{ error: "unauthorized" }` / `{ error: "forbidden" }` via `jsonError`.
- Pattern B (`src/pages/api/invites/index.ts:20-37`, `trainer-clients/[id].ts:27-44`) returns `{ error: "Unauthorized" }` / `{ error: "Forbidden" }` — different casing; tests assert status codes only until a future normalization change.
- Pattern B routes call `createClient()` from `@/lib/supabase` which reads `astro:env/server`; integration tests must map `INTEGRATION_SUPABASE_*` → `SUPABASE_URL` / `SUPABASE_KEY` and run `astro sync` in CI before route imports.

## Desired End State

- Machine-readable route inventory at `tests/integration/route-auth/inventory.ts` enumerating all 22 protected handlers.
- Parametric tests: each handler returns 401 unauthenticated and 403 for wrong role, verified **before** business logic (invalid body still yields 401/403).
- Pattern B routes tested with real Supabase session cookies via Phase 1 fixtures.
- `npm run test:integration` includes route-auth suite; CI `test-integration` job runs `astro sync` and passes.
- `context/foundation/test-plan.md` §3 Phase 2 → `complete`; §6.3 cookbook filled in.

### Verification

```bash
npx astro sync
npm run test:integration
npm run lint
```

## What We're NOT Doing

- Refactoring Pattern B routes to `requireTrainer` (optional follow-up).
- Normalizing error message casing across patterns.
- Testing public auth routes for 401/403 (they use redirects, not JSON guards).
- Middleware/page-route authorization tests.
- E2e browser tests.

## Implementation Approach

1. **Inventory-first**: single `inventory.ts` drives `it.each` — new routes without inventory entry fail CI.
2. **Pattern A**: handler-level tests with fabricated `APIContext` (`locals` only); no Supabase required for negative cases.
3. **Pattern B**: handler-level tests with session cookies from `createTrainer()` / `createBareClient()` fixtures; env aliasing in route-auth setup.
4. **Guard-before-data**: send malformed JSON or missing params; expect 401/403 not 400/404/500.

## Phase 1: Inventory and test harness

### Overview

Create the route inventory, shared `makeApiContext` helper, and env wiring so route handlers can be imported under Vitest integration config.

### Changes Required:

#### 1. Route inventory

**File**: `tests/integration/route-auth/inventory.ts`

**Intent**: Single source of truth for all protected handlers — method, path template, required role, pattern (`A` | `B`), dynamic import of handler.

**Contract**: Export `PROTECTED_ROUTE_HANDLERS` array with entries for all 22 handlers (16 trainer, 6 client). Each entry: `{ id, method, path, role, pattern, handler }` where `handler` is a lazy `() => import(...)` returning the named export.

#### 2. API context helper

**File**: `tests/integration/route-auth/helpers/api-context.ts`

**Intent**: Build minimal `APIContext` for handler invocation — `request`, `params`, `locals`, stub `cookies`.

**Contract**: `makeApiContext({ method, url, locals, params?, body? })` returns `APIContext`. `invokeHandler(handler, context)` calls handler and returns `Response`.

#### 3. App env wiring for Pattern B

**File**: `tests/integration/route-auth/helpers/app-env.ts`

**Intent**: Map integration Supabase vars to app `SUPABASE_URL` / `SUPABASE_KEY` before importing routes that use `astro:env/server`.

**Contract**: `wireAppSupabaseEnv()` sets `process.env.SUPABASE_URL` and `process.env.SUPABASE_KEY` from `INTEGRATION_SUPABASE_*` (no override if already set).

#### 4. Session cookie helper (Pattern B prep)

**File**: `tests/integration/route-auth/helpers/session-request.ts`

**Intent**: Build `Request` + `AstroCookies` with valid Supabase SSR session cookies from a signed-in fixture client.

**Contract**: `buildAuthenticatedRequest(testUser, { method, url })` returns `{ request, cookies }` usable as `APIContext` fields.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- Inventory exports 22 entries (18 trainer + 4 client)
- Smoke import: `vitest run tests/integration/route-auth/inventory.test.ts` (if added) or compile check via integration run in Phase 2

#### Manual Verification:

- Inventory paths match actual files under `src/pages/api/`

**Implementation Note**: After automated verification, confirm inventory completeness against `src/pages/api/` tree.

---

## Phase 2: Pattern A handler authorization tests

### Overview

Parametric tests for all 20 handlers using `requireTrainer` / `requireClient` — 401 without `locals.user`, 403 with wrong role, guard-before-data check.

### Changes Required:

#### 1. Pattern A test suite

**File**: `tests/integration/route-auth/pattern-a-handlers.test.ts`

**Intent**: For each Pattern A inventory entry, assert 401 (null locals), 403 (wrong role), and guard-before-data (invalid body still 401/403).

**Contract**: Filter inventory `pattern === "A"`. Use `it.each`. Wrong role: trainer routes get `role: "client"`; client routes get `role: "trainer"`. Status assertions only (401/403).

### Success Criteria:

#### Automated Verification:

- `npx astro sync && npm run test:integration` passes Pattern A tests
- `npm run lint` passes

#### Manual Verification:

- Spot-check one trainer and one client route manually if integration DB unavailable locally

---

## Phase 3: Pattern B tests and test-plan closure

### Overview

Session-based 401/403 tests for inline-guard routes; CI astro sync; update test-plan cookbook and phase status.

### Changes Required:

#### 1. Pattern B test suite

**File**: `tests/integration/route-auth/pattern-b-inline.test.ts`

**Intent**: Test `POST /api/invites` and `DELETE /api/trainer-clients/[id]` with no cookies → 401; client session → 403.

**Contract**: Use `wireAppSupabaseEnv()`, `createTrainer()` / `createBareClient("client")`, `buildAuthenticatedRequest`. Unauthenticated: empty cookies. UUID param for trainer-clients DELETE.

#### 2. CI astro sync

**File**: `.github/workflows/ci.yml`

**Intent**: `test-integration` job must run `npx astro sync` before `npm run test:integration` so `astro:env/server` resolves in route imports.

**Contract**: Add `npx astro sync` step after `npm ci` in `test-integration` job.

#### 3. Test plan update

**File**: `context/foundation/test-plan.md`

**Intent**: Mark Phase 2 complete; fill §6.3 route-auth cookbook; update §4 API route layer; add §6.6 rollout note.

**Contract**: Phase 2 status → `complete`; change folder path set; cookbook documents inventory + `makeApiContext` pattern.

### Success Criteria:

#### Automated Verification:

- `npx astro sync && npm run test:integration` — full suite green
- `npm run lint` passes
- `npm run test` (unit) still passes

#### Manual Verification:

- Confirm CI `test-integration` job would pick up new tests (astro sync step present)

---

## Testing Strategy

### Integration Tests:

- 22 handlers × 2 negative cases minimum (401 + 403) = 44 tests
- Pattern A adds guard-before-data case per handler
- Pattern B uses real DB fixtures from Phase 1

### Manual Testing Steps:

1. Run `npx supabase start` locally
2. Export `INTEGRATION_SUPABASE_*` from `supabase status`
3. `npx astro sync && npm run test:integration`

## References

- Test plan: `context/foundation/test-plan.md` §2 Risk #3, §3 Phase 2
- Phase 1 harness: `context/archive/2026-06-07-testing-rls-isolation-harness/`
- Guards: `src/lib/api/guards.ts`, `src/lib/api/guards.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Inventory and test harness

#### Automated

- [x] 1.1 `npm run lint` passes — 8b34d29
- [x] 1.2 Inventory exports 22 protected handler entries — 8b34d29
- [x] 1.3 Helpers compile and are importable from integration config — 8b34d29

#### Manual

- [x] 1.4 Inventory paths match `src/pages/api/` tree — 8b34d29

### Phase 2: Pattern A handler authorization tests

#### Automated

- [x] 2.1 `npx astro sync && npm run test:integration` passes Pattern A tests — 8b34d29
- [x] 2.2 `npm run lint` passes — 8b34d29

#### Manual

- [x] 2.3 Spot-check one trainer and one client route — 8b34d29

### Phase 3: Pattern B tests and test-plan closure

#### Automated

- [x] 3.1 Full `npm run test:integration` suite passes — 8b34d29
- [x] 3.2 `npm run test` (unit) still passes — 8b34d29
- [x] 3.3 CI workflow includes `astro sync` in test-integration job — 8b34d29

#### Manual

- [x] 3.4 Confirm test-plan §3 Phase 2 status and §6.3 cookbook updated — 8b34d29
