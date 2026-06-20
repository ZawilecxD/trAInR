import type { SessionExerciseSet, SetLog } from "@/types";

interface ResolveLogIsWarmupInput {
  existingLog: SetLog | undefined;
  prescribedSet: SessionExerciseSet | undefined;
  isPrescribed: boolean;
}

export function resolveLogIsWarmup({ existingLog, prescribedSet, isPrescribed }: ResolveLogIsWarmupInput): boolean {
  if (existingLog) {
    return existingLog.is_warmup;
  }

  if (isPrescribed && prescribedSet) {
    return prescribedSet.is_warmup;
  }

  return false;
}
