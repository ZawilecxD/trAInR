import type { SupabaseClient } from "@supabase/supabase-js";

export interface ActiveClientPlan {
  id: string;
  name: string;
  start_date: string | null;
}

export async function getActivePlanForClient(
  supabase: SupabaseClient,
  trainerId: string,
  clientId: string,
): Promise<{ data: ActiveClientPlan | null; error: string | null }> {
  const result = await supabase
    .from("client_plans")
    .select("id, name, start_date")
    .eq("trainer_id", trainerId)
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();

  if (result.error) {
    return { data: null, error: result.error.message };
  }

  return { data: result.data, error: null };
}

export async function isTrainerAssignedToClient(
  supabase: SupabaseClient,
  trainerId: string,
  clientId: string,
): Promise<{ assigned: boolean; error: string | null }> {
  const result = await supabase
    .from("trainer_clients")
    .select("id")
    .eq("trainer_id", trainerId)
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();

  if (result.error) {
    return { assigned: false, error: result.error.message };
  }

  return { assigned: result.data !== null, error: null };
}
