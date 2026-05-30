import type { APIRoute } from "astro";
import { requireTrainer } from "@/lib/api/guards";
import { jsonError, jsonResponse } from "@/lib/api/responses";
import { exerciseIdParamSchema, formatZodIssues, updateExerciseBodySchema } from "@/lib/exercises/schemas";
import { getExercise, updateExercise } from "@/lib/exercises/service";
import { createClient } from "@/lib/supabase";

export const prerender = false;

function getRouteExerciseId(context: Parameters<APIRoute>[0]): string | undefined {
  const id = context.params.id;
  return typeof id === "string" ? id : undefined;
}

export const GET: APIRoute = async (context) => {
  const guard = requireTrainer(context);
  if (!guard.ok) return guard.response;

  const rawId = getRouteExerciseId(context);
  const parsedId = exerciseIdParamSchema.safeParse(rawId);
  if (!parsedId.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsedId.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const { data, error } = await getExercise(supabase, parsedId.data);
  if (error) {
    return jsonError("fetch_failed", 500, { message: error });
  }

  if (!data) {
    return jsonError("not_found", 404);
  }

  return jsonResponse({ exercise: data });
};

export const PATCH: APIRoute = async (context) => {
  const guard = requireTrainer(context);
  if (!guard.ok) return guard.response;

  const rawId = getRouteExerciseId(context);
  const parsedId = exerciseIdParamSchema.safeParse(rawId);
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

  const parsedBody = updateExerciseBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsedBody.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const { data, error } = await updateExercise(supabase, parsedId.data, parsedBody.data);

  if (error) {
    return jsonError("update_failed", 500, { message: error });
  }

  if (!data) {
    return jsonError("not_found", 404);
  }

  return jsonResponse({ exercise: data });
};
