import type { APIRoute } from "astro";
import { z } from "zod";

import { requireTrainer } from "@/lib/api/guards";
import { jsonError, jsonResponse } from "@/lib/api/responses";
import { formatZodIssues } from "@/lib/session-templates/schemas";
import { previewTemplateImport } from "@/lib/session-templates/transfer-import";
import { decodeTransferXlsx } from "@/lib/session-templates/transfer-xlsx";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const MAX_UPLOAD_BYTES = 1_000_000;

const jsonPreviewBodySchema = z.object({
  format: z.literal("json"),
  document: z.unknown(),
});

async function readDocumentFromRequest(
  request: Request,
): Promise<{ ok: true; document: unknown } | { ok: false; response: Response }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
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
    return { ok: true, document: decoded.data };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: jsonError("invalid_json", 400) };
  }

  const parsed = jsonPreviewBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError("validation_error", 400, {
        issues: formatZodIssues(parsed.error.issues),
      }),
    };
  }

  return { ok: true, document: parsed.data.document };
}

export const POST: APIRoute = async (context) => {
  const guard = requireTrainer(context);
  if (!guard.ok) return guard.response;

  const documentResult = await readDocumentFromRequest(context.request);
  if (!documentResult.ok) {
    return documentResult.response;
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const result = await previewTemplateImport(supabase, guard.userId, documentResult.document);
  if (!result.ok) {
    if ("loadError" in result) {
      return jsonError("fetch_failed", 500, { message: result.loadError });
    }
    return jsonError("validation_error", 400, { issues: result.issues });
  }

  return jsonResponse(result.preview);
};
