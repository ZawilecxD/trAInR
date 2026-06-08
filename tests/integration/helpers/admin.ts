import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleKey, getSupabaseUrl } from "./env.js";

let adminClient: SupabaseClient | undefined;

export function getAdmin(): SupabaseClient {
  adminClient ??= createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return adminClient;
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await getAdmin().auth.admin.deleteUser(id);
  if (error) {
    throw new Error(`Failed to delete user ${id}: ${error.message}`);
  }
}
