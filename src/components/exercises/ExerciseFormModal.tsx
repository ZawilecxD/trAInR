import { Loader2, X } from "lucide-react";
import ExerciseForm from "@/components/exercises/ExerciseForm";
import { Button } from "@/components/ui/button";
import type { ExerciseWithMuscleGroups } from "@/lib/exercises/service";
import type { MuscleGroup } from "@/types";

interface ExerciseFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  loading?: boolean;
  exerciseId?: string;
  initialExercise?: {
    name: string;
    exercise_type: ExerciseWithMuscleGroups["exercise_type"];
    default_metric: ExerciseWithMuscleGroups["default_metric"];
    notes: string | null;
    video_url: string | null;
    is_favourite?: boolean;
    muscle_groups: ExerciseWithMuscleGroups["muscle_groups"];
  };
  muscleGroups: MuscleGroup[];
  onClose: () => void;
  onSuccess: () => void;
  onArchived: () => void;
}

export default function ExerciseFormModal({
  open,
  mode,
  loading = false,
  exerciseId,
  initialExercise,
  muscleGroups,
  onClose,
  onSuccess,
  onArchived,
}: ExerciseFormModalProps) {
  if (!open) {
    return null;
  }

  const title = mode === "create" ? "New exercise" : "Edit exercise";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="bg-background/70 absolute inset-0 backdrop-blur-sm"
        aria-label="Close exercise form"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-form-modal-title"
        className="border-border bg-popover relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border shadow-xl"
      >
        <div className="border-border flex items-center justify-between border-b px-5 py-4">
          <h2 id="exercise-form-modal-title" className="text-foreground text-lg font-semibold">
            {title}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-border hover:bg-accent text-foreground bg-transparent"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin" />
              <span className="ml-2 text-sm">Loading exercise…</span>
            </div>
          ) : (
            <ExerciseForm
              key={mode === "create" ? "create" : exerciseId}
              mode={mode}
              exerciseId={exerciseId}
              muscleGroups={muscleGroups}
              initialExercise={initialExercise}
              onSuccess={onSuccess}
              onCancel={onClose}
              onArchived={onArchived}
            />
          )}
        </div>
      </div>
    </div>
  );
}
