import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreateTemplateBody, UpdateTemplateBody } from "@/lib/session-templates/schemas";
import { createTemplate, getTemplate, updateTemplate } from "@/lib/session-templates/service";
import { resolveTemplateNameClash, type TemplateNameMatch } from "@/lib/session-templates/transfer-clash";
import { resolveTransferExercises, type TransferLibraryExercise } from "@/lib/session-templates/transfer-resolve";
import {
  parseSessionTemplateTransfer,
  type SessionTemplateTransfer,
  type TransferIssue,
} from "@/lib/session-templates/transfer-schema";

export type ImportAction = "create" | "skip" | "overwrite";

export interface ImportPreviewSuccess {
  action_needed: "create" | "choose";
  existing_template: { id: string; name: string } | null;
  summary: { name: string; exercise_count: number };
}

export type ImportPreviewResult =
  | { ok: true; preview: ImportPreviewSuccess; transfer: SessionTemplateTransfer }
  | { ok: false; issues: TransferIssue[] };

export type ImportCommitResult =
  | { ok: true; outcome: "created" | "skipped" | "overwritten"; template_id?: string }
  | { ok: false; error: "validation_error"; issues: TransferIssue[] }
  | { ok: false; error: "create_failed" | "update_failed" | "not_found"; message: string };

export interface TransferImportDeps {
  listLibraryExercises: (
    supabase: SupabaseClient,
    trainerId: string,
  ) => Promise<{ data: TransferLibraryExercise[] | null; error: string | null }>;
  listTemplateNameMatches: (
    supabase: SupabaseClient,
    trainerId: string,
  ) => Promise<{ data: TemplateNameMatch[] | null; error: string | null }>;
  createTemplate: (
    supabase: SupabaseClient,
    trainerId: string,
    body: CreateTemplateBody,
  ) => Promise<{ data: { id: string } | null; error: string | null }>;
  updateTemplate: (
    supabase: SupabaseClient,
    templateId: string,
    body: UpdateTemplateBody,
  ) => Promise<{ data: { id: string } | null; error: string | null }>;
  getTemplateTrainerId: (
    supabase: SupabaseClient,
    templateId: string,
  ) => Promise<{ data: { id: string; trainer_id: string } | null; error: string | null }>;
}

