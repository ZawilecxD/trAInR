/**
 * Risk: context/foundation/test-plan.md #2 — session-template write corruption
 * or wrong prescription.
 *   A trainer can create a multi-round template in the browser, reload the
 *   persisted edit page, and see the same round count, warm-up state, loads,
 *   reps, rests, and notes. This fails if the form payload drifts from the
 *   persisted template_exercise_sets shape or a multi-step save drops rows.
 *
 * Seed: tests/e2e/seed.spec.ts
 * Auth: trainer storage state is loaded by the Playwright project; specs do not
 *   log in through the UI.
 */
import { test, expect } from "@playwright/test";
import { TRAINER_STORAGE_STATE } from "./auth";

test.use({ storageState: TRAINER_STORAGE_STATE });

test.describe("Risk #2 — session-template prescription persistence", () => {
  let createdTemplateId: string | null = null;

  test.afterEach(async ({ page }) => {
    if (!createdTemplateId) return;
    await page.request.delete(`/api/session-templates/${createdTemplateId}`);
    createdTemplateId = null;
  });

  test("multi-round template prescription survives submit and edit-page reload", async ({ page }) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const templateName = `E2E Template Persistence ${uniqueSuffix}`;
    const templateDescription = `Risk #2 browser persistence check ${uniqueSuffix}`;
    const exerciseName = "Barbell Back Squat";

    // Setup: open the create form and use the exercise picker as the hydration
    // signal before touching controlled inputs.
    await page.goto("/trainer/templates/new");
    const picker = page.getByRole("dialog", { name: "Add exercise" });
    await expect(async () => {
      await page.getByRole("button", { name: "Add exercise to Main" }).click();
      await expect(picker).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    await page.getByLabel("Name").fill(templateName);
    await page.getByLabel("Description (optional)").fill(templateDescription);

    // Setup: add one main-phase exercise and shape it into two distinct rounds.
    await expect(picker).toBeVisible();
    await picker.getByRole("searchbox", { name: "Search exercises" }).fill(exerciseName);
    await picker.getByRole("button", { name: exerciseName }).click();
    await expect(page.getByRole("button", { name: `${exerciseName} round 1 Warm-up` })).toBeVisible();

    await page.getByRole("button", { name: `${exerciseName} round 1 Warm-up` }).click();
    await expect(page.getByRole("button", { name: `${exerciseName} round 1 Warm-up` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByLabel(`${exerciseName} round 1 reps`).fill("8");
    await page.getByLabel(`${exerciseName} round 1 load kg`).fill("40");
    await page.getByLabel(`${exerciseName} round 1 rest seconds`).fill("90");

    await page.getByRole("button", { name: `Add round to ${exerciseName}` }).click();
    await page.getByRole("button", { name: `${exerciseName} round 2 Working` }).click();
    await expect(page.getByRole("button", { name: `${exerciseName} round 2 Working` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByLabel(`${exerciseName} round 2 reps`).fill("6");
    await page.getByLabel(`${exerciseName} round 2 load kg`).fill("45.5");
    await page.getByLabel(`${exerciseName} round 2 rest seconds`).fill("120");
    await page.getByLabel(`${exerciseName} notes`).fill("Keep shoulder blades pinned.");

    // Action: submit through the browser and wait for the real API write.
    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (response) => response.url().includes("/api/session-templates") && response.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Create template" }).click(),
    ]);
    expect(createResponse.status()).toBe(201);

    await page.waitForURL("**/trainer/templates?created=1");
    await expect(page.getByRole("row", { name: new RegExp(templateName) })).toBeVisible();
    const listResponse = await page.request.get("/api/session-templates");
    expect(listResponse.status()).toBe(200);
    const listBody = (await listResponse.json()) as { templates?: { id: string; name: string }[] };
    createdTemplateId = listBody.templates?.find((template) => template.name === templateName)?.id ?? null;
    expect(createdTemplateId).toBeTruthy();

    // Assertion: reload the persisted edit page, proving the values came back
    // from the database instead of remaining in create-form React state.
    await page.goto(`/trainer/templates/${createdTemplateId}`);
    await expect(page.getByRole("heading", { name: "Edit template" })).toBeVisible();
    await page.reload();

    await expect(page.getByLabel("Name")).toHaveValue(templateName);
    await expect(page.getByLabel("Description (optional)")).toHaveValue(templateDescription);
    await expect(page.getByText(exerciseName)).toBeVisible();
    await expect(page.getByRole("button", { name: `${exerciseName} round 1 Warm-up` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByLabel(`${exerciseName} round 1 reps`)).toHaveValue("8");
    await expect(page.getByLabel(`${exerciseName} round 1 load kg`)).toHaveValue("40");
    await expect(page.getByLabel(`${exerciseName} round 1 rest seconds`)).toHaveValue("90");
    await expect(page.getByRole("button", { name: `${exerciseName} round 2 Working` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByLabel(`${exerciseName} round 2 reps`)).toHaveValue("6");
    await expect(page.getByLabel(`${exerciseName} round 2 load kg`)).toHaveValue("45.5");
    await expect(page.getByLabel(`${exerciseName} round 2 rest seconds`)).toHaveValue("120");
    await expect(page.getByLabel(`${exerciseName} notes`)).toHaveValue("Keep shoulder blades pinned.");
  });
});
