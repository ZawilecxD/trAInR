import type { APIContext } from "astro";
import { jsonError } from "@/lib/api/responses";

export type TrainerGuardResult = { ok: true; userId: string } | { ok: false; response: Response };

export function requireTrainer(context: APIContext): TrainerGuardResult {
  if (!context.locals.user) {
    return { ok: false, response: jsonError("unauthorized", 401) };
  }

  if (context.locals.role !== "trainer") {
    return { ok: false, response: jsonError("forbidden", 403) };
  }

  return { ok: true, userId: context.locals.user.id };
}
