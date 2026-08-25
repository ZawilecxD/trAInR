import { describe, expect, it } from "vitest";

import type { TemplateWithExercises } from "@/lib/session-templates/service";
import { buildTransferDocument, slugifyTemplateFilename } from "@/lib/session-templates/transfer-export";

function makeTemplate(overrides?: Partial<TemplateWithExercises>): TemplateWithExercises {
  return {
    id: "t1000001-0000-4000-8000-000000000001",
    trainer_id: "c2000001-0000-4000-8000-000000000001",
    name: "Upper A",
    description: "Push focus",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    exercises: [
      {
        id: "te1",
        template_id: "t1000001-0000-4000-8000-000000000001",
        exercise_id: "a1000001-0000-4000-8000-000000000001",
        phase: "main",
        sort_order: 0,
        notes: null,
        exercise_name: "Bench Press",
        exercise_default_metric: "reps_weight",
        sets: [
          {
            id: "s1",
            template_exercise_id: "te1",
            set_number: 1,
            prescribed_reps: 10,
            prescribed_duration_seconds: null,
            prescribed_load_kg: 50,
            rest_after_seconds: 60,
            is_warmup: false,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("slugifyTemplateFilename", () => {
  it("builds a filesystem-safe slug", () => {
    expect(slugifyTemplateFilename(" Upper / A!! ")).toBe("upper-a");
  });
});

describe("buildTransferDocument", () => {
  it("maps joined names without exercise_id keys", () => {
    const result = buildTransferDocument(makeTemplate());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.filename).toBe("template-upper-a.json");
    expect(result.document).toEqual({
      schema_version: 1,
      kind: "session_template",
      name: "Upper A",
      description: "Push focus",
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
    });
    expect(JSON.stringify(result.document)).not.toContain("exercise_id");
  });

  it("rejects more than 50 exercises with validation issues", () => {
    const exercises = Array.from({ length: 51 }, (_, sort_order) => ({
      id: `te${sort_order}`,
      template_id: "t1",
      exercise_id: `a${sort_order}`,
      phase: "main" as const,
      sort_order,
      notes: null,
      exercise_name: `Ex ${sort_order}`,
      exercise_default_metric: "reps_weight" as const,
      sets: [
        {
          id: `s${sort_order}`,
          template_exercise_id: `te${sort_order}`,
          set_number: 1,
          prescribed_reps: 5,
          prescribed_duration_seconds: null,
          prescribed_load_kg: null,
          rest_after_seconds: null,
          is_warmup: false,
        },
      ],
    }));

    const result = buildTransferDocument(makeTemplate({ exercises }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.path).toBe("exercises");
  });
});
