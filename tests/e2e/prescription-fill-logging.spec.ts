import { test, expect } from "@playwright/test";
import { CLIENT_STORAGE_STATE, TRAINER_STORAGE_STATE } from "./auth";
import { clickUntilHydratedValue } from "./hydration";

const CLIENT_A_ID = "c2000001-0000-4000-8000-000000000002";
const BENCH_PRESS_ID = "e2000001-0000-4000-8000-000000000001";

test.use({
  storageState: CLIENT_STORAGE_STATE,
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.describe("S-19 — prescription fill logging", () => {
  test("client fills prescribed reps and load and sees them after reload", async ({ page, playwright, baseURL }) => {
    const trainerRequest = await playwright.request.newContext({
      baseURL: baseURL ?? "http://localhost:4321",
      storageState: TRAINER_STORAGE_STATE,
    });
    let createdSessionId: string | null = null;

    try {
      const uniqueSuffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const sessionName = `E2E Prescription Fill ${uniqueSuffix}`;
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
              notes: "E2E prescription fill check",
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
      const createBody = (await createResponse.json()) as { session?: { id?: string } };
      createdSessionId = createBody.session?.id ?? null;
      expect(createdSessionId).toBeTruthy();

      const startResponse = await page.request.post(`/api/client/sessions/${createdSessionId}/start`, {
        headers: { origin: baseURL ?? "http://localhost:4321" },
      });
      expect(startResponse.status()).toBe(200);

      await page.goto(`/client/sessions/${createdSessionId}`);
      await expect(page.getByRole("heading", { name: "Bench Press" })).toBeVisible();

      const repsInput = page.getByLabel("Set 1 reps");
      const loadInput = page.getByLabel("Set 1 load kg");
      const fillButton = page.getByRole("button", { name: "Fill set 1 from prescription" });
      const saveResponse = page.waitForResponse(
        (response) => response.url().includes("/api/client/set-logs") && response.request().method() === "PUT",
      );

      await clickUntilHydratedValue(fillButton, repsInput, "8");
      await expect(loadInput).toHaveValue("40");
      expect((await saveResponse).status()).toBe(200);

      await page.reload();
      await expect(page.getByLabel("Set 1 reps")).toHaveValue("8");
      await expect(page.getByLabel("Set 1 load kg")).toHaveValue("40");
    } finally {
      if (createdSessionId) {
        await trainerRequest.delete(`/api/workout-sessions/${createdSessionId}`);
      }
      await trainerRequest.dispose();
    }
  });
});
