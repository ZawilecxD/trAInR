/**
 * Signed-in users hitting `/` must land in their role app, not the marketing
 * home that still offers Sign in / Get started.
 */
import { test, expect } from "@playwright/test";
import { CLIENT_STORAGE_STATE, TRAINER_STORAGE_STATE } from "./auth";

test.describe("signed-in root redirect", () => {
  test.describe("trainer", () => {
    test.use({ storageState: TRAINER_STORAGE_STATE });

    test("sends `/` to the trainer dashboard instead of the marketing home", async ({ page }) => {
      await page.goto("/");
      await page.waitForURL("**/trainer/dashboard");
      await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: /^Good (morning|afternoon|evening), / })).toBeVisible();
    });

    test("sends `/trainer` to the trainer dashboard", async ({ page }) => {
      await page.goto("/trainer");
      await page.waitForURL("**/trainer/dashboard");
      await expect(page.getByRole("heading", { name: /^Good (morning|afternoon|evening), / })).toBeVisible();
    });
  });

  test.describe("client", () => {
    test.use({ storageState: CLIENT_STORAGE_STATE });

    test("sends `/` to the client dashboard instead of the marketing home", async ({ page }) => {
      await page.goto("/");
      await page.waitForURL("**/client/dashboard");
      await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Client A" })).toBeVisible();
    });

    test("sends `/client` to the client dashboard", async ({ page }) => {
      await page.goto("/client");
      await page.waitForURL("**/client/dashboard");
      await expect(page.getByRole("heading", { name: "Client A" })).toBeVisible();
    });
  });
});
