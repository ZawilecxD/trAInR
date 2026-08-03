import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, CircleAlert, Loader2, Plus, Save, Trash2 } from "lucide-react";
import ExercisePickerModal from "@/components/session-templates/ExercisePickerModal";
import RoundWarmupToggle from "@/components/session-templates/RoundWarmupToggle";
import { Button } from "@/components/ui/button";
import type { ExerciseWithMuscleGroups } from "@/lib/exercises/service";
import type { SessionExerciseWithName } from "@/lib/workout-sessions/service";
import {
  addRound,
  emptyPhaseEntries,
  exerciseToFormEntry,
  removeRound,
  showsWarmupWorkingToggle,
  templateExercisesToPhaseEntries,
  updateRound,
  type PhaseEntries,
  type TemplateExerciseFormEntry,
} from "@/lib/session-templates/form-validation";
import {
  sessionExercisesToPhaseEntries,
  validateCreateSessionForm,
  validateUpdateSessionForm,
  type SessionFormFieldErrors,
} from "@/lib/workout-sessions/form-validation";
import type { TemplateExerciseWithName } from "@/lib/session-templates/service";
import { cn } from "@/lib/utils";
import {
  errorBannerCompactClass,
  formInputClass,
  formInputClassWithError,
  mobileStickyActionBarClass,
  surfaceCardClass,
} from "@/lib/ui-classes";
import type { ExercisePhase } from "@/types";

type SessionFormMode = "create" | "edit";

interface SessionFormProps {
  mode: SessionFormMode;
  clientId: string;
  sessionId?: string;
  initialScheduledDate: string;
  initialSourceTemplateId?: string | null;
  availableExercises: ExerciseWithMuscleGroups[];
  exerciseSource?: "template" | "session";
  initialSession?: {
    name: string;
    exercises: SessionExerciseWithName[] | TemplateExerciseWithName[];
  };
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

async function safeJsonParse(response: Response): Promise<ApiErrorPayload> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return {};
  }
}

