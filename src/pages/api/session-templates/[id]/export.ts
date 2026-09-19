import type { APIRoute } from "astro";
import { z } from "zod";

import { requireTrainer } from "@/lib/api/guards";
import { jsonError } from "@/lib/api/responses";
import { formatZodIssues, templateIdParamSchema } from "@/lib/session-templates/schemas";
import { getTemplate } from "@/lib/session-templates/service";
import { buildTransferDocument, slugifyTemplateFilename } from "@/lib/session-templates/transfer-export";
import { encodeTransferXlsx } from "@/lib/session-templates/transfer-xlsx";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const exportQuerySchema = z.object({
  format: z.enum(["json", "xlsx"]),
});

export const GET: APIRoute = async (context) => {
  const guard = requireTrainer(context);
  if (!guard.ok) return guard.response;

  const rawId = context.params.id;
  const parsedId = templateIdParamSchema.safeParse(typeof rawId === "string" ? rawId : undefined);
  if (!parsedId.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(parsedId.error.issues),
    });
  }

  const query = exportQuerySchema.safeParse({
    format: context.url.searchParams.get("format") ?? "json",
  });
  if (!query.success) {
    return jsonError("validation_error", 400, {
      issues: formatZodIssues(query.error.issues),
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("service_unavailable", 503);
  }

  const { data, error } = await getTemplate(supabase, parsedId.data);
  if (error) {
    return jsonError("fetch_failed", 500, { message: error });
  }

  if (data?.trainer_id !== guard.userId) {
    return jsonError("not_found", 404);
  }

  const built = buildTransferDocument(data);
  if (!built.ok) {
    return jsonError("validation_error", 400, { issues: built.issues });
  }

  if (query.data.format === "json") {
    return new Response(JSON.stringify(built.document, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${built.filename}"`,
      },
    });
  }

  const xlsx = await encodeTransferXlsx(built.document);
  const filename = `template-${slugifyTemplateFilename(data.name)}.xlsx`;
  return new Response(new Uint8Array(xlsx), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
};
