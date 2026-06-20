import type { APIRoute } from "astro";
import { requireClient } from "@/lib/api/guards";
import { jsonError, jsonResponse } from "@/lib/api/responses";
import { deleteSetLogQuerySchema, upsertSetLogBodySchema } from "@/lib/set-logs/schemas";
import { deleteSetLog, upsertSetLog } from "@/lib/set-logs/service";
import { createClient } from "@/lib/supabase";
import { formatZodIssues } from "@/lib/workout-sessions/schemas";

export const prerender = false;

export const PUT: APIRoute = async (context) => {
  const guard = requireClient(context);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const parsed = upsertSetLogBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsed.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const result = await upsertSetLog(supabase, guard.userId, parsed.data);
  if (!result.ok) {
    if (result.code === "locked") {
      return jsonError("locked", 423, { message: result.message });
    }

    if (result.code === "validation_error") {
      return jsonError("validation_error", 400, { message: result.message });
    }

    return jsonError("not_found", 404, { message: result.message });
  }

  return jsonResponse({ set_log: result.data });
};

export const DELETE: APIRoute = async (context) => {
  const guard = requireClient(context);
  if (!guard.ok) return guard.response;

  const parsed = deleteSetLogQuerySchema.safeParse({
    session_exercise_id: context.url.searchParams.get("session_exercise_id"),
    set_number: context.url.searchParams.get("set_number"),
  });

  if (!parsed.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsed.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const result = await deleteSetLog(supabase, guard.userId, parsed.data.session_exercise_id, parsed.data.set_number);

  if (!result.ok) {
    if (result.code === "locked") {
      return jsonError("locked", 423, { message: result.message });
    }

    return jsonError("not_found", 404, { message: result.message });
  }

  return jsonResponse({ ok: true });
};
