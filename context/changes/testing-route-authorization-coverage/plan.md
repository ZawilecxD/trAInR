# Route Authorization Coverage Implementation Plan

## Overview

Implement test-plan rollout phase 2 for route authorization coverage. The change adds handler-level tests proving every protected API route returns 401 for unauthenticated callers and 403 for the wrong role before protected data work can run, then documents the route-auth cookbook for future endpoints.

## Current State Analysis

The project already has guard-helper unit tests, but no route-handler coverage proving each API route actually invokes those guards. The master test plan identifies missing or drifted route authorization as Risk #3 and requires an enumerated route inventory rather than assuming routes are covered.

## Desired End State

Every protected API handler under `src/pages/api/` has explicit 401 and 403 coverage. Guard-helper routes prove auth failure happens before `createClient` or service calls; inline auth routes prove their Supabase-backed auth checks reject missing users and non-trainer profiles. The test-plan phase is marked complete and the cookbook explains how to add route auth checks for future endpoints.

### Key Discoveries:

- `src/lib/api/guards.ts:8` and `src/lib/api/guards.ts:20` implement `requireTrainer` and `requireClient`; `src/lib/api/guards.test.ts:15` covers helper behavior only.
- Guard-helper API handlers call the guard before `createClient`, for example `src/pages/api/exercises/index.ts:10` and `src/pages/api/client/set-logs.ts:11`.
- Two trainer-only routes use inline Supabase auth instead of the guard helpers: `src/pages/api/invites/index.ts:14` and `src/pages/api/trainer-clients/[id].ts:21`.
- `src/lib/supabase.ts:3` imports `astro:env/server`, so route-handler tests need a deterministic mock for handler imports.
- CI already runs `npm run test`, lint, check, build, and integration jobs in `.github/workflows/ci.yml:19`, `.github/workflows/ci.yml:33`, and `.github/workflows/ci.yml:67`.

## What We're NOT Doing

- Re-testing the internals of `requireTrainer` or `requireClient`; existing unit tests already cover helper semantics.
- Starting the Astro dev server or adding browser-level E2E coverage.
- Exercising real Supabase/RLS behavior; that belongs to the integration harness from rollout phase 1.
- Refactoring inline auth routes into guard-helper routes unless implementation reveals that direct testing is impractical.
- Adding new production dependencies.

## Implementation Approach

Use fast handler-level Vitest coverage in `src/pages/api/`, because the risk is route wiring rather than database isolation. Build a small test helper that fabricates the subset of `APIContext` route handlers need, mock `@/lib/supabase` so guard-helper auth failures fail if data access starts, and keep the protected route inventory as an explicit table in the test file.

## Critical Implementation Details

Guard-helper route tests should import handlers directly and set `createClient` to throw on auth-failure paths. If an unauthenticated or wrong-role case reaches Supabase setup, the test must fail because the route did data work before rejecting the caller.

Inline auth routes intentionally call `createClient` before checking `supabase.auth.getUser()`, so they need a different mock client that returns either no user or a non-trainer profile and then asserts protected insert/RPC operations are not reached.

## Phase 1: Guard-helper route authorization matrix

### Overview

Add the reusable route-handler test harness and cover all `requireTrainer` / `requireClient` protected handlers with 401 and 403 assertions.

### Changes Required:

#### 1. Route authorization test helper

**File**: `src/pages/api/route-authorization.test.ts`

**Intent**: Create local test helpers for building minimal `APIContext` objects and parsing JSON responses. Keep the helper next to the route inventory so future endpoint additions can update one auditable file.

**Contract**: Provide helpers for method, URL, params, JSON body, `locals.user`, and `locals.role`; return an `APIContext` cast with `request`, `url`, `params`, `locals`, and a stub `cookies` object.

#### 2. Supabase import mock for guard-helper routes

**File**: `src/pages/api/route-authorization.test.ts`

**Intent**: Mock `@/lib/supabase` to make unauthorized guard-helper paths fail if they attempt data setup.

**Contract**: The mock exposes `createClient` as a Vitest mock function. Guard-helper tests set it to throw or assert it was not called for every 401/403 case.

#### 3. Trainer route inventory tests

**File**: `src/pages/api/route-authorization.test.ts`

**Intent**: Enumerate every `requireTrainer` protected route handler and assert unauthenticated callers receive 401 while client-role callers receive 403.

**Contract**: The inventory must cover 14 trainer handlers: `GET`/`POST /api/exercises`, `GET`/`PATCH /api/exercises/:id`, `GET`/`POST /api/session-templates`, `GET`/`PATCH`/`DELETE /api/session-templates/:id`, `GET`/`POST /api/workout-sessions`, and `GET`/`PATCH`/`DELETE /api/workout-sessions/:id`.

#### 4. Client route inventory tests

