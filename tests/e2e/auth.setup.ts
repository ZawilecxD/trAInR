import { test as setup, expect, type Page } from "@playwright/test";
import { CLIENT_STORAGE_STATE, TRAINER_STORAGE_STATE, clientCredentials, trainerCredentials } from "./auth";
import { clickUntilHydrated } from "./hydration";

setup.describe.configure({ mode: "serial" });

async function signInThroughForm(page: Page, email: string, password: string) {
  await page.goto("/auth/signin");

  // These `data-testid` hooks exist only in dev/test builds — they're stripped
  // from production (see astro.config.mjs). Specs run against `astro dev`.
  const emailInput = page.getByTestId("signin-email");
  const passwordInput = page.getByTestId("signin-password");
  const passwordToggle = page.getByTestId("signin-password-toggle");

  // SignInForm is a `client:load` island. Gate on hydration before filling: the
  // password toggle flips the input `type` only through React state, so once that
  // flip lands we know handlers are attached and controlled fills will stick.
  await clickUntilHydrated(passwordToggle, passwordInput, "type", "text");
  await passwordToggle.click();
  await expect(passwordInput).toHaveAttribute("type", "password");

  // Hydration is confirmed, so controlled inputs now retain typed values.
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await expect(emailInput).toHaveValue(email);
  await expect(passwordInput).toHaveValue(password);

  await page.getByTestId("signin-submit").click();
}

// Authenticate ONCE here, not in individual specs. Tests reuse saved sessions
// via `storageState` — logging in through the UI inside each test is slow and
// flaky (E2E rule: auth without the UI).
setup("authenticate as trainer", async ({ page }) => {
  await signInThroughForm(page, trainerCredentials.email, trainerCredentials.password);

  // Wait for the post-login state, not a timeout: a trainer lands on their dashboard.
  await page.waitForURL("**/trainer/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.context().storageState({ path: TRAINER_STORAGE_STATE });
});

setup("authenticate as client", async ({ page }) => {
  await signInThroughForm(page, clientCredentials.email, clientCredentials.password);

  // Wait for the post-login state, not a timeout: a client lands on their dashboard.
  await page.waitForURL("**/client/dashboard");
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();

  await page.context().storageState({ path: CLIENT_STORAGE_STATE });
});
