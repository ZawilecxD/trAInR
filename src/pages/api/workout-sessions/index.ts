import type { APIRoute } from "astro";
import { requireTrainer } from "@/lib/api/guards";
import { jsonError, jsonResponse } from "@/lib/api/responses";
import { isTrainerAssignedToClient } from "@/lib/client-plans/service";
import { mapWorkoutSessionRpcError } from "@/lib/workout-sessions/rpc-errors";
import {
  createWorkoutSessionBodySchema,
  formatZodIssues,
  listSessionsQuerySchema,
} from "@/lib/workout-sessions/schemas";
import { createWorkoutSession, getSessionWithExercises, listSessionsForClient } from "@/lib/workout-sessions/service";
import { createClient } from "@/lib/supabase";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const guard = requireTrainer(context);
  if (!guard.ok) return guard.response;

  const query = {
    client_id: context.url.searchParams.get("client_id"),
    from: context.url.searchParams.get("from"),
    to: context.url.searchParams.get("to"),
  };

  const parsed = listSessionsQuerySchema.safeParse(query);
  if (!parsed.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsed.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const { assigned, error: assignmentError } = await isTrainerAssignedToClient(
    supabase,
    guard.userId,
    parsed.data.client_id,
  );

  if (assignmentError) {
    return jsonError("assignment_check_failed", 500, { message: assignmentError });
  }

  if (!assigned) {
    return jsonError("forbidden", 403);
  }

  const { data, error } = await listSessionsForClient(
    supabase,
    guard.userId,
    parsed.data.client_id,
    parsed.data.from,
    parsed.data.to,
  );

  if (error) {
    return jsonError("list_failed", 500, { message: error });
  }

  return jsonResponse({ sessions: data });
};

export const POST: APIRoute = async (context) => {
  const guard = requireTrainer(context);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const parsed = createWorkoutSessionBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsed.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const { assigned, error: assignmentError } = await isTrainerAssignedToClient(
    supabase,
    guard.userId,
    parsed.data.client_id,
  );

  if (assignmentError) {
    return jsonError("assignment_check_failed", 500, { message: assignmentError });
  }

  if (!assigned) {
    return jsonError("forbidden", 403);
  }

  const { data: sessionId, error } = await createWorkoutSession(supabase, parsed.data);
  if (error) {
    const mapped = mapWorkoutSessionRpcError(error);
    return jsonError(mapped.code, mapped.status, mapped.status < 500 ? { message: error } : undefined);
  }

  if (!sessionId) {
    return jsonError("create_failed", 500);
  }

  const { data: session, error: fetchError } = await getSessionWithExercises(supabase, sessionId);
  if (fetchError) {
    return jsonError("fetch_failed", 500, { message: fetchError });
  }

  return jsonResponse({ session }, 201);
};
