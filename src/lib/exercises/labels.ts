import type { ExerciseMetric, ExerciseType, MuscleRegion } from "@/types";

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  strength: "Strength",
  cardio: "Cardio",
  flexibility: "Flexibility",
  other: "Other",
};

export const EXERCISE_METRIC_LABELS: Record<ExerciseMetric, string> = {
  reps_weight: "Reps & weight",
  time: "Time",
  distance: "Distance",
};

export const MUSCLE_REGION_LABELS: Record<MuscleRegion, string> = {
  upper_body: "Upper body",
  lower_body: "Lower body",
  core: "Core",
  full_body: "Full body",
};
