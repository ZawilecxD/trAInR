export type UserRole = "trainer" | "client";

export interface Profile {
  id: string;
  role: UserRole;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type TrainerClientStatus = "active" | "removed";

export interface TrainerClient {
  id: string;
  trainer_id: string;
  client_id: string;
  status: TrainerClientStatus;
  assigned_at: string;
  removed_at: string | null;
}

export interface InviteLink {
  id: string;
  trainer_id: string;
  token: string;
  expires_at: string | null;
  used_at: string | null;
  used_by_client_id: string | null;
  created_at: string;
}

/** Response shape from `validate_invite_token` RPC (S-03). */
export interface InviteValidation {
  valid: boolean;
  trainer_id: string | null;
  trainer_display_name: string | null;
}

export type ExerciseType = "strength" | "cardio" | "flexibility" | "other";
export type ExerciseMetric = "reps_weight" | "time" | "distance";

export interface Exercise {
  id: string;
  trainer_id: string;
  name: string;
  exercise_type: ExerciseType;
  default_metric: ExerciseMetric;
  notes: string | null;
  video_url: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export type MuscleRegion = "upper_body" | "lower_body" | "core" | "full_body";

export interface MuscleGroup {
  id: string;
  name: string;
  region: MuscleRegion;
}

export type MuscleRole = "primary" | "secondary";

export interface ExerciseMuscleGroup {
  exercise_id: string;
  muscle_group_id: string;
  role: MuscleRole;
}

export type ExercisePhase = "warm_up" | "main" | "cool_down";

export interface SessionTemplate {
  id: string;
  trainer_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  phase: ExercisePhase;
  sort_order: number;
  prescribed_sets: number;
  prescribed_reps: number | null;
  prescribed_duration_seconds: number | null;
  prescribed_load_kg: number | null;
  rest_after_seconds: number | null;
  notes: string | null;
}

export type ClientPlanStatus = "active" | "completed" | "archived";

export interface ClientPlan {
  id: string;
  trainer_id: string;
  client_id: string;
  name: string;
  status: ClientPlanStatus;
  start_date: string | null;
  created_at: string;
  updated_at: string;
}

export type SessionStatus = "not_started" | "finished" | "finished_partially";

export interface WorkoutSession {
  id: string;
  client_plan_id: string;
  source_template_id: string | null;
  scheduled_date: string;
  name: string | null;
  status: SessionStatus;
  started_at: string | null;
  completed_at: string | null;
  locked_at: string | null;
  created_at: string;
}

export interface SessionExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  phase: ExercisePhase;
  sort_order: number;
  prescribed_sets: number;
  prescribed_reps: number | null;
  prescribed_duration_seconds: number | null;
  prescribed_load_kg: number | null;
  rest_after_seconds: number | null;
  notes: string | null;
}

export interface SetLog {
  id: string;
  session_exercise_id: string;
  set_number: number;
  is_warmup: boolean;
  reps: number | null;
  duration_seconds: number | null;
  load_kg: number | null;
  logged_at: string;
}

export interface SessionComment {
  id: string;
  session_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string | null;
}
