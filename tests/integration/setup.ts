export async function setup() {
  const { assertEnv, loadLocalEnvFiles } = await import("./helpers/env.js");

  loadLocalEnvFiles();
  assertEnv();

  const { getAdmin } = await import("./helpers/admin.js");
  const { error } = await getAdmin().from("muscle_groups").select("id").limit(1);

  if (error) {
    throw new Error(
      `Supabase is not running or unreachable: ${error.message}\n` + "Start local Supabase with: npx supabase start",
    );
  }
}
