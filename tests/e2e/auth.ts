// Shared E2E auth constants. The `setup` project (auth.setup.ts) writes
// signed-in sessions here; specs load them via `storageState` so individual
// tests never log in through the UI.
export const TRAINER_STORAGE_STATE = "playwright/.auth/trainer.json";
export const CLIENT_STORAGE_STATE = "playwright/.auth/client.json";

// Defaults match the local Supabase dev seed (scripts/seed-dev-users.sql).
// Override per environment with E2E_TRAINER_EMAIL / E2E_TRAINER_PASSWORD.
export const trainerCredentials = {
  email: process.env.E2E_TRAINER_EMAIL ?? "trainer-A@gmail.com",
  password: process.env.E2E_TRAINER_PASSWORD ?? "Rooster2",
};

// Override per environment with E2E_CLIENT_EMAIL / E2E_CLIENT_PASSWORD.
export const clientCredentials = {
  email: process.env.E2E_CLIENT_EMAIL ?? "client-A@gmail.com",
  password: process.env.E2E_CLIENT_PASSWORD ?? "Rooster2",
};

// A SECOND trainer with no relationship to Trainer A's clients — used to prove
// cross-tenant isolation (Trainer B must not read or write Trainer A's data).
// Override per environment with E2E_TRAINER_B_EMAIL / E2E_TRAINER_B_PASSWORD.
export const trainerBCredentials = {
  email: process.env.E2E_TRAINER_B_EMAIL ?? "trainer-B@gmail.com",
  password: process.env.E2E_TRAINER_B_PASSWORD ?? "Rooster2",
};
