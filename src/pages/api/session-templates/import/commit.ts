import type { APIRoute } from "astro";
import { z } from "zod";

import { requireTrainer } from "@/lib/api/guards";
import { jsonError, jsonResponse } from "@/lib/api/responses";
import { formatZodIssues } from "@/lib/session-templates/schemas";
import { commitTemplateImport } from "@/lib/session-templates/transfer-import";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const commitBodySchema = z.object({
  format: z.literal("json"),
  document: z.unknown(),
  action: z.enum(["create", "skip", "overwrite"]),
});

export const POST: APIRoute = async (context) => {
  const guard = requireTrainer(context);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const parsed = commitBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsed.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const result = await commitTemplateImport(supabase, guard.userId, parsed.data.document, parsed.data.action);

  if (!result.ok) {
    if (result.error === "validation_error") {
      return jsonError("validation_error", 400, { issues: result.issues });
    }
    if (result.error === "not_found") {
      return jsonError("not_found", 404);
    }
    return jsonError(result.error, 500, { message: result.message });
  }

  return jsonResponse({
    outcome: result.outcome,
    template_id: result.template_id ?? null,
  });
};
