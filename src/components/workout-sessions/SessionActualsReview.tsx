import { Check } from "lucide-react";
import SessionCommentsPanel from "@/components/session-comments/SessionCommentsPanel";
import { PHASE_ORDER, phaseLabel } from "@/lib/guided-workout/phase-labels";
import { formatPrescribedSetDetail, formatSetActual } from "@/lib/guided-workout/format-prescription";
import { formatSessionOverviewDate } from "@/lib/guided-workout/format-session-date";
import { readoutStatusLabel, type ExerciseReadout, type ReadoutStatus } from "@/lib/trainer-dashboard/readout";
import type { TrainerSessionDetail } from "@/lib/workout-sessions/service";
import { cn } from "@/lib/utils";
import type { ExercisePhase } from "@/types";

interface SessionActualsReviewProps {
  session: TrainerSessionDetail;
  currentUserId: string;
}

function readoutBadgeClass(status: ReadoutStatus): string {
  switch (status) {
    case "fully_logged":
      return "border-emerald-400/40 bg-emerald-500/15 text-emerald-200";
    case "in_progress":
      return "border-amber-400/40 bg-amber-500/15 text-amber-100";
    case "not_logged":
      return "border-white/15 bg-white/5 text-blue-100/70";
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
    <article className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium text-white">{exercise.exerciseName || "Exercise"}</h4>
          <p className="mt-0.5 text-xs text-blue-100/60">
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
        <p className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-100/80">{notes}</p>
      ) : null}

      {exercise.sets.length === 0 ? (
        <p className="mt-3 text-sm text-blue-100/60">No sets prescribed</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs tracking-wide text-blue-100/60 uppercase">
                <th className="px-2 py-2 font-medium">Set</th>
                <th className="px-2 py-2 font-medium">Prescribed</th>
                <th className="px-2 py-2 font-medium">Actual</th>
                {showReps ? <th className="px-2 py-2 text-center font-medium">Reps</th> : null}
                {showDuration ? <th className="px-2 py-2 text-center font-medium">Time</th> : null}
                {showLoad ? <th className="px-2 py-2 text-center font-medium">Load</th> : null}
                <th className="px-2 py-2 text-center font-medium">Done</th>
              </tr>
            </thead>
            <tbody>
              {exercise.sets.map((setReadout) => {
                const actualText = formatSetActual(setReadout.log, exercise.defaultMetric);
                const isUnlogged = actualText === "Not logged";

                return (
                  <tr key={setReadout.setNumber} className="border-b border-white/5 last:border-b-0">
                    <td className="px-2 py-2.5 font-medium text-white">Set {setReadout.setNumber}</td>
                    <td className="px-2 py-2.5 text-blue-100/80">
                      {formatPrescribedSetDetail(setReadout.prescribed, exercise.defaultMetric)}
                    </td>
                    <td className={cn("px-2 py-2.5", isUnlogged ? "text-blue-100/40 italic" : "text-white")}>
                      {actualText}
                    </td>
                    {showReps ? (
                      <td className="px-2 py-2.5 text-center text-blue-100/80">{setReadout.log?.reps ?? "—"}</td>
                    ) : null}
                    {showDuration ? (
                      <td className="px-2 py-2.5 text-center text-blue-100/80">
                        {setReadout.log?.duration_seconds !== null && setReadout.log?.duration_seconds !== undefined
                          ? `${setReadout.log.duration_seconds}s`
                          : "—"}
                      </td>
                    ) : null}
                    {showLoad ? (
                      <td className="px-2 py-2.5 text-center text-blue-100/80">{setReadout.log?.load_kg ?? "—"}</td>
                    ) : null}
                    <td className="px-2 py-2.5">
                      <div className="flex justify-center">
                        <span
                          className={cn(
                            "inline-flex size-7 items-center justify-center rounded-md border",
                            setReadout.isComplete
                              ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                              : "border-white/10 bg-white/5 text-blue-100/30",
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

export default function SessionActualsReview({ session, currentUserId }: SessionActualsReviewProps) {
  const groups = groupExercisesByPhase(session.readout.exercises);
  const notesByExerciseId = new Map(session.exercises.map((exercise) => [exercise.id, exercise.notes]));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-blue-100/60">Client</dt>
            <dd className="mt-0.5 font-medium text-white">{session.client_display_name}</dd>
          </div>
          <div>
            <dt className="text-blue-100/60">Scheduled</dt>
            <dd className="mt-0.5 font-medium text-white">{formatSessionOverviewDate(session.scheduled_date)}</dd>
          </div>
          <div>
            <dt className="text-blue-100/60">Logging status</dt>
            <dd className="mt-0.5">
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  readoutBadgeClass(session.readout.status),
                )}
              >
                {session.readout.statusLabel}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-blue-100/60">Sets logged</dt>
            <dd className="mt-0.5 font-medium text-white">
              {session.readout.completedSets} of {session.readout.totalSets}
            </dd>
          </div>
        </dl>
      </section>

      {session.readout.exercises.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-sm text-blue-100/70">No exercises in this session.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {PHASE_ORDER.map((phase) => {
            const phaseExercises = groups.get(phase) ?? [];
            if (phaseExercises.length === 0) {
              return null;
            }

            return (
              <section key={phase} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                <h3 className="font-mono text-xs tracking-widest text-blue-200/80">{phaseLabel(phase)}</h3>
                <p className="mt-1 text-sm text-blue-100/60">
                  {phaseExercises.length} exercise{phaseExercises.length === 1 ? "" : "s"}
                </p>
                <div className="mt-4 space-y-3">
                  {phaseExercises.map((exercise) => (
                    <ExerciseActualsCard
                      key={exercise.sessionExerciseId}
                      exercise={exercise}
                      notes={notesByExerciseId.get(exercise.sessionExerciseId) ?? null}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <SessionCommentsPanel sessionId={session.id} currentUserId={currentUserId} />
    </div>
  );
}
