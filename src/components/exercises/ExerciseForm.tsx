import { useMemo, useState } from "react";
import { Archive, CircleAlert, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  emptyExerciseFormValues,
  exerciseToFormValues,
  validateCreateForm,
  validateUpdateForm,
  type ExerciseFormValues,
  type FormFieldErrors,
} from "@/lib/exercises/form-validation";
import { EXERCISE_METRIC_LABELS, EXERCISE_TYPE_LABELS } from "@/lib/exercises/labels";
import { cn } from "@/lib/utils";
import { formInputClass, formInputClassWithError } from "@/lib/ui-classes";
import type { ExerciseMetric, ExerciseType, MuscleGroup, MuscleRole } from "@/types";

type ExerciseFormMode = "create" | "edit";

interface ExerciseFormProps {
  mode: ExerciseFormMode;
  muscleGroups: MuscleGroup[];
  exerciseId?: string;
  initialExercise?: {
    name: string;
    exercise_type: ExerciseType;
    default_metric: ExerciseMetric;
    notes: string | null;
    video_url: string | null;
    is_favourite?: boolean;
    muscle_groups: { muscle_group_id: string; role: MuscleRole }[];
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

async function safeJsonParse(response: Response): Promise<ApiErrorPayload> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return {};
  }
}

function mapApiIssues(issues: ApiValidationIssue[]): FormFieldErrors {
  const errors: FormFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path.split(".")[0];
    if (
      field === "name" ||
      field === "exercise_type" ||
      field === "default_metric" ||
      field === "notes" ||
      field === "video_url" ||
      field === "muscle_groups"
    ) {
      errors[field] = issue.message;
    } else {
      errors.form ??= issue.message;
    }
  }
  return errors;
}

