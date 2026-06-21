// Shared E2E auth constants. The `setup` project (auth.setup.ts) writes a
// signed-in trainer session here; the chromium project loads it via
// `storageState` so individual specs never log in through the UI.
export const TRAINER_STORAGE_STATE = "playwright/.auth/trainer.json";

// Defaults match the local Supabase dev seed (scripts/seed-dev-users.sql).
// Override per environment with E2E_TRAINER_EMAIL / E2E_TRAINER_PASSWORD.
export const trainerCredentials = {
  email: process.env.E2E_TRAINER_EMAIL ?? "trainer-A@gmail.com",
  password: process.env.E2E_TRAINER_PASSWORD ?? "Rooster2",
};
