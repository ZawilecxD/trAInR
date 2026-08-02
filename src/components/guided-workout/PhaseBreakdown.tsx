import { ChevronRight } from "lucide-react";
import { PHASE_ORDER, phaseLabel, sortByPhaseThenSortOrder } from "@/lib/guided-workout/phase-labels";
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

function countByPhase(exercises: SessionExerciseDetail[]): Map<ExercisePhase, number> {
  const counts = new Map<ExercisePhase, number>();
  for (const phase of PHASE_ORDER) {
    counts.set(phase, 0);
  }
  for (const exercise of sortByPhaseThenSortOrder(exercises)) {
    counts.set(exercise.phase, (counts.get(exercise.phase) ?? 0) + 1);
  }
  return counts;
}

export default function PhaseBreakdown({ exercises }: PhaseBreakdownProps) {
  const counts = countByPhase(exercises);

  return (
    <div className="space-y-2">
      {PHASE_ORDER.map((phase) => {
        const count = counts.get(phase) ?? 0;
        if (count === 0) {
          return null;
        }

        return (
          <div key={phase} className="border-border bg-card relative overflow-hidden rounded-[var(--radius-lg)] border">
            <span className={cn("absolute inset-y-0 left-0 w-1", PHASE_ACCENT[phase])} aria-hidden="true" />
            <div className="flex min-h-14 items-center justify-between gap-3 py-3 pr-4 pl-5">
              <div>
                <p className="text-foreground font-semibold capitalize">
                  {phase === "warm_up" ? "Warm-up" : phase === "cool_down" ? "Cooldown" : "Main"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {count} exercise{count === 1 ? "" : "s"}
                </p>
                <p className="text-text-soft sr-only">{phaseLabel(phase)}</p>
              </div>
              <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
