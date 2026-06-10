import {
  type PhaseEntries,
  assembleTemplatePayload,
  templateExercisesToPhaseEntries,
} from "@/lib/session-templates/form-validation";
import {
  createWorkoutSessionBodySchema,
  type CreateWorkoutSessionBody,
  type UpdateWorkoutSessionBody,
  updateWorkoutSessionBodySchema,
} from "@/lib/workout-sessions/schemas";
import type { SessionExerciseWithName } from "@/lib/workout-sessions/service";

export type SessionFormFieldErrors = Partial<Record<"name" | "scheduledDate" | "form", string>>;

export function sessionExercisesToPhaseEntries(exercises: SessionExerciseWithName[]): PhaseEntries {
  return templateExercisesToPhaseEntries(exercises);
}

function exercisesFromPhaseEntries(phaseEntries: PhaseEntries): CreateWorkoutSessionBody["exercises"] {
  const templatePayload = assembleTemplatePayload("", "", phaseEntries);
  return templatePayload.exercises;
}

function issuesToFieldErrors(issues: { path: string; message: string }[]): SessionFormFieldErrors {
  const errors: SessionFormFieldErrors = {};

  for (const issue of issues) {
    const field = issue.path.split(".")[0];
    if (field === "name") {
      errors.name = issue.message;
    } else if (field === "scheduled_date") {
      errors.scheduledDate = issue.message;
    } else {
      errors.form ??= issue.message;
    }
  }

  return errors;
}

export function validateCreateSessionForm(
  clientId: string,
  scheduledDate: string,
  name: string,
  sourceTemplateId: string | null,
  phaseEntries: PhaseEntries,
): { success: true; data: CreateWorkoutSessionBody } | { success: false; errors: SessionFormFieldErrors } {
  const payload: CreateWorkoutSessionBody = {
    client_id: clientId,
    scheduled_date: scheduledDate,
    name,
    source_template_id: sourceTemplateId,
    exercises: exercisesFromPhaseEntries(phaseEntries),
  };

  const parsed = createWorkoutSessionBodySchema.safeParse(payload);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  return {
    success: false,
    errors: issuesToFieldErrors(
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    ),
  };
}

export function validateUpdateSessionForm(
  scheduledDate: string,
  name: string,
  phaseEntries: PhaseEntries,
): { success: true; data: UpdateWorkoutSessionBody } | { success: false; errors: SessionFormFieldErrors } {
  const payload: UpdateWorkoutSessionBody = {
    scheduled_date: scheduledDate,
    name,
    exercises: exercisesFromPhaseEntries(phaseEntries),
  };

  const parsed = updateWorkoutSessionBodySchema.safeParse(payload);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  return {
    success: false,
    errors: issuesToFieldErrors(
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    ),
  };
}

export function isSessionEditable(session: { status: string; started_at: string | null }): boolean {
  return session.status === "not_started" && session.started_at === null;
}
