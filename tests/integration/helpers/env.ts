import { loadEnv } from "vite";

export const SUPABASE_URL = process.env.INTEGRATION_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.INTEGRATION_SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.INTEGRATION_SUPABASE_SERVICE_ROLE_KEY;

const REQUIRED_VARS = [
  "INTEGRATION_SUPABASE_URL",
  "INTEGRATION_SUPABASE_ANON_KEY",
  "INTEGRATION_SUPABASE_SERVICE_ROLE_KEY",
] as const;

/** Load `.env` / `.env.local` into `process.env` (does not override existing vars). */
export function loadLocalEnvFiles() {
  const env = loadEnv(process.env.NODE_ENV ?? "test", process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    process.env[key] ??= value;
  }
}

export function assertEnv() {
  const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Integration env vars missing: ${missing.join(", ")}`);
  }
}

function requireEnv(name: (typeof REQUIRED_VARS)[number]): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return requireEnv("INTEGRATION_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string {
  return requireEnv("INTEGRATION_SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey(): string {
  return requireEnv("INTEGRATION_SUPABASE_SERVICE_ROLE_KEY");
}
