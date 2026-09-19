import { ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ExerciseSparkline, WeeklyVolumeChart } from "@/components/exercise-stats/ExerciseCharts";
import type { ClientLoggedExercises } from "@/lib/exercise-stats/service";
import { errorBannerClass, surfaceCardClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { ExerciseMetric } from "@/types";

const metricLabels: Record<ExerciseMetric, string> = {
  reps_weight: "Reps & weight",
  time: "Time",
  distance: "Distance",
};

function formatLoggedAt(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

interface ClientExercisesHubProps {
  payload: ClientLoggedExercises | null;
  error: string | null;
}

export default function ClientExercisesHub({ payload, error }: ClientExercisesHubProps) {
  const exercises = payload?.exercises ?? [];
  const weekly = payload?.weekly ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="headline-lg text-foreground text-balance">Exercise stats</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Logged working sets across sessions. Open an exercise to see estimated 1RM, volume, and history.
        </p>
      </header>

      {error ? <div className={errorBannerClass}>Failed to load exercise stats: {error}</div> : null}

      {!error && exercises.length === 0 ? (
        <EmptyState
          title="No stats yet"
          description="Log a workout and your exercises will show up here with progress charts."
        />
      ) : null}

      {!error && exercises.length > 0 ? (
        <>
          <section className={cn(surfaceCardClass, "p-5")} aria-label="Weekly progress">
            <WeeklyVolumeChart weeks={weekly} />
          </section>

          <section className="space-y-3" aria-label="Exercises">
            <h2 className="label-caps text-muted-foreground">Exercises</h2>
            <ul className="space-y-2">
              {exercises.map((exercise) => (
                <li key={exercise.exerciseId}>
                  <a
                    href={`/client/exercises/${exercise.exerciseId}`}
                    className={cn(
                      surfaceCardClass,
                      "hover:border-primary/40 hover:bg-accent/40 flex min-h-11 items-center gap-3 px-4 py-3 transition-colors",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate font-medium">{exercise.name}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {metricLabels[exercise.defaultMetric]} · last logged {formatLoggedAt(exercise.lastLoggedAt)} ·{" "}
                        {exercise.sessionCount === 1 ? "1 session" : `${exercise.sessionCount} sessions`}
                      </p>
                    </div>
                    <ExerciseSparkline trend={exercise.trend} />
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
