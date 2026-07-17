/**
 * S-21 — optional RPE logging per exercise round.
 * Client can optionally log RPE (1–10) when logging sets; value persists and
 * appears in the finished session summary readout.
 */
import { test, expect } from "@playwright/test";
import { CLIENT_STORAGE_STATE, TRAINER_STORAGE_STATE } from "./auth";
import { clickUntilHydrated } from "./hydration";

const CLIENT_A_ID = "c2000001-0000-4000-8000-000000000002";
const BENCH_PRESS_ID = "e2000001-0000-4000-8000-000000000001";

test.use({
  storageState: CLIENT_STORAGE_STATE,
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.describe("S-21 — optional RPE logging", () => {
  test("client logs optional RPE and sees it after reload and in summary", async ({ page, playwright, baseURL }) => {
    const trainerRequest = await playwright.request.newContext({
      baseURL: baseURL ?? "http://localhost:4321",
      storageState: TRAINER_STORAGE_STATE,
    });
    let createdSessionId: string | null = null;

    try {
      const uniqueSuffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const sessionName = `E2E RPE Logging ${uniqueSuffix}`;
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
              notes: "E2E RPE visibility check",
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

      const warmupToggle = page.getByRole("button", { name: "Warm-up" });
      await clickUntilHydrated(warmupToggle, warmupToggle, "aria-pressed", "true");

      const fillButton = page.getByLabel("Fill set 1 from prescription");
      await fillButton.click();
      await expect(page.getByLabel("Set 1 reps")).toHaveValue("8");

      const rpeInput = page.getByLabel("Set 1 RPE");
      await rpeInput.fill("8");

      await page.reload();
      await expect(page.getByLabel("Set 1 RPE")).toHaveValue("8");

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

      await expect(benchPressSummary.getByRole("columnheader", { name: "RPE" })).toBeVisible();
      await expect(benchPressSummary.getByText("8 reps @ 40 kg · RPE 8")).toBeVisible();
      await expect(benchPressSummary.getByRole("cell", { name: "8", exact: true })).toBeVisible();
    } finally {
      if (createdSessionId) {
        await trainerRequest.delete(`/api/workout-sessions/${createdSessionId}`);
      }
      await trainerRequest.dispose();
    }
  });
});
