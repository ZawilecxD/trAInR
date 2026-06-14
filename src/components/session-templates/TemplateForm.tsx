import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, CircleAlert, Loader2, Plus, Save, Trash2, ArrowDown, ArrowUp } from "lucide-react";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import ExercisePickerModal from "@/components/session-templates/ExercisePickerModal";
import { Button } from "@/components/ui/button";
import {
  addRound,
  emptyPhaseEntries,
  exerciseToFormEntry,
  removeRound,
  templateExercisesToPhaseEntries,
  updateRound,
  validateCreateTemplateForm,
  validateUpdateTemplateForm,
  type MetricMode,
  type PhaseEntries,
  type TemplateExerciseFormEntry,
  type TemplateExerciseSetFormEntry,
  type TemplateFormFieldErrors,
} from "@/lib/session-templates/form-validation";
import type { TemplateExerciseWithName } from "@/lib/session-templates/service";
import type { ExerciseWithMuscleGroups } from "@/lib/exercises/service";
import { cn } from "@/lib/utils";
import type { ExercisePhase } from "@/types";

type TemplateFormMode = "create" | "edit";

interface TemplateFormProps {
  mode: TemplateFormMode;
  templateId?: string;
  availableExercises: ExerciseWithMuscleGroups[];
  initialTemplate?: {
    name: string;
    description: string | null;
    exercises: TemplateExerciseWithName[];
  };
  onSuccess?: () => void;
  onCancel?: () => void;
  onDeleted?: () => void;
}

interface ApiValidationIssue {
  path: string;
  message: string;
}

interface ApiErrorPayload {
  error?: string;
  details?: { issues?: ApiValidationIssue[]; message?: string };
}

const PHASE_CONFIG: { phase: ExercisePhase; label: string }[] = [
  { phase: "warm_up", label: "Warm-up" },
  { phase: "main", label: "Main" },
  { phase: "cool_down", label: "Cool-down" },
];

const inputClass =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:ring-2 focus:ring-purple-400 focus:outline-none";

async function safeJsonParse(response: Response): Promise<ApiErrorPayload> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return {};
  }
}

function mapApiIssues(issues: ApiValidationIssue[]): TemplateFormFieldErrors {
  const errors: TemplateFormFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path.split(".")[0];
    if (field === "name" || field === "description") {
      errors[field] = issue.message;
    } else {
      errors.form ??= issue.message;
    }
  }
  return errors;
}

function swapEntries(
  entries: TemplateExerciseFormEntry[],
  index: number,
  direction: "up" | "down",
): TemplateExerciseFormEntry[] {
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= entries.length) {
    return entries;
  }
  const next = [...entries];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

