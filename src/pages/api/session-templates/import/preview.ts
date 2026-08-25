import type { APIRoute } from "astro";
import { z } from "zod";

import { requireTrainer } from "@/lib/api/guards";
import { jsonError, jsonResponse } from "@/lib/api/responses";
import { formatZodIssues } from "@/lib/session-templates/schemas";
import { previewTemplateImport } from "@/lib/session-templates/transfer-import";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const previewBodySchema = z.object({
  format: z.literal("json"),
  document: z.unknown(),
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

  const parsed = previewBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsed.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const result = await previewTemplateImport(supabase, guard.userId, parsed.data.document);
  if (!result.ok) {
    if ("loadError" in result) {
      return jsonError("fetch_failed", 500, { message: result.loadError });
    }
    return jsonError("validation_error", 400, { issues: result.issues });
  }

  return jsonResponse(result.preview);
};
