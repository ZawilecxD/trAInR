import { test as setup, expect, type Page } from "@playwright/test";
import { CLIENT_STORAGE_STATE, TRAINER_STORAGE_STATE, clientCredentials, trainerCredentials } from "./auth";

setup.describe.configure({ mode: "serial" });

async function signInThroughForm(page: Page, email: string, password: string) {
  await page.goto("/auth/signin");

  // These `data-testid` hooks exist only in dev/test builds — they're stripped
  // from production (see astro.config.mjs). Specs run against `astro dev`.
  const emailInput = page.getByTestId("signin-email");
  const passwordInput = page.getByTestId("signin-password");
  const passwordToggle = page.getByTestId("signin-password-toggle");

  // SignInForm is a `client:load` island: its SSR markup is visible and
  // clickable BEFORE React hydrates. Any interaction sent pre-hydration is
  // dropped — clicks hit no handler, and controlled inputs reset to their
  // (empty) React state the moment hydration reconciles. That race is what
  // made this setup flaky.
  //
  // Gate on a signal that ONLY changes through React state: the password
  // toggle flips the input `type`. Retry the click until the attribute
  // actually flips, which proves hydration has attached the handlers. Once
  // this passes, the form is provably interactive and fills will stick.
  await expect(async () => {
    await passwordToggle.click();
    await expect(passwordInput).toHaveAttribute("type", "text", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
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
