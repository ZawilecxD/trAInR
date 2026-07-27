import { Check } from "lucide-react";
import { PHASE_ORDER, phaseLabel } from "@/lib/guided-workout/phase-labels";
import { formatPrescribedSetDetail, formatSetActual } from "@/lib/guided-workout/format-prescription";
import {
  readoutStatusLabel,
  type ExerciseReadout,
  type ReadoutStatus,
  type SessionReadoutSummary,
} from "@/lib/trainer-dashboard/readout";
import { cn } from "@/lib/utils";
import type { ExercisePhase } from "@/types";

export function readoutBadgeClass(status: ReadoutStatus): string {
  switch (status) {
    case "fully_logged":
      return "border-success/40 bg-success/15 text-success";
    case "in_progress":
      return "border-warning/40 bg-warning/15 text-warning";
    case "not_logged":
      return "border-border bg-card text-muted-foreground";
  }
}

function groupExercisesByPhase(exercises: ExerciseReadout[]): Map<ExercisePhase, ExerciseReadout[]> {
  const groups = new Map<ExercisePhase, ExerciseReadout[]>();

  for (const phase of PHASE_ORDER) {
    groups.set(phase, []);
  }

  for (const exercise of exercises) {
    const bucket = groups.get(exercise.phase) ?? [];
    bucket.push(exercise);
    groups.set(exercise.phase, bucket);
  }

  return groups;
}

function ExerciseActualsCard({ exercise, notes }: { exercise: ExerciseReadout; notes: string | null }) {
  const showReps = exercise.defaultMetric !== "time";
  const showDuration = exercise.defaultMetric === "time";
  const showLoad = exercise.defaultMetric === "reps_weight";

  return (
    <article className="border-border bg-card rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium text-white">{exercise.exerciseName || "Exercise"}</h4>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {exercise.completedSets} of {exercise.totalSets} sets logged
          </p>
        </div>
        <span
          className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", readoutBadgeClass(exercise.status))}
        >
          {readoutStatusLabel(exercise.status)}
        </span>
      </div>

      {notes ? (
        <p className="border-border bg-card text-muted-foreground mt-3 rounded-lg border px-3 py-2 text-sm">{notes}</p>
      ) : null}

      {exercise.sets.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">No sets prescribed</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wide uppercase">
                <th className="px-2 py-2 font-medium">Set</th>
                <th className="px-2 py-2 font-medium">Prescribed</th>
                <th className="px-2 py-2 font-medium">Actual</th>
                {showReps ? <th className="px-2 py-2 text-center font-medium">Reps</th> : null}
                {showDuration ? <th className="px-2 py-2 text-center font-medium">Time</th> : null}
                {showLoad ? <th className="px-2 py-2 text-center font-medium">Load</th> : null}
                <th className="px-2 py-2 text-center font-mono text-xs font-medium tracking-wide">RPE</th>
                <th className="px-2 py-2 text-center font-medium">Done</th>
              </tr>
            </thead>
            <tbody>
              {exercise.sets.map((setReadout) => {
                const actualText = formatSetActual(setReadout.log, exercise.defaultMetric);
                const isUnlogged = actualText === "Not logged";

                return (
                  <tr key={setReadout.setNumber} className="border-border/50 border-b last:border-b-0">
                    <td className="px-2 py-2.5 font-medium text-white">Set {setReadout.setNumber}</td>
                    <td className="text-muted-foreground px-2 py-2.5">
                      {formatPrescribedSetDetail(setReadout.prescribed, exercise.defaultMetric)}
                    </td>
                    <td className={cn("px-2 py-2.5", isUnlogged ? "text-foreground/40 italic" : "text-white")}>
                      {actualText}
                    </td>
                    {showReps ? (
                      <td className="text-muted-foreground px-2 py-2.5 text-center">{setReadout.log?.reps ?? "—"}</td>
                    ) : null}
                    {showDuration ? (
                      <td className="text-muted-foreground px-2 py-2.5 text-center">
                        {setReadout.log?.duration_seconds !== null && setReadout.log?.duration_seconds !== undefined
                          ? `${setReadout.log.duration_seconds}s`
                          : "—"}
                      </td>
                    ) : null}
                    {showLoad ? (
                      <td className="text-muted-foreground px-2 py-2.5 text-center">
                        {setReadout.log?.load_kg ?? "—"}
                      </td>
                    ) : null}
                    <td className="text-muted-foreground px-2 py-2.5 text-center font-mono">
                      {setReadout.log?.rpe ?? "—"}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex justify-center">
                        <span
                          className={cn(
                            "inline-flex size-7 items-center justify-center rounded-md border",
                            setReadout.isComplete
                              ? "border-success/50 bg-success/20 text-success"
                              : "border-border bg-card text-foreground/30",
                          )}
                          aria-label={setReadout.isComplete ? "Set complete" : "Set incomplete"}
                        >
                          {setReadout.isComplete ? <Check className="size-4" aria-hidden="true" /> : null}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

interface SessionExerciseSummaryProps {
  readout: SessionReadoutSummary;
  notesByExerciseId?: Map<string, string | null>;
}

export default function SessionExerciseSummary({ readout, notesByExerciseId }: SessionExerciseSummaryProps) {
  const groups = groupExercisesByPhase(readout.exercises);

  if (readout.exercises.length === 0) {
    return (
      <div className="border-border bg-card rounded-2xl border p-8 text-center">
        <p className="text-muted-foreground text-sm">No exercises in this session.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {PHASE_ORDER.map((phase) => {
        const phaseExercises = groups.get(phase) ?? [];
        if (phaseExercises.length === 0) {
          return null;
        }

        return (
          <section key={phase} className="border-border bg-card rounded-2xl border p-4 backdrop-blur-xl">
            <h3 className="text-text-soft font-mono text-xs tracking-widest">{phaseLabel(phase)}</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {phaseExercises.length} exercise{phaseExercises.length === 1 ? "" : "s"}
            </p>
            <div className="mt-4 space-y-3">
              {phaseExercises.map((exercise) => (
                <ExerciseActualsCard
                  key={exercise.sessionExerciseId}
                  exercise={exercise}
                  notes={notesByExerciseId?.get(exercise.sessionExerciseId) ?? null}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