**File**: `src/pages/api/route-authorization.test.ts`

**Intent**: Enumerate every `requireClient` protected route handler and assert unauthenticated callers receive 401 while trainer-role callers receive 403.

**Contract**: The inventory must cover 6 client handlers: `GET /api/client/sessions`, `GET /api/client/sessions/:id`, `POST /api/client/sessions/:id/start`, `POST /api/client/sessions/:id/restart`, and `PUT`/`DELETE /api/client/set-logs`.

### Success Criteria:

#### Automated Verification:

- Guard-helper route inventory has 20 handler entries.
- Guard-helper tests assert 401 and 403 response bodies and status codes for every entry.
- Guard-helper tests assert `createClient` is not called for every auth-failure case.
- Targeted unit test passes: `npm run test -- src/pages/api/route-authorization.test.ts`.

---

## Phase 2: Inline route coverage and test-plan cookbook

### Overview

Cover the two inline trainer-auth routes, update the master test-plan phase state, and document the new route-authorization testing pattern for future API endpoints.

### Changes Required:

#### 1. Inline trainer-auth route tests

**File**: `src/pages/api/route-authorization.test.ts`

**Intent**: Add coverage for trainer-only routes that do not use `requireTrainer` but still must return 401 and 403 before protected mutations.

**Contract**: Cover `POST /api/invites` and `DELETE /api/trainer-clients/:id`; mock `supabase.auth.getUser()` for the 401 path and `profiles.select(...).eq(...).maybeSingle()` for the 403 path. Assert invite insert and trainer-client RPC operations are not called on auth failure.

#### 2. Route authorization cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the phase-2 TBD cookbook with the concrete handler-level pattern established by this change.

**Contract**: Update §3 phase 2 status/change folder, §6.3, §6.4, and §6.6 to describe the route inventory, fabricated `APIContext`, `@/lib/supabase` mocking, expected 401/403 assertions, and the targeted command.

#### 3. Change metadata

**File**: `context/changes/testing-route-authorization-coverage/change.md`

**Intent**: Keep the change artifact status in sync with implementation progress.

**Contract**: Set status to `implementing` on implementation start and `implemented` after all automated progress items are complete.

### Success Criteria:

#### Automated Verification:

- Inline route tests assert 401 and 403 response bodies and status codes for both inline routes.
- Inline route tests assert protected insert/RPC work is not reached on auth failure.
- Route authorization cookbook is updated in `context/foundation/test-plan.md`.
- Full unit test suite passes: `npm run test`.
- Lint passes: `npm run lint`.
- Astro check passes: `npm run check`.
- Production build passes: `npm run build`.

---

## Testing Strategy

### Unit Tests:

- Table-driven handler tests for every guard-helper route entry.
- Dedicated inline-auth tests for routes that must mock Supabase auth and profile lookups.
- Response body assertions distinguish guard-helper lowercase errors from inline route capitalized errors.

### Integration Tests:

- No new real-Supabase integration test is required for this phase; the risk is missing route-level authorization wiring, not RLS.

### Manual Testing Steps:

- Review `src/pages/api/route-authorization.test.ts` to confirm the protected-route inventory matches the current `src/pages/api/` tree.
- Review `context/foundation/test-plan.md` §6.3 and §6.4 for future endpoint guidance.

## Performance Considerations

The tests run in the standard Vitest unit suite and mock Supabase, so they should add only handler-import and response assertion overhead.

## Migration Notes

No database or persisted data migrations are required.

## References

- Linear issue: ZAW-44
- Master test plan: `context/foundation/test-plan.md`
- Guard helpers: `src/lib/api/guards.ts:8`
- Guard-helper unit tests: `src/lib/api/guards.test.ts:15`
- Supabase SSR client: `src/lib/supabase.ts:3`
- CI gates: `.github/workflows/ci.yml:19`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Guard-helper route authorization matrix

#### Automated

- [x] 1.1 Guard-helper route inventory has 20 handler entries
- [x] 1.2 Guard-helper tests assert 401 and 403 response bodies and status codes for every entry
- [x] 1.3 Guard-helper tests assert `createClient` is not called for every auth-failure case
- [x] 1.4 Targeted unit test passes: `npm run test -- src/pages/api/route-authorization.test.ts`

### Phase 2: Inline route coverage and test-plan cookbook

#### Automated

- [x] 2.1 Inline route tests assert 401 and 403 response bodies and status codes for both inline routes
- [x] 2.2 Inline route tests assert protected insert/RPC work is not reached on auth failure
- [x] 2.3 Route authorization cookbook is updated in `context/foundation/test-plan.md`
- [x] 2.4 Full unit test suite passes: `npm run test`
- [x] 2.5 Lint passes: `npm run lint`
- [x] 2.6 Astro check passes: `npm run check`
- [x] 2.7 Production build passes: `npm run build`
