/** Map integration Supabase vars to app env consumed by `astro:env/server` in route handlers. */
export function wireAppSupabaseEnv(): void {
  process.env.SUPABASE_URL ??= process.env.INTEGRATION_SUPABASE_URL;
  process.env.SUPABASE_KEY ??= process.env.INTEGRATION_SUPABASE_ANON_KEY;
}
