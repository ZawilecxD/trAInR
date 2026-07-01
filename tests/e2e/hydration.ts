import { expect, type Locator } from "@playwright/test";

// Astro `client:load` islands render interactive-looking SSR markup BEFORE React
// hydrates. Any interaction sent pre-hydration is dropped: clicks hit no handler,
// and (worse) a programmatic `fill` on a controlled input poisons React's value
// tracker so every later identical fill is swallowed as "no change". The cure is
// to gate on a signal that ONLY flips through React state before touching inputs.
//
// `control` is repeatedly actuated until `signal` reports `attribute=value`,
// which proves handlers are attached. `stepTimeout` keeps each probe short so the
// outer retry re-actuates quickly; `timeout` bounds total hydration wait.
const DEFAULT_STEP_TIMEOUT_MS = 1000;
const DEFAULT_HYDRATION_TIMEOUT_MS = 15_000;

export async function clickUntilHydrated(
  control: Locator,
  signal: Locator,
  attribute: string,
  value: string,
  {
    stepTimeoutMs = DEFAULT_STEP_TIMEOUT_MS,
    timeoutMs = DEFAULT_HYDRATION_TIMEOUT_MS,
  }: { stepTimeoutMs?: number; timeoutMs?: number } = {},
): Promise<void> {
  await expect(async () => {
    await control.click();
    await expect(signal).toHaveAttribute(attribute, value, { timeout: stepTimeoutMs });
  }).toPass({ timeout: timeoutMs });
}

export async function clickUntilHydratedValue(
  control: Locator,
  signal: Locator,
  value: string,
  {
    stepTimeoutMs = DEFAULT_STEP_TIMEOUT_MS,
    timeoutMs = DEFAULT_HYDRATION_TIMEOUT_MS,
  }: { stepTimeoutMs?: number; timeoutMs?: number } = {},
): Promise<void> {
  await expect(async () => {
    await control.click();
    await expect(signal).toHaveValue(value, { timeout: stepTimeoutMs });
  }).toPass({ timeout: timeoutMs });
}
