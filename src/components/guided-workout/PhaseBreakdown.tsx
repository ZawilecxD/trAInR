import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { PHASE_ORDER, phaseLabel, sortByPhaseThenSortOrder } from "@/lib/guided-workout/phase-labels";
import { formatExercisePrescriptionDetail } from "@/lib/guided-workout/format-prescription";
import { cn } from "@/lib/utils";
import type { SessionExerciseDetail } from "@/lib/workout-sessions/service";
import type { ExercisePhase } from "@/types";

interface PhaseBreakdownProps {
  exercises: SessionExerciseDetail[];
}

const PHASE_ACCENT: Record<ExercisePhase, string> = {
  warm_up: "bg-warning",
  main: "bg-primary",
  cool_down: "bg-success",
};

const PHASE_TITLE: Record<ExercisePhase, string> = {
  warm_up: "Warm-up",
  main: "Main",
  cool_down: "Cooldown",
};

function groupExercisesByPhase(exercises: SessionExerciseDetail[]): Map<ExercisePhase, SessionExerciseDetail[]> {
  const groups = new Map<ExercisePhase, SessionExerciseDetail[]>();

  for (const phase of PHASE_ORDER) {
    groups.set(phase, []);
  }

  for (const exercise of sortByPhaseThenSortOrder(exercises)) {
    const bucket = groups.get(exercise.phase) ?? [];
    bucket.push(exercise);
    groups.set(exercise.phase, bucket);
  }

  return groups;
}

export default function PhaseBreakdown({ exercises }: PhaseBreakdownProps) {
  const groups = groupExercisesByPhase(exercises);
  const [expanded, setExpanded] = useState<Partial<Record<ExercisePhase, boolean>>>(() => {
    const initial: Partial<Record<ExercisePhase, boolean>> = {};
    for (const phase of PHASE_ORDER) {
      if ((groups.get(phase) ?? []).length > 0) {
        initial[phase] = true;
      }
    }
    return initial;
  });

  function togglePhase(phase: ExercisePhase) {
    setExpanded((prev) => ({ ...prev, [phase]: !prev[phase] }));
  }

  return (
    <div className="space-y-2">
      {PHASE_ORDER.map((phase) => {
        const phaseExercises = groups.get(phase) ?? [];
        if (phaseExercises.length === 0) {
          return null;
        }

        const isOpen = expanded[phase] === true;
        const count = phaseExercises.length;
        const panelId = `phase-breakdown-${phase}`;

        return (
          <div key={phase} className="border-border bg-card relative overflow-hidden rounded-[var(--radius-lg)] border">
            <span className={cn("absolute inset-y-0 left-0 w-1", PHASE_ACCENT[phase])} aria-hidden="true" />
            <button
              type="button"
              className="hover:bg-accent/40 flex min-h-14 w-full items-center justify-between gap-3 py-3 pr-4 pl-5 text-left transition-colors"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => {
                togglePhase(phase);
              }}
            >
              <div>
                <p className="text-foreground font-semibold">{PHASE_TITLE[phase]}</p>
                <p className="text-muted-foreground text-sm">
                  {count} exercise{count === 1 ? "" : "s"}
                </p>
                <p className="text-text-soft sr-only">{phaseLabel(phase)}</p>
              </div>
              {isOpen ? (
                <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              ) : (
                <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              )}
            </button>

            {isOpen ? (
              <ul id={panelId} className="border-border space-y-3 border-t px-5 py-3">
                {phaseExercises.map((exercise) => (
                  <li key={exercise.id}>
                    <p className="text-foreground text-sm font-medium">{exercise.exercise_name || "Exercise"}</p>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                      {formatExercisePrescriptionDetail(exercise.sets, exercise.exercise_default_metric)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
