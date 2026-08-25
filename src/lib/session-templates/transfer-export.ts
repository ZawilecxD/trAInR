import type { TemplateWithExercises } from "@/lib/session-templates/service";
import type { SessionTemplateTransfer, TransferIssue } from "@/lib/session-templates/transfer-schema";

const MAX_TRANSFER_EXERCISES = 50;

export type BuildTransferResult =
  | { ok: true; document: SessionTemplateTransfer; filename: string }
  | { ok: false; issues: TransferIssue[] };

export function slugifyTemplateFilename(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug.length > 0 ? slug : "template";
}

export function buildTransferDocument(template: TemplateWithExercises): BuildTransferResult {
  if (template.exercises.length > MAX_TRANSFER_EXERCISES) {
    return {
      ok: false,
      issues: [
        {
          path: "exercises",
          message: `Template has ${template.exercises.length} exercises; export supports at most ${MAX_TRANSFER_EXERCISES}`,
        },
      ],
    };
  }

  const document: SessionTemplateTransfer = {
    schema_version: 1,
    kind: "session_template",
    name: template.name,
    description: template.description,
    exercises: template.exercises
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((exercise) => ({
        name: exercise.exercise_name,
        default_metric: exercise.exercise_default_metric,
        phase: exercise.phase,
        sort_order: exercise.sort_order,
        notes: exercise.notes,
        sets: exercise.sets.map((set) => ({
          prescribed_reps: set.prescribed_reps,
          prescribed_duration_seconds: set.prescribed_duration_seconds,
          prescribed_load_kg: set.prescribed_load_kg,
          rest_after_seconds: set.rest_after_seconds,
          is_warmup: set.is_warmup,
        })),
      })),
  };

  return {
    ok: true,
    document,
    filename: `template-${slugifyTemplateFilename(template.name)}.json`,
  };
}
