import { test as setup, expect } from "@playwright/test";
import { TRAINER_STORAGE_STATE, trainerCredentials } from "./auth";

// Authenticate ONCE here, not in individual specs. Every test in the chromium
// project reuses the saved session via `storageState` — logging in through the
// UI inside each test is slow and flaky (E2E rule: auth without the UI).
setup("authenticate as trainer", async ({ page }) => {
  await page.goto("/auth/signin");

  // getByLabel because a password input is not exposed with the "textbox" role.
  await page.getByLabel("Email").fill(trainerCredentials.email);
  await page.getByLabel("Password").fill(trainerCredentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Wait for the post-login state, not a timeout: a trainer lands on their dashboard.
  await page.waitForURL("**/trainer/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.context().storageState({ path: TRAINER_STORAGE_STATE });
});
