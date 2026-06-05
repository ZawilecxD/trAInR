import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const assignmentIdSchema = z.uuid({ error: "Invalid assignment id" });

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getRouteAssignmentId(context: Parameters<APIRoute>[0]): string | undefined {
  const id = context.params.id;
  return typeof id === "string" ? id : undefined;
}

export const DELETE: APIRoute = async (context) => {
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

  const rawId = getRouteAssignmentId(context);
  const parsedId = assignmentIdSchema.safeParse(rawId);
  if (!parsedId.success) {
    return jsonResponse({ error: "Invalid assignment id" }, 400);
  }

  const { error: rpcError } = await supabase.rpc("remove_trainer_client", {
    p_assignment_id: parsedId.data,
  });

  if (rpcError) {
    const message = rpcError.message;
    if (message.includes("Assignment not found or already removed")) {
      return jsonResponse({ error: message }, 404);
    }
    return jsonResponse({ error: message }, 500);
  }

  return jsonResponse({ ok: true }, 200);
};
