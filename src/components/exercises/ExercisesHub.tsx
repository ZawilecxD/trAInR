import { useMemo, useState } from "react";
import { Archive, Loader2, Pencil, Plus } from "lucide-react";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import ExerciseFavouriteButton from "@/components/exercises/ExerciseFavouriteButton";
import ExerciseFilters from "@/components/exercises/ExerciseFilters";
import ExerciseFormModal from "@/components/exercises/ExerciseFormModal";
import { Button } from "@/components/ui/button";
import type { ExerciseFilterState } from "@/lib/exercises/filter-url";
import { EXERCISE_METRIC_LABELS, EXERCISE_TYPE_LABELS } from "@/lib/exercises/labels";
import type { ExerciseWithMuscleGroups } from "@/lib/exercises/service";
import { errorBannerClass, successBannerClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { MuscleGroup } from "@/types";

interface ExercisesHubProps {
  initialExercises: ExerciseWithMuscleGroups[];
  muscleGroups: MuscleGroup[];
  initialFilters: ExerciseFilterState;
  hasActiveFilters: boolean;
  muscleGroupNameById: Record<string, string>;
}

type ModalMode = "create" | "edit" | null;

function formatMuscleGroups(
  exercise: ExerciseWithMuscleGroups,
  muscleGroupNameById: Record<string, string>,
): string {
  if (exercise.muscle_groups.length === 0) {
    return "—";
  }

  return exercise.muscle_groups
    .map((group) => {
      const name = muscleGroupNameById[group.muscle_group_id] ?? "Unknown";
      return `${name} (${group.role})`;
    })
    .join(", ");
}

async function fetchExercise(exerciseId: string): Promise<ExerciseWithMuscleGroups> {
  const response = await fetch(`/api/exercises/${exerciseId}`);
  if (!response.ok) {
    throw new Error("Failed to load exercise.");
  }

  const payload = (await response.json()) as { exercise: ExerciseWithMuscleGroups };
  return payload.exercise;
}

async function fetchExerciseList(search: string): Promise<ExerciseWithMuscleGroups[]> {
  const response = await fetch(`/api/exercises${search}`);
  if (!response.ok) {
    throw new Error("Failed to refresh exercises.");
  }

  const payload = (await response.json()) as { exercises: ExerciseWithMuscleGroups[] };
  return payload.exercises;
}

export default function ExercisesHub({
  initialExercises,
  muscleGroups,
  initialFilters,
  hasActiveFilters,
  muscleGroupNameById,
}: ExercisesHubProps) {
  const [exercises, setExercises] = useState(initialExercises);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editingExercise, setEditingExercise] = useState<ExerciseWithMuscleGroups | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ExerciseWithMuscleGroups | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  const sortedExercises = useMemo(
    () => [...exercises].sort((a, b) => a.name.localeCompare(b.name)),
    [exercises],
  );

  async function refreshExercises(message?: string) {
    const next = await fetchExerciseList(window.location.search);
    setExercises(next);
    if (message) {
      setFlashMessage(message);
    }
  }

  function openCreateModal() {
    setModalError(null);
    setEditingExerciseId(null);
    setEditingExercise(null);
    setModalMode("create");
  }

  async function openEditModal(exerciseId: string) {
    setModalError(null);
    setEditingExerciseId(exerciseId);
    setEditingExercise(null);
    setModalMode("edit");
    setLoadingEdit(true);

    try {
      const exercise = await fetchExercise(exerciseId);
      setEditingExercise(exercise);
    } catch {
      setModalError("Failed to load exercise. Please try again.");
      setModalMode(null);
      setEditingExerciseId(null);
    } finally {
      setLoadingEdit(false);
    }
  }

  function closeModal() {
    setModalMode(null);
    setEditingExerciseId(null);
    setEditingExercise(null);
    setModalError(null);
  }

  async function handleModalSuccess(message: string) {
    closeModal();
    try {
      await refreshExercises(message);
    } catch {
      setFlashMessage(message);
      setModalError("Exercise saved, but the list could not be refreshed.");
    }
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) {
      return;
    }

    setArchiving(true);
    setArchiveError(null);

    try {
      const response = await fetch(`/api/exercises/${archiveTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: true }),
      });
      if (!response.ok) {
        throw new Error("Failed to archive exercise.");
      }

      setArchiveTarget(null);
      await refreshExercises("Exercise archived.");
    } catch {
      setArchiveError("Failed to archive exercise. Please try again.");
    } finally {
      setArchiving(false);
    }
  }

  function renderActions(exercise: ExerciseWithMuscleGroups) {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-border hover:bg-accent text-foreground bg-transparent"
          disabled={loadingEdit && editingExerciseId === exercise.id}
          onClick={() => {
            void openEditModal(exercise.id);
          }}
        >
          {loadingEdit && editingExerciseId === exercise.id ? (
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
            setArchiveError(null);
            setArchiveTarget(exercise);
          }}
        >
          <Archive className="size-3.5" />
          Archive
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="headline-lg text-foreground">Exercise library</h1>
          <p className="text-muted-foreground mt-1 text-sm">Create, edit, and filter your trainer exercise catalog.</p>
        </div>
        <Button
          type="button"
          className="bg-primary hover:bg-primary/90 text-primary-foreground min-h-11 w-full sm:w-auto"
          onClick={openCreateModal}
        >
          <Plus className="size-4" />
          New exercise
        </Button>
      </div>

      {flashMessage ? <div className={successBannerClass}>{flashMessage}</div> : null}
      {modalError ? <div className={errorBannerClass}>{modalError}</div> : null}
      {archiveError ? <div className={errorBannerClass}>{archiveError}</div> : null}

      <ExerciseFilters muscleGroups={muscleGroups} initialFilters={initialFilters} />

      {sortedExercises.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="No exercises match your filters"
            description="Try clearing filters or adjusting your search."
          />
        ) : (
          <EmptyState
            title="No exercises yet"
            description="Create your first exercise to start building your library."
            action={
              <Button
                type="button"
                variant="outline"
                className="border-border hover:bg-accent bg-transparent"
                onClick={openCreateModal}
              >
                Create exercise
              </Button>
            }
          />
        )
      ) : (
        <>
          <div className="hidden md:block">
            <div className="border-border bg-card overflow-hidden rounded-2xl border">
              <div className="overflow-x-auto">
                <table className="text-foreground/90 min-w-full text-left text-sm">
                  <thead className="border-border bg-card text-muted-foreground border-b text-xs tracking-wide uppercase">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <span className="sr-only">Favourite</span>
                      </th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Metric</th>
                      <th className="px-4 py-3">Muscle groups</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedExercises.map((exercise) => (
                      <tr key={exercise.id} className="border-border/50 border-b last:border-b-0">
                        <td className="px-4 py-3">
                          <ExerciseFavouriteButton
                            exerciseId={exercise.id}
                            initialIsFavourite={exercise.is_favourite}
                          />
                        </td>
                        <td className="text-foreground px-4 py-3 font-medium">{exercise.name}</td>
                        <td className="px-4 py-3">{EXERCISE_TYPE_LABELS[exercise.exercise_type]}</td>
                        <td className="px-4 py-3">{EXERCISE_METRIC_LABELS[exercise.default_metric]}</td>
                        <td className="px-4 py-3">{formatMuscleGroups(exercise, muscleGroupNameById)}</td>
                        <td className="px-4 py-3">{renderActions(exercise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <ul className="space-y-3 md:hidden">
            {sortedExercises.map((exercise) => (
              <li key={exercise.id} className="border-border bg-card rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ExerciseFavouriteButton
                        exerciseId={exercise.id}
                        initialIsFavourite={exercise.is_favourite}
                      />
                      <p className="text-foreground truncate font-medium">{exercise.name}</p>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">
                      {EXERCISE_METRIC_LABELS[exercise.default_metric]}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatMuscleGroups(exercise, muscleGroupNameById)}
                    </p>
                  </div>
                  <span className="border-border bg-muted text-muted-foreground shrink-0 rounded-full border px-2.5 py-1 text-xs">
                    {EXERCISE_TYPE_LABELS[exercise.exercise_type]}
                  </span>
                </div>
                <div className="mt-4">{renderActions(exercise)}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ExerciseFormModal
        open={modalMode !== null}
        mode={modalMode === "edit" ? "edit" : "create"}
        loading={modalMode === "edit" && (loadingEdit || editingExercise === null)}
        exerciseId={editingExerciseId ?? undefined}
        initialExercise={
          editingExercise
            ? {
                name: editingExercise.name,
                exercise_type: editingExercise.exercise_type,
                default_metric: editingExercise.default_metric,
                notes: editingExercise.notes,
                video_url: editingExercise.video_url,
                is_favourite: editingExercise.is_favourite,
                muscle_groups: editingExercise.muscle_groups,
              }
            : undefined
        }
        muscleGroups={muscleGroups}
        onClose={closeModal}
        onSuccess={() => {
          void handleModalSuccess(
            modalMode === "create" ? "Exercise created successfully." : "Exercise updated successfully.",
          );
        }}
        onArchived={() => {
          void handleModalSuccess("Exercise archived.");
        }}
      />

      <DeleteConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null);
          }
        }}
        title="Archive exercise?"
        description={
          archiveTarget ? (
            <>
              <span className={cn("text-foreground font-medium")}>{archiveTarget.name}</span> will be hidden from the
              default exercise list.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Archive exercise"
        loading={archiving}
        onConfirm={() => {
          void handleArchiveConfirm();
        }}
      />
    </div>
  );
}
