import { z } from "zod";

import {
  exerciseMetricSchema,
  exercisePhaseSchema,
  formatZodIssues,
  templateExerciseSetInputSchema,
} from "@/lib/session-templates/schemas";

export const transferExerciseSchema = z
  .object({
    name: z.string().trim().min(1, "Exercise name is required"),
    default_metric: exerciseMetricSchema,
    phase: exercisePhaseSchema,
    sort_order: z.number().int().min(0, "sort_order must be ≥ 0"),
    notes: z.string().nullable(),
    sets: z.array(templateExerciseSetInputSchema).min(1, "at least one round").max(20, "too many rounds"),
  })
  .strict();

export const sessionTemplateTransferSchema = z
  .object({
    schema_version: z.literal(1),
    kind: z.literal("session_template"),
    name: z.string().trim().min(1, "Name is required"),
    description: z.string().nullable(),
    exercises: z.array(transferExerciseSchema).max(50, "too many exercises"),
  })
  .strict();

export type SessionTemplateTransfer = z.infer<typeof sessionTemplateTransferSchema>;
export type TransferExercise = z.infer<typeof transferExerciseSchema>;

export interface TransferIssue {
  path: string;
  message: string;
}

export function parseSessionTemplateTransfer(
  input: unknown,
): { ok: true; data: SessionTemplateTransfer } | { ok: false; issues: TransferIssue[] } {
  const parsed = sessionTemplateTransferSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: formatZodIssues(parsed.error.issues) };
  }
  return { ok: true, data: parsed.data };
}
