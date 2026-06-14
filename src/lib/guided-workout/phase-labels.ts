import type { ExercisePhase } from "@/types";

const PHASE_LABELS: Record<ExercisePhase, string> = {
  warm_up: "WARM-UP",
  main: "MAIN PHASE",
  cool_down: "COOL-DOWN",
};

export function phaseLabel(phase: ExercisePhase): string {
  return PHASE_LABELS[phase];
}

export const PHASE_ORDER: ExercisePhase[] = ["warm_up", "main", "cool_down"];

export function compareByPhaseThenSortOrder<T extends { phase: ExercisePhase; sort_order: number }>(
  a: T,
  b: T,
): number {
  const phaseDiff = PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase);
  if (phaseDiff !== 0) {
    return phaseDiff;
  }

  return a.sort_order - b.sort_order;
}

export function sortByPhaseThenSortOrder<T extends { phase: ExercisePhase; sort_order: number }>(items: T[]): T[] {
  return [...items].sort(compareByPhaseThenSortOrder);
}
