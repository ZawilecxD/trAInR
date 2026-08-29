import type { ExercisePhase } from "@/types";

const PHASE_RANK: Record<ExercisePhase, number> = {
  warm_up: 0,
  main: 1,
  cool_down: 2,
};

export function comparePhaseThenSortOrder(
  a: { phase: ExercisePhase; sort_order: number },
  b: { phase: ExercisePhase; sort_order: number },
): number {
  const phaseDiff = PHASE_RANK[a.phase] - PHASE_RANK[b.phase];
  if (phaseDiff !== 0) {
    return phaseDiff;
  }
  return a.sort_order - b.sort_order;
}

export const TRANSFER_PHASE_ORDER: ExercisePhase[] = ["warm_up", "main", "cool_down"];
