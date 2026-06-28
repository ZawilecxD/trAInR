import type { APIRoute } from "astro";
import { requireAuthenticated } from "@/lib/api/guards";
import { jsonError, jsonResponse } from "@/lib/api/responses";
import { createSessionCommentBodySchema } from "@/lib/session-comments/schemas";
import { createSessionComment, listSessionComments } from "@/lib/session-comments/service";
import { createClient } from "@/lib/supabase";
import { formatZodIssues, sessionIdParamSchema } from "@/lib/workout-sessions/schemas";

export const prerender = false;

function getRouteSessionId(context: Parameters<APIRoute>[0]): string | undefined {
  const id = context.params.id;
  return typeof id === "string" ? id : undefined;
}

export const GET: APIRoute = async (context) => {
  const guard = requireAuthenticated(context);
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

  const { data, error } = await listSessionComments(supabase, parsedId.data);
  if (error) {
    return jsonError("fetch_failed", 500, { message: error });
  }

  return jsonResponse({ comments: data ?? [] });
};

export const POST: APIRoute = async (context) => {
  const guard = requireAuthenticated(context);
  if (!guard.ok) return guard.response;

  const rawId = getRouteSessionId(context);
  const parsedId = sessionIdParamSchema.safeParse(rawId);
  if (!parsedId.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsedId.error.issues),
    });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const parsed = createSessionCommentBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsed.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const result = await createSessionComment(supabase, guard.userId, parsedId.data, parsed.data);
  if (!result.ok) {
    if (result.code === "not_found") {
      return jsonError("not_found", 404);
    }
    return jsonError("validation_error", 400, { message: result.message });
  }

  return jsonResponse({ comment: result.data }, 201);
};
