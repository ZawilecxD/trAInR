import { describe, expect, it } from "vitest";
import { emptyPhaseEntries, type TemplateExerciseFormEntry } from "@/lib/session-templates/form-validation";
import {
  isSessionEditable,
  validateCreateSessionForm,
  validateUpdateSessionForm,
} from "@/lib/workout-sessions/form-validation";

const clientId = "b2000001-0000-4000-8000-000000000099";
const exerciseId = "e2000001-0000-4000-8000-000000000001";

function makeEntry(overrides: Partial<TemplateExerciseFormEntry> = {}): TemplateExerciseFormEntry {
  return {
    exerciseId,
    exerciseName: "Bench Press",
    exerciseDefaultMetric: "reps_weight",
    phase: "main",
    metricMode: "reps",
    rounds: [
      {
        prescribedReps: 10,
        prescribedDuration: null,
        prescribedLoadKg: null,
        restAfterSeconds: null,
        isWarmup: false,
      },
    ],
    notes: "",
    ...overrides,
  };
}

function phaseEntriesWith(entry: TemplateExerciseFormEntry) {
  const entries = emptyPhaseEntries();
  entries[entry.phase].push(entry);
  return entries;
}

describe("validateCreateSessionForm", () => {
  it("accepts valid create payload", () => {
    const result = validateCreateSessionForm(clientId, "2026-06-15", "Upper Body", null, phaseEntriesWith(makeEntry()));

    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = validateCreateSessionForm(clientId, "2026-06-15", "   ", null, emptyPhaseEntries());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.name).toBeTruthy();
    }
  });

  it("accepts negative prescribed load (assisted)", () => {
    const result = validateCreateSessionForm(
      clientId,
      "2026-06-15",
      "Assisted Pull-ups",
      null,
      phaseEntriesWith(
        makeEntry({
          rounds: [
            {
              prescribedReps: 8,
              prescribedDuration: null,
              prescribedLoadKg: -10,
              restAfterSeconds: 90,
              isWarmup: false,
            },
          ],
        }),
      ),
    );

    expect(result.success).toBe(true);
  });

  it("rejects round with both reps and duration missing", () => {
    const result = validateCreateSessionForm(
      clientId,
      "2026-06-15",
      "Invalid Session",
      null,
      phaseEntriesWith(
        makeEntry({
          rounds: [
            {
              prescribedReps: null,
              prescribedDuration: null,
              prescribedLoadKg: null,
              restAfterSeconds: null,
              isWarmup: false,
            },
          ],
        }),
      ),
    );

    expect(result.success).toBe(false);
  });

  it("rejects more than 20 rounds", () => {
    const result = validateCreateSessionForm(
      clientId,
      "2026-06-15",
      "Too Many Rounds",
      null,
      phaseEntriesWith(
        makeEntry({
          rounds: Array.from({ length: 21 }, () => ({
            prescribedReps: 10,
            prescribedDuration: null,
            prescribedLoadKg: null,
            restAfterSeconds: null,
            isWarmup: false,
          })),
        }),
      ),
    );

    expect(result.success).toBe(false);
  });
});

describe("validateUpdateSessionForm", () => {
  it("accepts valid update payload", () => {
    const result = validateUpdateSessionForm("2026-06-20", "Updated Session", phaseEntriesWith(makeEntry()));

    expect(result.success).toBe(true);
  });

  it("rejects empty name on update", () => {
    const result = validateUpdateSessionForm("2026-06-20", "   ", phaseEntriesWith(makeEntry()));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.name).toBeTruthy();
    }
  });
});

describe("isSessionEditable", () => {
  it("returns true for not_started session without started_at", () => {
    expect(isSessionEditable({ status: "not_started", started_at: null })).toBe(true);
  });

  it("returns false when started_at is set", () => {
    expect(isSessionEditable({ status: "not_started", started_at: "2026-06-10T12:00:00Z" })).toBe(false);
  });

  it("returns false when status is not not_started", () => {
    expect(isSessionEditable({ status: "in_progress", started_at: null })).toBe(false);
  });
});
