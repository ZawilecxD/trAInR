import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  commitTemplateImport,
  previewTemplateImport,
  type TransferImportDeps,
} from "@/lib/session-templates/transfer-import";

const trainerId = "c2000001-0000-4000-8000-000000000001";
const exerciseId = "a1000001-0000-4000-8000-000000000001";
const templateId = "t1000001-0000-4000-8000-000000000001";

const document = {
  schema_version: 1,
  kind: "session_template",
  name: "Upper A",
  description: null,
  exercises: [
    {
      name: "Bench Press",
      default_metric: "reps_weight",
      phase: "main",
      sort_order: 0,
      notes: null,
      sets: [
        {
          prescribed_reps: 10,
          prescribed_duration_seconds: null,
          prescribed_load_kg: 50,
          rest_after_seconds: 60,
          is_warmup: false,
        },
      ],
    },
  ],
};

function makeDeps(overrides?: Partial<TransferImportDeps>): TransferImportDeps {
  return {
    listLibraryExercises: vi.fn(() =>
      Promise.resolve({
        data: [
          {
            id: exerciseId,
            name: "Bench Press",
            default_metric: "reps_weight" as const,
            is_archived: false,
          },
        ],
        error: null,
      }),
    ),
    listTemplateNameMatches: vi.fn(() => Promise.resolve({ data: [], error: null })),
    createTemplate: vi.fn(() => Promise.resolve({ data: { id: templateId }, error: null })),
    updateTemplate: vi.fn(() => Promise.resolve({ data: { id: templateId }, error: null })),
    getTemplateTrainerId: vi.fn(() =>
      Promise.resolve({
        data: { id: templateId, trainer_id: trainerId },
        error: null,
      }),
    ),
    ...overrides,
  };
}

const supabase = {} as SupabaseClient;

describe("previewTemplateImport", () => {
  it("returns create when the template name is free", async () => {
    const result = await previewTemplateImport(supabase, trainerId, document, makeDeps());
    expect(result).toMatchObject({
      ok: true,
      preview: {
        action_needed: "create",
        existing_template: null,
        summary: { name: "Upper A", exercise_count: 1 },
      },
    });
  });

  it("returns choose when one template matches", async () => {
    const deps = makeDeps({
      listTemplateNameMatches: vi.fn(() =>
        Promise.resolve({
          data: [{ id: templateId, name: "Upper A" }],
          error: null,
        }),
      ),
    });

    const result = await previewTemplateImport(supabase, trainerId, document, deps);
    expect(result).toMatchObject({
      ok: true,
      preview: {
        action_needed: "choose",
        existing_template: { id: templateId, name: "Upper A" },
      },
    });
  });
});

describe("commitTemplateImport", () => {
  it("creates when action is create and clash is empty", async () => {
    const deps = makeDeps();
    const result = await commitTemplateImport(supabase, trainerId, document, "create", deps);
    expect(result).toEqual({ ok: true, outcome: "created", template_id: templateId });
    expect(deps.createTemplate).toHaveBeenCalledOnce();
  });

  it("skips without writing", async () => {
    const deps = makeDeps({
      listTemplateNameMatches: vi.fn(() =>
        Promise.resolve({
          data: [{ id: templateId, name: "Upper A" }],
          error: null,
        }),
      ),
    });

    const result = await commitTemplateImport(supabase, trainerId, document, "skip", deps);
    expect(result).toEqual({ ok: true, outcome: "skipped" });
    expect(deps.createTemplate).not.toHaveBeenCalled();
    expect(deps.updateTemplate).not.toHaveBeenCalled();
  });

  it("overwrites using the clash-derived id", async () => {
    const deps = makeDeps({
      listTemplateNameMatches: vi.fn(() =>
        Promise.resolve({
          data: [{ id: templateId, name: "Upper A" }],
          error: null,
        }),
      ),
    });

    const result = await commitTemplateImport(supabase, trainerId, document, "overwrite", deps);
    expect(result).toEqual({ ok: true, outcome: "overwritten", template_id: templateId });
    expect(deps.updateTemplate).toHaveBeenCalledOnce();
    const call = vi.mocked(deps.updateTemplate).mock.calls[0];
    expect(call[0]).toBe(supabase);
    expect(call[1]).toBe(templateId);
    expect(call[2].name).toBe("Upper A");
    expect(Array.isArray(call[2].exercises)).toBe(true);
  });

  it("rejects create when a name clash exists", async () => {
    const deps = makeDeps({
      listTemplateNameMatches: vi.fn(() =>
        Promise.resolve({
          data: [{ id: templateId, name: "Upper A" }],
          error: null,
        }),
      ),
    });

    const result = await commitTemplateImport(supabase, trainerId, document, "create", deps);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("validation_error");
    expect(deps.createTemplate).not.toHaveBeenCalled();
  });

  it("rejects overwrite when no clash exists", async () => {
    const result = await commitTemplateImport(supabase, trainerId, document, "overwrite", makeDeps());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("validation_error");
  });
});
