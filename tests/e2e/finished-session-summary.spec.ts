/**
 * S-20 — finished session summary for client.
 * Client re-entering a completed session sees read-only exercise summary
 * (prescribed vs actual) before optional Edit within the edit window.
 */
import { test, expect } from "@playwright/test";
import { CLIENT_STORAGE_STATE, TRAINER_STORAGE_STATE } from "./auth";
import { clickUntilVisible } from "./hydration";

const CLIENT_A_ID = "c2000001-0000-4000-8000-000000000002";
const BENCH_PRESS_ID = "e2000001-0000-4000-8000-000000000001";

test.use({
  storageState: CLIENT_STORAGE_STATE,
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.describe("S-20 — finished session exercise summary", () => {
  test("completed session shows read-only exercise summary before Edit", async ({ page, playwright, baseURL }) => {
    const trainerRequest = await playwright.request.newContext({
      baseURL: baseURL ?? "http://localhost:4321",
      storageState: TRAINER_STORAGE_STATE,
    });
    let createdSessionId: string | null = null;
    let sessionExerciseId: string | null = null;

    try {
      const uniqueSuffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const sessionName = `E2E Finished Summary ${uniqueSuffix}`;
      const scheduledDate = new Date().toISOString().slice(0, 10);

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
              notes: "E2E summary visibility check",
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
      const createBody = (await createResponse.json()) as {
        session?: { id?: string; exercises?: { id?: string }[] };
      };
      createdSessionId = createBody.session?.id ?? null;
      sessionExerciseId = createBody.session?.exercises?.[0]?.id ?? null;
      expect(createdSessionId).toBeTruthy();
      expect(sessionExerciseId).toBeTruthy();

      const startResponse = await page.request.post(`/api/client/sessions/${createdSessionId}/start`, {
        headers: { origin: baseURL ?? "http://localhost:4321" },
      });
      expect(startResponse.status()).toBe(200);

      const logResponse = await page.request.put("/api/client/set-logs", {
        headers: { origin: baseURL ?? "http://localhost:4321" },
        data: {
          session_exercise_id: sessionExerciseId,
          set_number: 1,
          reps: 9,
          duration_seconds: null,
          load_kg: 42.5,
          is_complete: true,
          is_warmup: false,
        },
      });
      expect(logResponse.status()).toBe(200);

      const completeResponse = await page.request.post(`/api/client/sessions/${createdSessionId}/complete`, {
        headers: { origin: baseURL ?? "http://localhost:4321" },
        data: { status: "finished" },
      });
      expect(completeResponse.status()).toBe(200);

      await page.goto(`/client/sessions/${createdSessionId}`);
      await expect(page.getByRole("heading", { name: sessionName, level: 1 })).toBeVisible();

      const benchPressSummary = page
        .getByRole("article")
        .filter({ has: page.getByRole("heading", { name: "Bench Press", level: 4 }) });
      const sessionMetadata = page.locator("section").filter({ has: page.getByText("Trainer", { exact: true }) });

      await expect(sessionMetadata.getByText("Sets logged", { exact: true })).toBeVisible();
      await expect(sessionMetadata.getByText("1 of 1", { exact: true })).toBeVisible();
      await expect(benchPressSummary.getByRole("columnheader", { name: "Prescribed" })).toBeVisible();
      await expect(benchPressSummary.getByRole("columnheader", { name: "Actual" })).toBeVisible();
      await expect(benchPressSummary.getByText("9 reps @ 42.5 kg")).toBeVisible();
      await expect(benchPressSummary.getByText("E2E summary visibility check")).toBeVisible();

      const editButton = page.getByRole("button", { name: "Edit" });
      await expect(editButton).toBeVisible();
      // Astro's dev toolbar can cover fixed bottom CTAs in local E2E runs.
      await page.locator("astro-dev-toolbar").evaluateAll((toolbars) => {
        for (const toolbar of toolbars) {
          toolbar.remove();
        }
      });
      await clickUntilVisible(editButton, page.getByRole("button", { name: "Summary" }));
      await expect(page.getByLabel("Set 1 reps")).toHaveValue("9");
    } finally {
      if (createdSessionId) {
        await trainerRequest.delete(`/api/workout-sessions/${createdSessionId}`);
      }
      await trainerRequest.dispose();
    }
  });
});
