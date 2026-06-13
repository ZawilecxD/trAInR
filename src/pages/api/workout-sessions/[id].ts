import type { APIRoute } from "astro";
import { requireTrainer } from "@/lib/api/guards";
import { jsonError, jsonResponse } from "@/lib/api/responses";
import { mapWorkoutSessionRpcError } from "@/lib/workout-sessions/rpc-errors";
import { formatZodIssues, sessionIdParamSchema, updateWorkoutSessionBodySchema } from "@/lib/workout-sessions/schemas";
import { deleteWorkoutSession, getSessionWithExercises, updateWorkoutSession } from "@/lib/workout-sessions/service";
import { createClient } from "@/lib/supabase";

export const prerender = false;

function getRouteSessionId(context: Parameters<APIRoute>[0]): string | undefined {
  const id = context.params.id;
  return typeof id === "string" ? id : undefined;
}

export const GET: APIRoute = async (context) => {
  const guard = requireTrainer(context);
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

  const { data, error } = await getSessionWithExercises(supabase, parsedId.data);
  if (error) {
    return jsonError("fetch_failed", 500, { message: error });
  }

  if (!data) {
    return jsonError("not_found", 404);
  }

  return jsonResponse({ session: data });
};

export const PATCH: APIRoute = async (context) => {
  const guard = requireTrainer(context);
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

  const parsedBody = updateWorkoutSessionBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsedBody.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const { error } = await updateWorkoutSession(supabase, parsedId.data, parsedBody.data);
  if (error) {
    const mapped = mapWorkoutSessionRpcError(error);
    return jsonError(mapped.code, mapped.status, mapped.status < 500 ? { message: error } : undefined);
  }

  const { data, error: fetchError } = await getSessionWithExercises(supabase, parsedId.data);
  if (fetchError) {
    return jsonError("fetch_failed", 500, { message: fetchError });
  }

  if (!data) {
    return jsonError("not_found", 404);
  }

  return jsonResponse({ session: data });
};

export const DELETE: APIRoute = async (context) => {
  const guard = requireTrainer(context);
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

  const { data: existing, error: fetchError } = await getSessionWithExercises(supabase, parsedId.data);
  if (fetchError) {
    return jsonError("fetch_failed", 500, { message: fetchError });
  }

  if (!existing) {
    return jsonError("not_found", 404);
  }

  const { error } = await deleteWorkoutSession(supabase, parsedId.data);
  if (error) {
    const mapped = mapWorkoutSessionRpcError(error);
    return jsonError(mapped.code, mapped.status, mapped.status < 500 ? { message: error } : undefined);
  }

  return new Response(null, { status: 204 });
};
