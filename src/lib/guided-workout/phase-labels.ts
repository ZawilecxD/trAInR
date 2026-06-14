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
