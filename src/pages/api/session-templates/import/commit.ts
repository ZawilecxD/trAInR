import type { APIRoute } from "astro";
import { z } from "zod";

import { requireTrainer } from "@/lib/api/guards";
import { jsonError, jsonResponse } from "@/lib/api/responses";
import { formatZodIssues } from "@/lib/session-templates/schemas";
import { commitTemplateImport, type ImportAction } from "@/lib/session-templates/transfer-import";
import { decodeTransferXlsx } from "@/lib/session-templates/transfer-xlsx";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const MAX_UPLOAD_BYTES = 1_000_000;

const jsonCommitBodySchema = z.object({
  format: z.literal("json"),
  document: z.unknown(),
  action: z.enum(["create", "skip", "overwrite"]),
});

async function readCommitFromRequest(
  request: Request,
): Promise<{ ok: true; document: unknown; action: ImportAction } | { ok: false; response: Response }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const actionRaw = form.get("action");
    const actionParsed = z.enum(["create", "skip", "overwrite"]).safeParse(actionRaw);
    if (!actionParsed.success) {
      return {
        ok: false,
        response: jsonError("validation_error", 400, {
          issues: formatZodIssues(actionParsed.error.issues),
        }),
      };
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return {
        ok: false,
        response: jsonError("validation_error", 400, {
          issues: [{ path: "file", message: "file field is required" }],
        }),
      };
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return { ok: false, response: jsonError("payload_too_large", 413) };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const decoded = await decodeTransferXlsx(buffer);
    if (!decoded.ok) {
      return {
        ok: false,
        response: jsonError("validation_error", 400, { issues: decoded.issues }),
      };
    }

    return { ok: true, document: decoded.data, action: actionParsed.data };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: jsonError("invalid_json", 400) };
  }

  const parsed = jsonCommitBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError("validation_error", 400, {
        issues: formatZodIssues(parsed.error.issues),
      }),
    };
  }

  return { ok: true, document: parsed.data.document, action: parsed.data.action };
}

export const POST: APIRoute = async (context) => {
  const guard = requireTrainer(context);
  if (!guard.ok) return guard.response;

  const payload = await readCommitFromRequest(context.request);
  if (!payload.ok) {
    return payload.response;
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const result = await commitTemplateImport(supabase, guard.userId, payload.document, payload.action);

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
