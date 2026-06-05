import type { APIRoute } from "astro";
import { requireTrainer } from "@/lib/api/guards";
import { jsonError, jsonResponse } from "@/lib/api/responses";
import { createTemplateBodySchema, formatZodIssues } from "@/lib/session-templates/schemas";
import { createTemplate, listTemplates } from "@/lib/session-templates/service";
import { createClient } from "@/lib/supabase";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const guard = requireTrainer(context);
  if (!guard.ok) return guard.response;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const { data, error } = await listTemplates(supabase, guard.userId);
  if (error) {
    return jsonError("list_failed", 500, { message: error });
  }

  return jsonResponse({ templates: data });
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

  const parsed = createTemplateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsed.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const { data, error } = await createTemplate(supabase, guard.userId, parsed.data);
  if (error) {
    return jsonError("create_failed", 500, { message: error });
  }

  return jsonResponse({ template: data }, 201);
};
