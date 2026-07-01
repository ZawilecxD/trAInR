/**
 * Risk: context/foundation/test-plan.md #6 — guided-workout false safety on client logging.
 *   A client can enter set data on mobile, navigate away immediately, reload the
 *   session, and still see the logged values. This fails if debounced autosave is
 *   canceled on navigation/unmount and the UI gives false confidence.
 *
 * Seed: tests/e2e/seed.spec.ts
 * Auth: trainer storage state creates/deletes the assigned session; client
 *   storage state drives the browser flow. Specs do not log in through the UI.
 */
import { test, expect } from "@playwright/test";
import { CLIENT_STORAGE_STATE, TRAINER_STORAGE_STATE } from "./auth";
import { clickUntilHydratedValue } from "./hydration";

const CLIENT_A_ID = "c2000001-0000-4000-8000-000000000002";
const BENCH_PRESS_ID = "e2000001-0000-4000-8000-000000000001";
const PLANK_ID = "e2000001-0000-4000-8000-000000000003";

test.use({
  storageState: CLIENT_STORAGE_STATE,
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.describe("Risk #6 — guided-workout quick navigation logging safety", () => {
  test("mobile set log persists after immediate next-exercise navigation and reload", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const trainerRequest = await playwright.request.newContext({
      baseURL: baseURL ?? "http://localhost:4321",
      storageState: TRAINER_STORAGE_STATE,
    });
    let createdSessionId: string | null = null;

    try {
      const uniqueSuffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const sessionName = `E2E Guided Autosave ${uniqueSuffix}`;
      const scheduledDate = new Date().toISOString().slice(0, 10);

      // Setup: create a unique assigned session with two exercises so "Next"
      // unmounts the first exercise immediately after the client enters values.
      const createResponse = await trainerRequest.post("/api/workout-sessions", {
        data: {
          client_id: CLIENT_A_ID,
          scheduled_date: scheduledDate,
          name: sessionName,
          source_template_id: null,
          exercises: [
            {
              exercise_id: BENCH_PRESS_ID,
              phase: "main",
              sort_order: 0,
              notes: "E2E quick navigation persistence check",
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
            {
              exercise_id: PLANK_ID,
              phase: "main",
              sort_order: 1,
              notes: null,
              sets: [
                {
                  prescribed_reps: null,
                  prescribed_duration_seconds: 30,
                  prescribed_load_kg: null,
                  rest_after_seconds: 60,
                  is_warmup: false,
                },
              ],
            },
          ],
        },
      });
      expect(createResponse.status()).toBe(201);
      const createBody = (await createResponse.json()) as { session?: { id?: string } };
      createdSessionId = createBody.session?.id ?? null;
      expect(createdSessionId).toBeTruthy();

      // Setup: start the session through the authenticated client API. The
      // browser-level risk starts after the guided logging UI is loaded.
      const startResponse = await page.request.post(`/api/client/sessions/${createdSessionId}/start`, {
        headers: { origin: baseURL ?? "http://localhost:4321" },
      });
      expect(startResponse.status()).toBe(200);

      // Action: open the guided session as the client on a mobile viewport.
      await page.goto(`/client/sessions/${createdSessionId}`);
      await expect(page.getByRole("heading", { name: "Bench Press" })).toBeVisible();

      // The guided hub is a client:load island; the SSR heading is visible before
      // hydration attaches React handlers. Gate on hydration BEFORE manually
      // filling controlled inputs by using the S-19 fill action, which only
      // populates inputs after React handlers attach.
      const fillButton = page.getByRole("button", { name: "Fill set 1 from prescription" });
      const repsInput = page.getByLabel("Set 1 reps");
      await clickUntilHydratedValue(fillButton, repsInput, "8");

      // Hydration confirmed; the reps tracker initialized cleanly so this fill sticks.
      await repsInput.fill("9");
      await expect(page.getByLabel("Remove set 1 log")).toBeEnabled();

      // Risk trigger: enter values and immediately navigate away. The test does
      // not wait for the autosave response because quick navigation is the risk.
      await page.getByLabel("Set 1 load kg").fill("42.5");
      await page.getByRole("button", { name: "Next" }).click();
      await expect(page.getByRole("heading", { name: "Plank" })).toBeVisible();

      // Assertion: after a real SSR reload, the first exercise's logged values
      // must be read back from persisted set_logs, not from React state.
      await page.reload();
      await expect(page.getByLabel("Set 1 reps")).toHaveValue("9");
      await expect(page.getByLabel("Set 1 load kg")).toHaveValue("42.5");
    } finally {
      if (createdSessionId) {
        await trainerRequest.delete(`/api/workout-sessions/${createdSessionId}`);
      }
      await trainerRequest.dispose();
    }
  });
});
