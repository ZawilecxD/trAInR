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
    muscle_groups: { muscle_group_id: string; role: MuscleRole }[];
  };
}

interface ApiValidationIssue {
  path: string;
  message: string;
}

const inputClass =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:ring-2 focus:ring-purple-400 focus:outline-none";

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
          const payload = (await response.json()) as {
            error?: string;
            details?: { issues?: ApiValidationIssue[]; message?: string };
          };

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
        const payload = (await response.json()) as {
          error?: string;
          details?: { issues?: ApiValidationIssue[]; message?: string };
        };

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
        const payload = (await response.json()) as { details?: { message?: string } };
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
          <label htmlFor="name" className="mb-1 block text-sm text-blue-100/80">
            Name
          </label>
          <input
            id="name"
            value={values.name}
            onChange={(event) => {
              updateField("name", event.target.value);
            }}
            placeholder="e.g. Bench Press"
            className={cn(inputClass, errors.name && "border-red-400/60 focus:ring-red-400")}
          />
          {errors.name ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-300">
              <CircleAlert className="size-3" />
              {errors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="exercise_type" className="mb-1 block text-sm text-blue-100/80">
            Type
          </label>
          <select
            id="exercise_type"
            value={values.exercise_type}
            onChange={(event) => {
              updateField("exercise_type", event.target.value as ExerciseType);
            }}
            className={inputClass}
          >
            {(Object.keys(EXERCISE_TYPE_LABELS) as ExerciseType[]).map((type) => (
              <option key={type} value={type}>
                {EXERCISE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="default_metric" className="mb-1 block text-sm text-blue-100/80">
            Default metric
          </label>
          <select
            id="default_metric"
            value={values.default_metric}
            onChange={(event) => {
              updateField("default_metric", event.target.value as ExerciseMetric);
            }}
            className={inputClass}
          >
            {(Object.keys(EXERCISE_METRIC_LABELS) as ExerciseMetric[]).map((metric) => (
              <option key={metric} value={metric}>
                {EXERCISE_METRIC_LABELS[metric]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="video_url" className="mb-1 block text-sm text-blue-100/80">
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
            className={cn(inputClass, errors.video_url && "border-red-400/60 focus:ring-red-400")}
          />
          {errors.video_url ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-300">
              <CircleAlert className="size-3" />
              {errors.video_url}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm text-blue-100/80">
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
          className={inputClass}
        />
      </div>

      <div>
        <p className="mb-2 text-sm text-blue-100/80">Muscle groups</p>
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4">
          {muscleGroups.map((group) => {
            const selected = values.muscle_groups.find((item) => item.muscle_group_id === group.id);
            return (
              <div key={group.id} className="flex flex-wrap items-center gap-3">
                <label className="flex min-w-[160px] items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={Boolean(selected)}
                    onChange={() => {
                      toggleMuscleGroup(group.id);
                    }}
                    className="size-4 rounded border-white/20 bg-white/10"
                  />
                  {group.name}
                </label>
                {selected ? (
                  <select
                    value={selected.role}
                    onChange={(event) => {
                      updateMuscleRole(group.id, event.target.value as MuscleRole);
                    }}
                    className={cn(inputClass, "max-w-[160px]")}
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
          <p className="mt-1 flex items-center gap-1 text-xs text-red-300">
            <CircleAlert className="size-3" />
            {errors.muscle_groups}
          </p>
        ) : null}
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
          disabled={submitting || archiving}
          className="bg-purple-500 text-white hover:bg-purple-500/90"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {mode === "create" ? "Create exercise" : "Save changes"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="border-white/20 bg-transparent text-white hover:bg-white/10"
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
