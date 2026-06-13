import type { APIRoute } from "astro";
import { requireClient } from "@/lib/api/guards";
import { jsonError, jsonResponse } from "@/lib/api/responses";
import { createClient } from "@/lib/supabase";
import { clientSessionsQuerySchema, formatZodIssues } from "@/lib/workout-sessions/schemas";
import { listMySessionsAsClient } from "@/lib/workout-sessions/service";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const guard = requireClient(context);
  if (!guard.ok) return guard.response;

  const query = {
    from: context.url.searchParams.get("from"),
    to: context.url.searchParams.get("to"),
  };

  const parsed = clientSessionsQuerySchema.safeParse(query);
  if (!parsed.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsed.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const { data, error } = await listMySessionsAsClient(supabase, guard.userId, parsed.data.from, parsed.data.to);

  if (error) {
    return jsonError("list_failed", 500, { message: error });
  }

  return jsonResponse({ sessions: data });
};
