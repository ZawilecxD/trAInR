import type { APIRoute } from "astro";
import { requireAuthenticated } from "@/lib/api/guards";
import { jsonError, jsonResponse } from "@/lib/api/responses";
import {
  createCommentBodySchema,
  deleteCommentQuerySchema,
  sessionIdParamSchema,
  updateCommentBodySchema,
} from "@/lib/session-comments/schemas";
import {
  createSessionComment,
  deleteSessionComment,
  listSessionComments,
  updateSessionComment,
} from "@/lib/session-comments/service";
import { createClient } from "@/lib/supabase";
import { formatZodIssues } from "@/lib/workout-sessions/schemas";

export const prerender = false;

function getRouteSessionId(context: Parameters<APIRoute>[0]): string | undefined {
  const sessionId = context.params.sessionId;
  return typeof sessionId === "string" ? sessionId : undefined;
}

export const GET: APIRoute = async (context) => {
  const guard = requireAuthenticated(context);
  if (!guard.ok) return guard.response;

  const parsedSessionId = sessionIdParamSchema.safeParse(getRouteSessionId(context));
  if (!parsedSessionId.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsedSessionId.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const result = await listSessionComments(supabase, parsedSessionId.data);
  if (!result.ok) {
    return jsonError("not_found", 404, { message: result.message });
  }

  return jsonResponse({ comments: result.data });
};

export const POST: APIRoute = async (context) => {
  const guard = requireAuthenticated(context);
  if (!guard.ok) return guard.response;

  const parsedSessionId = sessionIdParamSchema.safeParse(getRouteSessionId(context));
  if (!parsedSessionId.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsedSessionId.error.issues),
    });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const parsedBody = createCommentBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsedBody.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const result = await createSessionComment(supabase, guard.userId, parsedSessionId.data, parsedBody.data.body);
  if (!result.ok) {
    return jsonError("not_found", 404, { message: result.message });
  }

  return jsonResponse({ comment: result.data }, 201);
};

export const PATCH: APIRoute = async (context) => {
  const guard = requireAuthenticated(context);
  if (!guard.ok) return guard.response;

  const parsedSessionId = sessionIdParamSchema.safeParse(getRouteSessionId(context));
  if (!parsedSessionId.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsedSessionId.error.issues),
    });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const parsedBody = updateCommentBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsedBody.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const result = await updateSessionComment(supabase, guard.userId, parsedBody.data.comment_id, parsedBody.data.body);
  if (!result.ok) {
    return jsonError("not_found", 404, { message: result.message });
  }

  if (result.data.session_id !== parsedSessionId.data) {
    return jsonError("not_found", 404, { message: "Comment not found" });
  }

  return jsonResponse({ comment: result.data });
};

export const DELETE: APIRoute = async (context) => {
  const guard = requireAuthenticated(context);
  if (!guard.ok) return guard.response;

  const parsedSessionId = sessionIdParamSchema.safeParse(getRouteSessionId(context));
  if (!parsedSessionId.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsedSessionId.error.issues),
    });
  }

  const parsedQuery = deleteCommentQuerySchema.safeParse({
    comment_id: context.url.searchParams.get("comment_id"),
  });
  if (!parsedQuery.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsedQuery.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const listResult = await listSessionComments(supabase, parsedSessionId.data);
  if (!listResult.ok) {
    return jsonError("not_found", 404, { message: listResult.message });
  }

  const target = listResult.data.find((comment) => comment.id === parsedQuery.data.comment_id);
  if (!target) {
    return jsonError("not_found", 404, { message: "Comment not found" });
  }

  const result = await deleteSessionComment(supabase, guard.userId, parsedQuery.data.comment_id);
  if (!result.ok) {
    return jsonError("not_found", 404, { message: result.message });
  }

  return jsonResponse({ ok: true });
};
