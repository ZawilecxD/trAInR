import type { APIRoute } from "astro";
import { requireClient } from "@/lib/api/guards";
import { jsonError, jsonResponse } from "@/lib/api/responses";
import { createClient } from "@/lib/supabase";
import { formatZodIssues, sessionIdParamSchema } from "@/lib/workout-sessions/schemas";
import { getMySessionDetail } from "@/lib/workout-sessions/service";

export const prerender = false;

function getRouteSessionId(context: Parameters<APIRoute>[0]): string | undefined {
  const id = context.params.id;
  return typeof id === "string" ? id : undefined;
}

export const GET: APIRoute = async (context) => {
  const guard = requireClient(context);
  if (!guard.ok) return guard.response;

  const rawId = getRouteSessionId(context);
  const parsedId = sessionIdParamSchema.safeParse(rawId);
  if (!parsedId.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsedId.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const { data, error } = await getMySessionDetail(supabase, guard.userId, parsedId.data);
  if (error) {
    return jsonError("fetch_failed", 500, { message: error });
  }

  if (!data) {
    return jsonError("not_found", 404);
  }

  return jsonResponse({ session: data });
};
