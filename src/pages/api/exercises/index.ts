import type { APIRoute } from "astro";
import { requireTrainer } from "@/lib/api/guards";
import { jsonError, jsonResponse } from "@/lib/api/responses";
import { createExerciseBodySchema, formatZodIssues, parseListExercisesQuery } from "@/lib/exercises/schemas";
import { createExercise, listExercises } from "@/lib/exercises/service";
import { createClient } from "@/lib/supabase";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const guard = requireTrainer(context);
  if (!guard.ok) return guard.response;

  const parsedQuery = parseListExercisesQuery(context.url.searchParams);
  if (!parsedQuery.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsedQuery.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const { data, error } = await listExercises(supabase, parsedQuery.data);
  if (error) {
    return jsonError("list_failed", 500, { message: error });
  }

  return jsonResponse({ exercises: data });
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

  const parsed = createExerciseBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsed.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const { data, error } = await createExercise(supabase, guard.userId, parsed.data);
  if (error) {
    return jsonError("create_failed", 500, { message: error });
  }

  return jsonResponse({ exercise: data }, 201);
};
