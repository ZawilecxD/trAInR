import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { deleteUser as adminDeleteUser, getAdmin } from "./admin.js";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env.js";

export interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
}

async function signInAnonClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Failed to sign in ${email}: ${error.message}`);
  }

  return client;
}

export async function createTrainer(): Promise<TestUser> {
  const email = `trainer-${crypto.randomUUID()}@test.local`;
  const password = crypto.randomUUID();

  const { data, error } = await getAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "trainer" },
  });

  if (error) {
    throw new Error(`Failed to create trainer: ${error.message}`);
  }

  const client = await signInAnonClient(email, password);

  return { id: data.user.id, email, password, client };
}

export async function createClient_(trainer: TestUser): Promise<TestUser> {
  const email = `client-${crypto.randomUUID()}@test.local`;
  const password = crypto.randomUUID();

  const { data, error } = await getAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "client" },
  });

  if (error) {
    throw new Error(`Failed to create client: ${error.message}`);
  }

  const { error: linkError } = await getAdmin().from("trainer_clients").insert({
    trainer_id: trainer.id,
    client_id: data.user.id,
    status: "active",
  });

  if (linkError) {
    await adminDeleteUser(data.user.id);
    throw new Error(`Failed to link client to trainer: ${linkError.message}`);
  }

  const client = await signInAnonClient(email, password);

  return { id: data.user.id, email, password, client };
}

export { adminDeleteUser as deleteUser };