export default function ExerciseForm({ mode, muscleGroups, exerciseId, initialExercise }: ExerciseFormProps) {
  const initialValues = useMemo(
    () => (initialExercise ? exerciseToFormValues(initialExercise) : emptyExerciseFormValues()),
    [initialExercise],
  );

  const [values, setValues] = useState<ExerciseFormValues>(initialValues);
  const [errors, setErrors] = useState<FormFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  function updateField<K extends keyof ExerciseFormValues>(field: K, value: ExerciseFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }));
  }

  function toggleMuscleGroup(muscleGroupId: string) {
    const existing = values.muscle_groups.find((group) => group.muscle_group_id === muscleGroupId);
    if (existing) {
      updateField(
        "muscle_groups",
        values.muscle_groups.filter((group) => group.muscle_group_id !== muscleGroupId),
      );
      return;
    }

    updateField("muscle_groups", [...values.muscle_groups, { muscle_group_id: muscleGroupId, role: "primary" }]);
  }

  function updateMuscleRole(muscleGroupId: string, role: MuscleRole) {
    updateField(
      "muscle_groups",
      values.muscle_groups.map((group) => (group.muscle_group_id === muscleGroupId ? { ...group, role } : group)),
    );
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    if (mode === "create") {
      const validation = validateCreateForm(values);
      if (!validation.success) {
        setErrors(validation.errors);
        return;
      }

      setSubmitting(true);
      try {
        const response = await fetch("/api/exercises", {
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

          setErrors({ form: payload.details?.message ?? "Failed to create exercise." });
          return;
        }

        window.location.assign("/trainer/exercises?created=1");
      } finally {
        setSubmitting(false);
      }

      return;
    }

    if (!exerciseId) {
      setErrors({ form: "Missing exercise id." });
      return;
    }

    const validation = validateUpdateForm(values, initialValues);
    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/exercises/${exerciseId}`, {
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

        setErrors({ form: payload.details?.message ?? "Failed to update exercise." });
        return;
      }

      window.location.assign("/trainer/exercises?updated=1");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive() {
    if (!exerciseId) return;

    const confirmed = window.confirm("Archive this exercise? It will be hidden from the default exercise list.");
    if (!confirmed) return;

    setArchiving(true);
    setErrors({});

    try {
      const response = await fetch(`/api/exercises/${exerciseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: true }),
      });

      if (!response.ok) {
        const payload = await safeJsonParse(response);
        setErrors({ form: payload.details?.message ?? "Failed to archive exercise." });
        return;
      }

      window.location.assign("/trainer/exercises?archived=1");
    } finally {
      setArchiving(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-muted-foreground mb-1 block text-sm">
            Name
          </label>
          <input
            id="name"
            value={values.name}
            onChange={(event) => {
              updateField("name", event.target.value);
            }}
            placeholder="e.g. Bench Press"
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
          <label htmlFor="exercise_type" className="text-muted-foreground mb-1 block text-sm">
            Type
          </label>
          <select
            id="exercise_type"
            value={values.exercise_type}
            onChange={(event) => {
              updateField("exercise_type", event.target.value as ExerciseType);
            }}
            className={formInputClass}
          >
            {(Object.keys(EXERCISE_TYPE_LABELS) as ExerciseType[]).map((type) => (
              <option key={type} value={type}>
                {EXERCISE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="default_metric" className="text-muted-foreground mb-1 block text-sm">
            Default metric
          </label>
          <select
            id="default_metric"
            value={values.default_metric}
            onChange={(event) => {
              updateField("default_metric", event.target.value as ExerciseMetric);
            }}
            className={formInputClass}
          >
            {(Object.keys(EXERCISE_METRIC_LABELS) as ExerciseMetric[]).map((metric) => (
              <option key={metric} value={metric}>
                {EXERCISE_METRIC_LABELS[metric]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="video_url" className="text-muted-foreground mb-1 block text-sm">
            Video URL (optional)
          </label>
          <input
            id="video_url"
            type="url"
            value={values.video_url}
            onChange={(event) => {
              updateField("video_url", event.target.value);
            }}
            placeholder="https://..."
            className={formInputClassWithError(Boolean(errors.video_url))}
          />
          {errors.video_url ? (
            <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
              <CircleAlert className="size-3" />
              {errors.video_url}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="text-muted-foreground mb-1 block text-sm">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          rows={3}
          value={values.notes}
          onChange={(event) => {
            updateField("notes", event.target.value);
          }}
          placeholder="Coaching cues, setup notes..."
          className={formInputClass}
        />
      </div>

      {mode === "edit" ? (
        <div>
          <label className="text-foreground flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.is_favourite}
              onChange={(event) => {
                updateField("is_favourite", event.target.checked);
              }}
              className="border-border bg-muted size-4 rounded"
            />
            Mark as favourite
          </label>
          <p className="text-muted-foreground mt-1 text-xs">Favourites appear when filtering exercise lists.</p>
        </div>
      ) : null}

      <div>
        <p className="text-muted-foreground mb-2 text-sm">Muscle groups</p>
        <div className="border-border bg-card space-y-2 rounded-xl border p-4">
          {muscleGroups.map((group) => {
            const selected = values.muscle_groups.find((item) => item.muscle_group_id === group.id);
            return (
              <div key={group.id} className="flex flex-wrap items-center gap-3">
                <label className="text-foreground flex min-w-[160px] items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(selected)}
                    onChange={() => {
                      toggleMuscleGroup(group.id);
                    }}
                    className="border-border bg-muted size-4 rounded"
                  />
                  {group.name}
                </label>
                {selected ? (
                  <select
                    value={selected.role}
                    onChange={(event) => {
                      updateMuscleRole(group.id, event.target.value as MuscleRole);
                    }}
                    className={cn(formInputClass, "max-w-[160px]")}
                    aria-label={`Role for ${group.name}`}
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                  </select>
                ) : null}
              </div>
            );
          })}
        </div>
        {errors.muscle_groups ? (
          <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
            <CircleAlert className="size-3" />
            {errors.muscle_groups}
          </p>
        ) : null}
      </div>

      {errors.form ? (
        <p className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <CircleAlert className="size-4 shrink-0" />
          {errors.form}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={submitting || archiving}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {mode === "create" ? "Create exercise" : "Save changes"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="border-border hover:bg-accent text-foreground bg-transparent"
          onClick={() => {
            window.location.assign("/trainer/exercises");
          }}
        >
          Cancel
        </Button>

        {mode === "edit" ? (
          <Button
            type="button"
            variant="destructive"
            disabled={submitting || archiving}
            onClick={() => {
              void handleArchive();
            }}
          >
            {archiving ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
            Archive exercise
          </Button>
        ) : null}
      </div>
    </form>
  );
}
