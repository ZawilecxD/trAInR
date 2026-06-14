import { Loader2, X } from "lucide-react";
import TemplateForm from "@/components/session-templates/TemplateForm";
import { Button } from "@/components/ui/button";
import type { TemplateWithExercises } from "@/lib/session-templates/service";
import type { ExerciseWithMuscleGroups } from "@/lib/exercises/service";

interface TemplateFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  loading?: boolean;
  templateId?: string;
  initialTemplate?: {
    name: string;
    description: string | null;
    exercises: TemplateWithExercises["exercises"];
  };
  availableExercises: ExerciseWithMuscleGroups[];
  onClose: () => void;
  onSuccess: () => void;
  onDeleted: () => void;
}

export default function TemplateFormModal({
  open,
  mode,
  loading = false,
  templateId,
  initialTemplate,
  availableExercises,
  onClose,
  onSuccess,
  onDeleted,
}: TemplateFormModalProps) {
  if (!open) {
    return null;
  }

  const title = mode === "create" ? "New template" : "Edit template";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        aria-label="Close template form"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-form-modal-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 id="template-form-modal-title" className="text-lg font-semibold text-white">
            {title}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/20 bg-transparent text-white hover:bg-white/10"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-blue-100/70">
              <Loader2 className="size-6 animate-spin" />
              <span className="ml-2 text-sm">Loading template…</span>
            </div>
          ) : (
            <TemplateForm
              key={mode === "create" ? "create" : templateId}
              mode={mode}
              templateId={templateId}
              availableExercises={availableExercises}
              initialTemplate={initialTemplate}
              onSuccess={onSuccess}
              onCancel={onClose}
              onDeleted={onDeleted}
            />
          )}
        </div>
      </div>
    </div>
  );
}