export async function listLibraryExercisesForTransfer(
  supabase: SupabaseClient,
  trainerId: string,
): Promise<{ data: TransferLibraryExercise[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, default_metric, is_archived")
    .eq("trainer_id", trainerId);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function listTemplateNameMatches(
  supabase: SupabaseClient,
  trainerId: string,
): Promise<{ data: TemplateNameMatch[] | null; error: string | null }> {
  const { data, error } = await supabase.from("session_templates").select("id, name").eq("trainer_id", trainerId);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

function defaultDeps(): TransferImportDeps {
  return {
    listLibraryExercises: listLibraryExercisesForTransfer,
    listTemplateNameMatches,
    createTemplate: async (supabase, trainerId, body) => {
      const result = await createTemplate(supabase, trainerId, body);
      return { data: result.data ? { id: result.data.id } : null, error: result.error };
    },
    updateTemplate: async (supabase, templateId, body) => {
      const result = await updateTemplate(supabase, templateId, body);
      return { data: result.data ? { id: result.data.id } : null, error: result.error };
    },
    getTemplateTrainerId: async (supabase, templateId) => {
      const result = await getTemplate(supabase, templateId);
      if (result.error) {
        return { data: null, error: result.error };
      }
      if (!result.data) {
        return { data: null, error: null };
      }
      return {
        data: { id: result.data.id, trainer_id: result.data.trainer_id },
        error: null,
      };
    },
  };
}

interface PipelineOk {
  ok: true;
  transfer: SessionTemplateTransfer;
  body: CreateTemplateBody;
  clash: Exclude<ReturnType<typeof resolveTemplateNameClash>, { status: "ambiguous" }>;
}

type PipelineFail = { ok: false; issues: TransferIssue[] } | { ok: false; loadError: string };

async function runImportPipeline(
  supabase: SupabaseClient,
  trainerId: string,
  document: unknown,
  deps: TransferImportDeps,
): Promise<PipelineOk | PipelineFail> {
  const parsed = parseSessionTemplateTransfer(document);
  if (!parsed.ok) {
    return parsed;
  }

  const libraryResult = await deps.listLibraryExercises(supabase, trainerId);
  if (libraryResult.error || !libraryResult.data) {
    return { ok: false, loadError: libraryResult.error ?? "Failed to load exercises" };
  }

  const resolved = resolveTransferExercises(parsed.data, libraryResult.data);
  if (!resolved.ok) {
    return resolved;
  }

  const templatesResult = await deps.listTemplateNameMatches(supabase, trainerId);
  if (templatesResult.error || !templatesResult.data) {
    return { ok: false, loadError: templatesResult.error ?? "Failed to load templates" };
  }

  const clash = resolveTemplateNameClash(parsed.data.name, templatesResult.data);
  if (clash.status === "ambiguous") {
    return { ok: false, issues: clash.issues };
  }

  return { ok: true, transfer: parsed.data, body: resolved.body, clash };
}

export async function previewTemplateImport(
  supabase: SupabaseClient,
  trainerId: string,
  document: unknown,
  deps: TransferImportDeps = defaultDeps(),
): Promise<ImportPreviewResult | { ok: false; loadError: string }> {
  const pipeline = await runImportPipeline(supabase, trainerId, document, deps);
  if (!pipeline.ok) {
    if ("loadError" in pipeline) {
      return { ok: false, loadError: pipeline.loadError };
    }
    return { ok: false, issues: pipeline.issues };
  }

  if (pipeline.clash.status === "create") {
    return {
      ok: true,
      transfer: pipeline.transfer,
      preview: {
        action_needed: "create",
        existing_template: null,
        summary: {
          name: pipeline.transfer.name,
          exercise_count: pipeline.transfer.exercises.length,
        },
      },
    };
  }

  return {
    ok: true,
    transfer: pipeline.transfer,
    preview: {
      action_needed: "choose",
      existing_template: {
        id: pipeline.clash.existing_id,
        name: pipeline.clash.existing_name,
      },
      summary: {
        name: pipeline.transfer.name,
        exercise_count: pipeline.transfer.exercises.length,
      },
    },
  };
}

export async function commitTemplateImport(
  supabase: SupabaseClient,
  trainerId: string,
  document: unknown,
  action: ImportAction,
  deps: TransferImportDeps = defaultDeps(),
): Promise<ImportCommitResult> {
  const pipeline = await runImportPipeline(supabase, trainerId, document, deps);
  if (!pipeline.ok) {
    if ("loadError" in pipeline) {
      return { ok: false, error: "create_failed", message: pipeline.loadError };
    }
    return { ok: false, error: "validation_error", issues: pipeline.issues };
  }

  if (action === "skip") {
    return { ok: true, outcome: "skipped" };
  }

  if (action === "create") {
    if (pipeline.clash.status !== "create") {
      return {
        ok: false,
        error: "validation_error",
        issues: [
          {
            path: "action",
            message: "create is only allowed when no template with this name exists",
          },
        ],
      };
    }

    const created = await deps.createTemplate(supabase, trainerId, pipeline.body);
    if (created.error || !created.data) {
      return {
        ok: false,
        error: "create_failed",
        message: created.error ?? "Failed to create template",
      };
    }

    return { ok: true, outcome: "created", template_id: created.data.id };
  }

  if (pipeline.clash.status !== "choose") {
    return {
      ok: false,
      error: "validation_error",
      issues: [
        {
          path: "action",
          message: "overwrite is only allowed when exactly one template with this name exists",
        },
      ],
    };
  }

  const existingId = pipeline.clash.existing_id;
  const owned = await deps.getTemplateTrainerId(supabase, existingId);
  if (owned.error) {
    return { ok: false, error: "update_failed", message: owned.error };
  }
  if (owned.data?.trainer_id !== trainerId) {
    return { ok: false, error: "not_found", message: "Template not found" };
  }

  const updated = await deps.updateTemplate(supabase, existingId, {
    name: pipeline.body.name,
    description: pipeline.body.description,
    exercises: pipeline.body.exercises,
  });

  if (updated.error || !updated.data) {
    return {
      ok: false,
      error: "update_failed",
      message: updated.error ?? "Failed to update template",
    };
  }

  return { ok: true, outcome: "overwritten", template_id: updated.data.id };
}
