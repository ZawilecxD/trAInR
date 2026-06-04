import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import type { InviteLink } from "@/types";

export const prerender = false;

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonResponse({ error: "Supabase is not configured" }, 500);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "trainer") {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const insertResult = await supabase
    .from("invite_links")
    .insert({
      trainer_id: user.id,
      token,
      expires_at: expiresAt.toISOString(),
    })
    .select("*")
    .single();

  if (insertResult.error || !insertResult.data) {
    return jsonResponse({ error: insertResult.error?.message ?? "Failed to create invite" }, 500);
  }

  const invite = insertResult.data as InviteLink;
  const origin = new URL(context.request.url).origin;
  const url = `${origin}/auth/signup?token=${encodeURIComponent(token)}`;

  return jsonResponse({ url, invite }, 200);
};
