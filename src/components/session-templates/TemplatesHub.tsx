import { useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import TemplateFilters from "@/components/session-templates/TemplateFilters";
import TemplateFormModal from "@/components/session-templates/TemplateFormModal";
import { Button } from "@/components/ui/button";
import type { TemplateFilterState } from "@/lib/session-templates/filter-url";
import { TEMPLATE_PHASE_LABELS } from "@/lib/session-templates/labels";
import type { SessionTemplateSummary, TemplateWithExercises } from "@/lib/session-templates/service";
import type { ExerciseWithMuscleGroups } from "@/lib/exercises/service";
import { errorBannerClass, successBannerClass } from "@/lib/ui-classes";

interface TemplatesHubProps {
  initialTemplates: SessionTemplateSummary[];
  availableExercises: ExerciseWithMuscleGroups[];
  initialFilters: TemplateFilterState;
  hasActiveFilters: boolean;
}

type ModalMode = "create" | "edit" | null;

function formatUpdatedAt(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function fetchTemplate(templateId: string): Promise<TemplateWithExercises> {
  const response = await fetch(`/api/session-templates/${templateId}`);
  if (!response.ok) {
    throw new Error("Failed to load template.");
  }

  const payload = (await response.json()) as { template: TemplateWithExercises };
  return payload.template;
}

async function fetchTemplateSummaries(): Promise<SessionTemplateSummary[]> {
  const response = await fetch("/api/session-templates");
  if (!response.ok) {
    throw new Error("Failed to refresh templates.");
  }

  const payload = (await response.json()) as { templates: SessionTemplateSummary[] };
  return payload.templates;
}

export default function TemplatesHub({
  initialTemplates,
  availableExercises,
  initialFilters,
  hasActiveFilters,
}: TemplatesHubProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithExercises | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SessionTemplateSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [templates],
  );

  async function refreshTemplates(message?: string) {
    const nextTemplates = await fetchTemplateSummaries();
    setTemplates(nextTemplates);
    if (message) {
      setFlashMessage(message);
    }
  }

  function openCreateModal() {
    setModalError(null);
    setEditingTemplateId(null);
    setEditingTemplate(null);
    setModalMode("create");
  }

  async function openEditModal(templateId: string) {
    setModalError(null);
    setEditingTemplateId(templateId);
    setEditingTemplate(null);
    setModalMode("edit");
    setLoadingEdit(true);

    try {
      const template = await fetchTemplate(templateId);
      setEditingTemplate(template);
    } catch {
      setModalError("Failed to load template. Please try again.");
      setModalMode(null);
      setEditingTemplateId(null);
    } finally {
      setLoadingEdit(false);
    }
  }

  function closeModal() {
    setModalMode(null);
    setEditingTemplateId(null);
    setEditingTemplate(null);
    setModalError(null);
  }

  async function handleModalSuccess(message: string) {
    closeModal();
    try {
      await refreshTemplates(message);
    } catch {
      setFlashMessage(message);
      setModalError("Template saved, but the list could not be refreshed.");
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/session-templates/${deleteTarget.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete template.");
      }

      setDeleteTarget(null);
      await refreshTemplates("Template deleted.");
    } catch {
      setDeleteError("Failed to delete template. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="headline-lg text-foreground">Session templates</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Build reusable session blueprints with warm-up, main, and cool-down phases.
          </p>
        </div>
        <Button
          type="button"
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={openCreateModal}
        >
          <Plus className="size-4" />
          New template
        </Button>
      </div>

      {flashMessage ? <div className={successBannerClass}>{flashMessage}</div> : null}

      {modalError ? <div className={errorBannerClass}>{modalError}</div> : null}

      {deleteError ? <div className={errorBannerClass}>{deleteError}</div> : null}

      <TemplateFilters initialFilters={initialFilters} />

      {sortedTemplates.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="No templates match your filters"
            description="Try clearing filters or adjusting your search."
          />
        ) : (
          <EmptyState
            title="No templates yet"
            description="Create your first template to reuse session structures across clients."
            action={
              <Button
                type="button"
                variant="outline"
                className="border-border hover:bg-accent bg-transparent"
                onClick={openCreateModal}
              >
                Create template
              </Button>
            }
          />
        )
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-2xl border">
          <div className="overflow-x-auto">
            <table className="text-foreground/90 min-w-full text-left text-sm">
              <thead className="border-border bg-card text-muted-foreground border-b text-xs tracking-wide uppercase">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Exercises</th>
                  <th className="px-4 py-3">Phases</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedTemplates.map((template) => (
                  <tr key={template.id} className="border-border/50 border-b last:border-b-0">
                    <td className="text-foreground px-4 py-3 font-medium">{template.name}</td>
                    <td className="max-w-xs truncate px-4 py-3">{template.description ?? "—"}</td>
                    <td className="px-4 py-3">{template.exercise_count}</td>
                    <td className="px-4 py-3">
                      {template.phases.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {template.phases.map((phase) => (
                            <span
                              key={phase}
                              className="border-border bg-card text-muted-foreground rounded-full border px-2 py-0.5 text-xs"
                            >
                              {TEMPLATE_PHASE_LABELS[phase]}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatUpdatedAt(template.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-border hover:bg-accent text-foreground bg-transparent"
                          disabled={loadingEdit && editingTemplateId === template.id}
                          onClick={() => {
                            void openEditModal(template.id);
                          }}
                        >
                          {loadingEdit && editingTemplateId === template.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Pencil className="size-3.5" />
                          )}
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-border text-destructive hover:bg-destructive/10 bg-transparent"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(template);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <TemplateFormModal
        open={modalMode !== null}
        mode={modalMode === "edit" ? "edit" : "create"}
        loading={modalMode === "edit" && (loadingEdit || editingTemplate === null)}
        templateId={editingTemplateId ?? undefined}
        initialTemplate={
          editingTemplate
            ? {
                name: editingTemplate.name,
                description: editingTemplate.description,
                exercises: editingTemplate.exercises,
              }
            : undefined
        }
        availableExercises={availableExercises}
        onClose={closeModal}
        onSuccess={() => {
          void handleModalSuccess(
            modalMode === "create" ? "Template created successfully." : "Template updated successfully.",
          );
        }}
        onDeleted={() => {
          void handleModalSuccess("Template deleted.");
        }}
      />

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title="Delete template?"
        description={
          deleteTarget ? (
            <>
              <span className="text-foreground font-medium">{deleteTarget.name}</span> will be permanently removed. This
              cannot be undone.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Delete template"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