export default function TemplateForm({
  mode,
  templateId,
  availableExercises,
  initialTemplate,
  onSuccess,
  onCancel,
  onDeleted,
}: TemplateFormProps) {
  const initialPhaseEntries = useMemo(
    () => (initialTemplate ? templateExercisesToPhaseEntries(initialTemplate.exercises) : emptyPhaseEntries()),
    [initialTemplate],
  );

  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [description, setDescription] = useState(initialTemplate?.description ?? "");
  const [phaseEntries, setPhaseEntries] = useState<PhaseEntries>(initialPhaseEntries);
  const [openPhases, setOpenPhases] = useState<Record<ExercisePhase, boolean>>({
    warm_up: true,
    main: true,
    cool_down: true,
  });
  const [pickerPhase, setPickerPhase] = useState<ExercisePhase | null>(null);
  const [errors, setErrors] = useState<TemplateFormFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function updatePhaseEntries(phase: ExercisePhase, entries: TemplateExerciseFormEntry[]) {
    setPhaseEntries((prev) => ({ ...prev, [phase]: entries }));
    setErrors((prev) => ({ ...prev, form: undefined }));
  }

  function updateExerciseEntry(phase: ExercisePhase, index: number, patch: Partial<TemplateExerciseFormEntry>) {
    const entries = phaseEntries[phase].map((entry, entryIndex) =>
      entryIndex === index ? { ...entry, ...patch } : entry,
    );
    updatePhaseEntries(phase, entries);
  }

  function updateExerciseRound(
    phase: ExercisePhase,
    exerciseIndex: number,
    roundIndex: number,
    patch: Partial<TemplateExerciseSetFormEntry>,
  ) {
    const entry = phaseEntries[phase][exerciseIndex];
    updateExerciseEntry(phase, exerciseIndex, updateRound(entry, roundIndex, patch));
  }

  function removeExerciseEntry(phase: ExercisePhase, index: number) {
    updatePhaseEntries(
      phase,
      phaseEntries[phase].filter((_, entryIndex) => entryIndex !== index),
    );
  }

  function handlePickExercise(exercise: ExerciseWithMuscleGroups) {
    if (!pickerPhase) {
      return;
    }
    updatePhaseEntries(pickerPhase, [...phaseEntries[pickerPhase], exerciseToFormEntry(exercise, pickerPhase)]);
    setPickerPhase(null);
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    if (mode === "create") {
      const validation = validateCreateTemplateForm(name, description, phaseEntries);
      if (!validation.success) {
        setErrors(validation.errors);
        return;
      }

      setSubmitting(true);
      try {
        const response = await fetch("/api/session-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validation.data),
        });

        if (!response.ok) {
          const payload = await safeJsonParse(response);
          if (payload.error === "validation_error" && payload.details?.issues) {
            setErrors(mapApiIssues(payload.details.issues));
            return;
          }
          setErrors({ form: payload.details?.message ?? "Failed to create template." });
          return;
        }

        if (onSuccess) {
          onSuccess();
          return;
        }

        window.location.assign("/trainer/templates?created=1");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!templateId) {
      setErrors({ form: "Missing template id." });
      return;
    }

    const validation = validateUpdateTemplateForm(name, description, phaseEntries);
    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/session-templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      if (!response.ok) {
        const payload = await safeJsonParse(response);
        if (payload.error === "validation_error" && payload.details?.issues) {
          setErrors(mapApiIssues(payload.details.issues));
          return;
        }
        setErrors({ form: payload.details?.message ?? "Failed to update template." });
        return;
      }

      if (onSuccess) {
        onSuccess();
        return;
      }

      window.location.assign(`/trainer/templates/${templateId}?updated=1`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!templateId) {
      return;
    }

    setDeleting(true);
    setErrors({});

    try {
      const response = await fetch(`/api/session-templates/${templateId}`, { method: "DELETE" });

      if (!response.ok) {
        const payload = await safeJsonParse(response);
        setErrors({ form: payload.details?.message ?? "Failed to delete template." });
        return;
      }

      if (onDeleted) {
        onDeleted();
        return;
      }

      window.location.assign("/trainer/templates?deleted=1");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="template-name" className="mb-1 block text-sm text-blue-100/80">
              Name
            </label>
            <input
              id="template-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrors((prev) => ({ ...prev, name: undefined, form: undefined }));
              }}
              placeholder="e.g. Upper body strength"
              className={cn(inputClass, errors.name && "border-red-400/60 focus:ring-red-400")}
            />
            {errors.name ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-300">
                <CircleAlert className="size-3" />
                {errors.name}
              </p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="template-description" className="mb-1 block text-sm text-blue-100/80">
              Description (optional)
            </label>
            <textarea
              id="template-description"
              rows={2}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setErrors((prev) => ({ ...prev, description: undefined, form: undefined }));
              }}
              placeholder="Session focus, coaching notes..."
              className={cn(inputClass, errors.description && "border-red-400/60 focus:ring-red-400")}
            />
            {errors.description ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-300">
                <CircleAlert className="size-3" />
                {errors.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          {PHASE_CONFIG.map(({ phase, label }) => {
            const entries = phaseEntries[phase];
            const isOpen = openPhases[phase];

            return (
              <section key={phase} className="rounded-xl border border-white/10 bg-white/5">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  onClick={() => {
                    setOpenPhases((prev) => ({ ...prev, [phase]: !prev[phase] }));
                  }}
                  aria-expanded={isOpen}
                >
                  <span className="font-medium text-white">
                    {label}
                    <span className="ml-2 text-sm font-normal text-blue-100/60">({entries.length})</span>
                  </span>
                  {isOpen ? (
                    <ChevronUp className="size-4 text-blue-100/60" />
                  ) : (
                    <ChevronDown className="size-4 text-blue-100/60" />
                  )}
                </button>

                {isOpen ? (
                  <div className="space-y-3 border-t border-white/10 px-4 py-4">
                    {entries.length === 0 ? (
                      <p className="text-sm text-blue-100/60">No exercises in this phase yet.</p>
                    ) : (
                      entries.map((entry, index) => (
                        <div
                          key={`${entry.exerciseId}-${index}`}
                          className="rounded-lg border border-white/10 bg-white/5 p-4"
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-white">{entry.exerciseName}</p>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-white/20 bg-transparent text-white hover:bg-white/10"
                                disabled={index === 0}
                                onClick={() => {
                                  updatePhaseEntries(phase, swapEntries(entries, index, "up"));
                                }}
                                aria-label={`Move ${entry.exerciseName} up`}
                              >
                                <ArrowUp className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-white/20 bg-transparent text-white hover:bg-white/10"
                                disabled={index === entries.length - 1}
                                onClick={() => {
                                  updatePhaseEntries(phase, swapEntries(entries, index, "down"));
                                }}
                                aria-label={`Move ${entry.exerciseName} down`}
                              >
                                <ArrowDown className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-white/20 bg-transparent text-red-200 hover:bg-red-500/10"
                                onClick={() => {
                                  removeExerciseEntry(phase, index);
                                }}
                                aria-label={`Remove ${entry.exerciseName}`}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="mb-3 flex gap-2">
                            {(["reps", "duration"] as MetricMode[]).map((metricMode) => (
                              <button
                                key={metricMode}
                                type="button"
                                className={cn(
                                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                                  entry.metricMode === metricMode
                                    ? "bg-purple-500 text-white"
                                    : "border border-white/20 text-blue-100/80 hover:bg-white/10",
                                )}
                                onClick={() => {
                                  updateExerciseEntry(phase, index, {
                                    metricMode,
                                    rounds: entry.rounds.map((round) => ({
                                      ...round,
                                      prescribedReps: metricMode === "reps" ? (round.prescribedReps ?? 10) : null,
                                      prescribedDuration:
                                        metricMode === "duration" ? (round.prescribedDuration ?? 30) : null,
                                    })),
                                  });
                                }}
                              >
                                {metricMode === "reps" ? "Reps" : "Duration"}
                              </button>
                            ))}
                          </div>

                          <div className="space-y-2">
                            {entry.rounds.map((round, roundIndex) => (
                              <div
                                key={`${entry.exerciseId}-round-${roundIndex}`}
                                className="rounded-lg border border-white/10 bg-white/5 p-3"
                              >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <p className="text-xs font-medium text-blue-100/80">Round {roundIndex + 1}</p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-white/20 bg-transparent text-red-200 hover:bg-red-500/10"
                                    disabled={entry.rounds.length <= 1}
                                    onClick={() => {
                                      updateExerciseEntry(phase, index, removeRound(entry, roundIndex));
                                    }}
                                    aria-label={`Remove round ${roundIndex + 1}`}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                  {entry.metricMode === "reps" ? (
                                    <div>
                                      <label className="mb-1 block text-xs text-blue-100/70">Reps</label>
                                      <input
                                        type="number"
                                        min={1}
                                        value={round.prescribedReps ?? ""}
                                        onChange={(event) => {
                                          const value = event.target.value;
                                          updateExerciseRound(phase, index, roundIndex, {
                                            prescribedReps: value === "" ? null : Number(value),
                                          });
                                        }}
                                        className={inputClass}
                                      />
                                    </div>
                                  ) : (
                                    <div>
                                      <label className="mb-1 block text-xs text-blue-100/70">Duration (s)</label>
                                      <input
                                        type="number"
                                        min={1}
                                        value={round.prescribedDuration ?? ""}
                                        onChange={(event) => {
                                          const value = event.target.value;
                                          updateExerciseRound(phase, index, roundIndex, {
                                            prescribedDuration: value === "" ? null : Number(value),
                                          });
                                        }}
                                        className={inputClass}
                                      />
                                    </div>
                                  )}

                                  <div>
                                    <label className="mb-1 block text-xs text-blue-100/70">Load (kg, optional)</label>
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.5"
                                      value={round.prescribedLoadKg ?? ""}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        updateExerciseRound(phase, index, roundIndex, {
                                          prescribedLoadKg: value === "" ? null : Number(value),
                                        });
                                      }}
                                      className={inputClass}
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-1 block text-xs text-blue-100/70">Rest (s, optional)</label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={round.restAfterSeconds ?? ""}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        updateExerciseRound(phase, index, roundIndex, {
                                          restAfterSeconds: value === "" ? null : Number(value),
                                        });
                                      }}
                                      className={inputClass}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}

                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-white/20 bg-transparent text-white hover:bg-white/10"
                                disabled={entry.rounds.length >= 20}
                                onClick={() => {
                                  updateExerciseEntry(phase, index, addRound(entry));
                                }}
                              >
                                <Plus className="size-4" />
                                Add round
                              </Button>
                            </div>
                          </div>

                          <div className="mt-3">
                            <label className="mb-1 block text-xs text-blue-100/70">Notes (optional)</label>
                            <input
                              type="text"
                              value={entry.notes}
                              onChange={(event) => {
                                updateExerciseEntry(phase, index, { notes: event.target.value });
                              }}
                              className={inputClass}
                            />
                          </div>
                        </div>
                      ))
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/20 bg-transparent text-white hover:bg-white/10"
                      onClick={() => {
                        setPickerPhase(phase);
                      }}
                    >
                      <Plus className="size-4" />
                      Add exercise
                    </Button>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        {errors.form ? (
          <p className="flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <CircleAlert className="size-4 shrink-0" />
            {errors.form}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={submitting || deleting}
            className="bg-purple-500 text-white hover:bg-purple-500/90"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {mode === "create" ? "Create template" : "Save changes"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="border-white/20 bg-transparent text-white hover:bg-white/10"
            onClick={() => {
              if (onCancel) {
                onCancel();
                return;
              }
              window.location.assign("/trainer/templates");
            }}
          >
            Cancel
          </Button>

          {mode === "edit" ? (
            <DeleteConfirmDialog
              title="Delete template?"
              description="This template will be permanently removed. This cannot be undone."
              confirmLabel="Delete template"
              loading={deleting}
              onConfirm={handleDelete}
              trigger={
                <Button type="button" variant="destructive" disabled={submitting || deleting}>
                  {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  Delete template
                </Button>
              }
            />
          ) : null}
        </div>
      </form>

      <ExercisePickerModal
        open={pickerPhase !== null}
        onClose={() => {
          setPickerPhase(null);
        }}
        onPick={handlePickExercise}
        availableExercises={availableExercises}
      />
    </>
  );
}
