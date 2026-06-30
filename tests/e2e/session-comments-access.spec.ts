/**
 * Risk: the session-comments endpoints must enforce auth and cross-tenant
 *   isolation at the real HTTP boundary (middleware → guard → RLS), not only at
 *   the DB layer. This fails if an unauthenticated caller can read a thread, or
 *   if one trainer can write a comment onto another trainer's session.
 *
 * These assertions go through the running app's real cookies + middleware +
 * RLS — the DB-layer INSERT block is separately covered by
 * tests/integration/rls/session-comments.test.ts.
 *
 * Seed: tests/e2e/seed.spec.ts
 * Auth: Trainer A is loaded via storageState; Trainer B signs in through the
 *   real form endpoint into a throwaway request context.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import { TRAINER_STORAGE_STATE, trainerBCredentials } from "./auth";

const CLIENT_A_ID = "c2000001-0000-4000-8000-000000000002";
const BENCH_PRESS_ID = "e2000001-0000-4000-8000-000000000001";
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4321";

test.describe("Session comments — access control", () => {
  let trainerA: APIRequestContext;
  let sessionId: string;

  test.beforeAll(async ({ playwright }) => {
    trainerA = await playwright.request.newContext({ baseURL: BASE_URL, storageState: TRAINER_STORAGE_STATE });

    const scheduledDate = new Date().toISOString().slice(0, 10);
    const createResponse = await trainerA.post("/api/workout-sessions", {
      data: {
        client_id: CLIENT_A_ID,
        scheduled_date: scheduledDate,
        name: `E2E Comments Access ${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        source_template_id: null,
        exercises: [
          {
            exercise_id: BENCH_PRESS_ID,
            phase: "main",
            sort_order: 0,
            notes: null,
            sets: [
              {
                prescribed_reps: 8,
                prescribed_duration_seconds: null,
                prescribed_load_kg: 40,
                rest_after_seconds: 60,
                is_warmup: false,
              },
            ],
          },
        ],
      },
    });
    expect(createResponse.status()).toBe(201);
    const body = (await createResponse.json()) as { session?: { id?: string } };
    sessionId = body.session?.id ?? "";
    expect(sessionId).toBeTruthy();
  });

  test.afterAll(async () => {
    if (sessionId) {
      await trainerA.delete(`/api/workout-sessions/${sessionId}`);
    }
    await trainerA.dispose();
  });

  test("GET comments without authentication returns 401", async ({ playwright }) => {
    // Force an empty cookie jar — a fresh request context otherwise inherits the
    // project's trainer storageState, which would make this read authenticated.
    const anon = await playwright.request.newContext({
      baseURL: BASE_URL,
      storageState: { cookies: [], origins: [] },
    });
    try {
      const response = await anon.get(`/api/sessions/${sessionId}/comments`);
      expect(response.status()).toBe(401);
    } finally {
      await anon.dispose();
    }
  });

  test("trainer B cannot comment on trainer A's session, and nothing is stored", async ({ playwright }) => {
    // Start from an empty jar (a fresh context otherwise inherits the project's
    // trainer storageState) so Trainer B's sign-in is the only auth present.
    const trainerB = await playwright.request.newContext({
      baseURL: BASE_URL,
      storageState: { cookies: [], origins: [] },
    });
    try {
      // Sign in Trainer B through the real form endpoint; the auth cookies land
      // in this request context. The origin header satisfies Astro's CSRF check
      // for form-encoded POSTs.
      const signin = await trainerB.post("/api/auth/signin", {
        form: { email: trainerBCredentials.email, password: trainerBCredentials.password },
        headers: { origin: BASE_URL },
      });
      expect(signin.ok()).toBeTruthy();

      const hacked = `Hacked by Trainer B ${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const attempt = await trainerB.post(`/api/sessions/${sessionId}/comments`, {
        data: { body: hacked },
      });
      // RLS hides Trainer A's session from Trainer B, so the route's session
      // existence check finds no row → 404, and no comment is inserted.
      expect(attempt.status()).toBe(404);

      // Prove non-persistence from Trainer A's authoritative view of the thread.
      const list = await trainerA.get(`/api/sessions/${sessionId}/comments`);
      expect(list.status()).toBe(200);
      const listBody = (await list.json()) as { comments: { body: string }[] };
      expect(listBody.comments.some((comment) => comment.body === hacked)).toBe(false);
    } finally {
      await trainerB.dispose();
    }
  });
});
