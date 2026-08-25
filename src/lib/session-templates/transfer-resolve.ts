import type { CreateTemplateBody } from "@/lib/session-templates/schemas";
import type { SessionTemplateTransfer, TransferIssue } from "@/lib/session-templates/transfer-schema";
import type { ExerciseMetric } from "@/types";

export interface TransferLibraryExercise {
  id: string;
  name: string;
  default_metric: ExerciseMetric;
  is_archived: boolean;
}

export type ResolveTransferResult = { ok: true; body: CreateTemplateBody } | { ok: false; issues: TransferIssue[] };

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function resolveTransferExercises(
  transfer: SessionTemplateTransfer,
  library: TransferLibraryExercise[],
): ResolveTransferResult {
  const byName = new Map<string, TransferLibraryExercise>();
  for (const row of library) {
    byName.set(normalizeName(row.name), row);
  }

  const issues: TransferIssue[] = [];
  const exercises: CreateTemplateBody["exercises"] = [];

  for (const [index, exercise] of transfer.exercises.entries()) {
    const path = `exercises.${index}`;
    const match = byName.get(normalizeName(exercise.name));

    if (!match) {
      issues.push({
        path: `${path}.name`,
        message: `Exercise ${exercise.name} was not found in your library`,
      });
      continue;
    }

    if (match.is_archived) {
      issues.push({
        path: `${path}.name`,
        message: `Exercise ${exercise.name} is archived and cannot be used for import`,
      });
      continue;
    }

    if (match.default_metric !== exercise.default_metric) {
      issues.push({
        path: `${path}.default_metric`,
        message: `Exercise ${exercise.name} default_metric does not match your library (file: ${exercise.default_metric}, library: ${match.default_metric})`,
      });
      continue;
    }

    exercises.push({
      exercise_id: match.id,
      phase: exercise.phase,
      sort_order: exercise.sort_order,
      notes: exercise.notes,
      sets: exercise.sets,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    body: {
      name: transfer.name,
      description: transfer.description,
      exercises,
    },
  };
}
