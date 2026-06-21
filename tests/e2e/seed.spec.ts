/**
 * SEED — the exemplar every generated E2E test is modeled on (used by /10x-e2e).
 * What you show is what you get: copy these conventions, not the anti-patterns.
 *
 * Protects: test-plan.md Risk #2 — "Partial-write corruption on multi-step saves".
 *   Creating an exercise is a multi-step write with no real transaction: the
 *   `exercises` row is inserted first, then its muscle-group rows via a separate
 *   call (src/lib/exercises/service.ts → createExercise). If the second step is
 *   lost, the saved exercise is partial. This test fails if either half of the
 *   write fails to survive a real SSR reload.
 *
 * Auth: the chromium project loads a pre-signed trainer session via
 *   `storageState` (see playwright.config.ts + auth.setup.ts). Specs NEVER log
 *   in through the UI.
 *
 * Conventions demonstrated:
 *   1. Role-based locators (getByRole / getByLabel), never CSS or XPath.
 *   2. Wait for state (waitForResponse, waitForURL, toBeVisible), never time.
 *   3. Unique test data (timestamp + uuid) so parallel runs never collide.
 *   4. Self-contained: own setup, action, assertion, and cleanup (afterEach).
 *   5. Test name bound to the risk, and an assertion that fails if it materializes.
 */
import { test, expect } from "@playwright/test";

test.describe("Risk #2 — multi-step exercise save integrity", () => {
  let createdExerciseId: string | null = null;

  test.afterEach(async ({ page }) => {
    if (!createdExerciseId) return;
    // Archiving is this app's only teardown for exercises (no hard delete in the
    // UI). page.request reuses the authenticated browser cookies.
    await page.request.patch(`/api/exercises/${createdExerciseId}`, {
      data: { is_archived: true },
    });
    createdExerciseId = null;
  });

  test("exercise with a muscle group persists completely after reload", async ({ page }) => {
    // Unique per run so parallel workers and re-runs never collide.
    const exerciseName = `E2E Seed Exercise ${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    // Setup: open the create form.
    await page.goto("/trainer/exercises/new");
    await page.getByRole("textbox", { name: "Name" }).fill(exerciseName);

    // Select a muscle group — this is the second half of the multi-step write.
    await page.getByRole("checkbox", { name: "Chest" }).check();

    // Action: submit, and capture the created id from the API response (also a
    // wait-for-state — we proceed only once the write is confirmed).
    const createResponse = page.waitForResponse(
      (res) => res.url().includes("/api/exercises") && res.request().method() === "POST" && res.status() === 201,
    );
    await page.getByRole("button", { name: "Create exercise" }).click();
    const payload = (await (await createResponse).json()) as { exercise: { id: string } };
    createdExerciseId = payload.exercise.id;

    // The form redirects to the library on success.
    await page.waitForURL("**/trainer/exercises**");

    // Assertion: BOTH halves of the write are present — the exercise row AND its
    // muscle-group row ("Chest (primary)"). This is what Risk #2 endangers.
    const row = page.getByRole("row", { name: exerciseName });
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell", { name: "Chest (primary)" })).toBeVisible();

    // The real check: survive an SSR reload (data is read back from the DB).
    await page.reload();
    const reloadedRow = page.getByRole("row", { name: exerciseName });
    await expect(reloadedRow).toBeVisible();
    await expect(reloadedRow.getByRole("cell", { name: "Chest (primary)" })).toBeVisible();
  });
});