function mapApiIssues(issues: ApiValidationIssue[]): SessionFormFieldErrors {
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

export default function SessionForm({
  mode,
  clientId,
  sessionId,
  initialScheduledDate,
  initialSourceTemplateId = null,
  availableExercises,
  exerciseSource = "template",
  initialSession,
}: SessionFormProps) {
  const initialPhaseEntries = useMemo(() => {
    if (!initialSession) {
      return emptyPhaseEntries();
    }

    if (exerciseSource === "session") {
      return sessionExercisesToPhaseEntries(initialSession.exercises as SessionExerciseWithName[]);
    }

    return templateExercisesToPhaseEntries(initialSession.exercises as TemplateExerciseWithName[]);
  }, [exerciseSource, initialSession]);

  const [name, setName] = useState(initialSession?.name ?? "Workout");
  const [scheduledDate, setScheduledDate] = useState(initialScheduledDate);
  const [phaseEntries, setPhaseEntries] = useState<PhaseEntries>(initialPhaseEntries);
  const [openPhases, setOpenPhases] = useState<Record<ExercisePhase, boolean>>({
    warm_up: true,
    main: true,
    cool_down: true,
  });
  const [pickerPhase, setPickerPhase] = useState<ExercisePhase | null>(null);
  const [errors, setErrors] = useState<SessionFormFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const planRedirectUrl = `/trainer/clients/${clientId}/plan?date=${encodeURIComponent(scheduledDate)}&assigned=1`;

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
    patch: Partial<TemplateExerciseFormEntry["rounds"][number]>,
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

  function totalExercises(): number {
    return phaseEntries.warm_up.length + phaseEntries.main.length + phaseEntries.cool_down.length;
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    if (totalExercises() === 0) {
      const confirmed = window.confirm("Save with no exercises? You can add them later by editing the session.");
      if (!confirmed) {
        return;
      }
    }

    if (mode === "create") {
      const validation = validateCreateSessionForm(
        clientId,
        scheduledDate,
        name,
        initialSourceTemplateId,
        phaseEntries,
      );
      if (!validation.success) {
        setErrors(validation.errors);
        return;
      }

      setSubmitting(true);
      try {
        const response = await fetch("/api/workout-sessions", {
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
          setErrors({ form: payload.details?.message ?? "Failed to create session." });
          return;
        }

        window.location.assign(planRedirectUrl);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!sessionId) {
      setErrors({ form: "Missing session id." });
      return;
    }

    const validation = validateUpdateSessionForm(scheduledDate, name, phaseEntries);
    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/workout-sessions/${sessionId}`, {
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
        setErrors({ form: payload.details?.message ?? "Failed to update session." });
        return;
      }

      window.location.assign(planRedirectUrl);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!sessionId) {
      return;
    }

    const confirmed = window.confirm("Delete this session? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setErrors({});

    try {
      const response = await fetch(`/api/workout-sessions/${sessionId}`, { method: "DELETE" });

      if (!response.ok) {
        const payload = await safeJsonParse(response);
        setErrors({ form: payload.details?.message ?? "Failed to delete session." });
        return;
      }

      window.location.assign(`/trainer/clients/${clientId}/plan?date=${encodeURIComponent(scheduledDate)}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <form className="space-y-6 pb-28 md:pb-0" onSubmit={handleSubmit} noValidate>
        <section className={cn(surfaceCardClass, "space-y-4 p-5")}>
          <p className="text-text-soft label-caps">Session details</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="session-name" className="text-muted-foreground mb-1 block text-sm">
                Session name
              </label>
              <input
                id="session-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setErrors((prev) => ({ ...prev, name: undefined, form: undefined }));
                }}
                placeholder="e.g. Upper body"
                className={formInputClassWithError(Boolean(errors.name))}
              />
              {errors.name ? (
                <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
                  <CircleAlert className="size-3" />
                  {errors.name}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="session-date" className="text-muted-foreground mb-1 block text-sm">
                Scheduled date
              </label>
              <input
                id="session-date"
                type="date"
                value={scheduledDate}
                onChange={(event) => {
                  setScheduledDate(event.target.value);
                  setErrors((prev) => ({ ...prev, scheduledDate: undefined, form: undefined }));
                }}
                className={formInputClassWithError(Boolean(errors.scheduledDate))}
              />
              {errors.scheduledDate ? (
                <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
                  <CircleAlert className="size-3" />
                  {errors.scheduledDate}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {PHASE_CONFIG.map(({ phase, label }) => {
            const entries = phaseEntries[phase];
            const isOpen = openPhases[phase];

            return (
              <section key={phase} className={surfaceCardClass}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between px-4 py-3 text-left"
                  onClick={() => {
                    setOpenPhases((prev) => ({ ...prev, [phase]: !prev[phase] }));
                  }}
                  aria-expanded={isOpen}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="text-primary label-caps">{label}</span>
                    <span className="text-muted-foreground data-mono text-sm">({entries.length})</span>
                  </span>
                  {isOpen ? (
                    <ChevronUp className="text-muted-foreground size-4" />
                  ) : (
                    <ChevronDown className="text-muted-foreground size-4" />
                  )}
                </button>

                {isOpen ? (
                  <div className="border-border space-y-3 border-t px-4 py-4">
                    {entries.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No exercises in this phase yet.</p>
                    ) : (
                      entries.map((entry, index) => (
                        <div
                          key={`${entry.exerciseId}-${index}`}
                          className="border-border bg-popover/40 rounded-[var(--radius)] border p-4"
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-foreground font-medium">{entry.exerciseName}</p>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-border hover:bg-accent text-foreground bg-transparent"
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
                                className="border-border hover:bg-accent text-foreground bg-transparent"
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
                                className="border-border text-destructive hover:bg-destructive/10 bg-transparent"
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
                            {(["reps", "duration"] as const).map((metricMode) => (
                              <button
                                key={metricMode}
                                type="button"
                                className={cn(
                                  "min-h-9 rounded-[var(--radius)] px-3 py-1 text-xs font-medium transition-colors",
                                  entry.metricMode === metricMode
                                    ? "bg-primary text-primary-foreground"
                                    : "border-border text-muted-foreground hover:bg-accent border",
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
                                className={cn(
                                  "rounded-[var(--radius)] border p-3",
                                  round.isWarmup ? "border-border bg-muted/40" : "border-border bg-card",
                                )}
                              >
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-text-soft label-caps">
                                    Round {roundIndex + 1}
                                    {round.isWarmup ? " · Warm-up" : ""}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    {showsWarmupWorkingToggle(phase) ? (
                                      <RoundWarmupToggle
                                        isWarmup={round.isWarmup}
                                        onChange={(isWarmup) => {
                                          updateExerciseRound(phase, index, roundIndex, { isWarmup });
                                        }}
                                      />
                                    ) : null}
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="border-border text-destructive hover:bg-destructive/10 bg-transparent"
                                      disabled={entry.rounds.length <= 1}
                                      onClick={() => {
                                        updateExerciseEntry(phase, index, removeRound(entry, roundIndex));
                                      }}
                                      aria-label={`Remove round ${roundIndex + 1}`}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                  {entry.metricMode === "reps" ? (
                                    <div>
                                      <label className="text-muted-foreground mb-1 block text-xs">Reps</label>
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
                                        className={formInputClass}
                                      />
                                    </div>
                                  ) : (
                                    <div>
                                      <label className="text-muted-foreground mb-1 block text-xs">Duration (s)</label>
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
                                        className={formInputClass}
                                      />
                                    </div>
                                  )}

                                  <div>
                                    <label className="text-muted-foreground mb-1 block text-xs">
                                      Load (kg, optional)
                                    </label>
                                    <input
                                      type="number"
                                      step="0.5"
                                      value={round.prescribedLoadKg ?? ""}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        updateExerciseRound(phase, index, roundIndex, {
                                          prescribedLoadKg: value === "" ? null : Number(value),
                                        });
                                      }}
                                      className={formInputClass}
                                    />
                                  </div>

                                  <div>
                                    <label className="text-muted-foreground mb-1 block text-xs">
                                      Rest (s, optional)
                                    </label>
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
                                      className={formInputClass}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-border hover:bg-accent text-foreground min-h-11 bg-transparent"
                              disabled={entry.rounds.length >= 20}
                              onClick={() => {
                                updateExerciseEntry(phase, index, addRound(entry));
                              }}
                            >
                              <Plus className="size-4" />
                              Add round
                            </Button>
                          </div>

                          <div className="mt-3">
                            <label className="text-muted-foreground mb-1 block text-xs">Notes (optional)</label>
                            <input
                              type="text"
                              value={entry.notes}
                              onChange={(event) => {
                                updateExerciseEntry(phase, index, { notes: event.target.value });
                              }}
                              className={formInputClass}
                            />
                          </div>
                        </div>
                      ))
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      className="border-border hover:bg-accent text-foreground min-h-11 w-full bg-transparent sm:w-auto"
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
          <p className={errorBannerCompactClass}>
            <CircleAlert className="size-4 shrink-0" />
            {errors.form}
          </p>
        ) : null}

        <div
          className={cn(
            mobileStickyActionBarClass,
            "flex flex-wrap gap-3 md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none",
          )}
        >
          <Button
            type="submit"
            disabled={submitting || deleting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground min-h-11 flex-1 md:flex-none"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {mode === "create" ? "Assign session" : "Save changes"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="border-border hover:bg-accent text-foreground min-h-11 bg-transparent"
            onClick={() => {
              window.location.assign(`/trainer/clients/${clientId}/plan?date=${encodeURIComponent(scheduledDate)}`);
            }}
          >
            Cancel
          </Button>

          {mode === "edit" ? (
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={submitting || deleting}
              onClick={() => {
                void handleDelete();
              }}
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete session
            </Button>
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
