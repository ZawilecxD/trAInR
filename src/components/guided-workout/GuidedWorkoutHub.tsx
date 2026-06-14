import { useMemo, useState } from "react";
import SessionOverview from "@/components/guided-workout/SessionOverview";
import { resolveInitialMode, type GuidedWorkoutMode } from "@/lib/guided-workout/session-mode";
import { phaseLabel } from "@/lib/guided-workout/phase-labels";
import type { ClientSessionDetail } from "@/lib/workout-sessions/service";

interface GuidedWorkoutHubProps {
  initialSession: ClientSessionDetail;
}

export default function GuidedWorkoutHub({ initialSession }: GuidedWorkoutHubProps) {
  const [session, setSession] = useState(initialSession);
  const [mode, setMode] = useState<GuidedWorkoutMode>(() => resolveInitialMode(initialSession));
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [beginPending, setBeginPending] = useState(false);
  const [beginError, setBeginError] = useState<string | null>(null);

  const orderedExercises = useMemo(
    () => [...session.exercises].sort((a, b) => a.sort_order - b.sort_order),
    [session.exercises],
  );

  async function handleBegin() {
    setBeginPending(true);
    setBeginError(null);

    try {
      const response = await fetch(`/api/client/sessions/${session.id}/start`, { method: "POST" });
      const body = (await response.json()) as {
        session?: { started_at: string | null };
        error?: string;
        details?: { message?: string };
      };

      if (!response.ok) {
        const message = body.details?.message ?? body.error ?? `Failed to start session (${response.status})`;
        setBeginError(message);
        return;
      }

      const startedAt = body.session?.started_at ?? new Date().toISOString();
      setSession((prev) => ({ ...prev, started_at: startedAt }));
      setExerciseIndex(0);
      setMode("guided");
    } catch (err) {
      setBeginError(err instanceof Error ? err.message : "Failed to start session");
    } finally {
      setBeginPending(false);
    }
  }

  if (mode === "overview") {
    return (
      <SessionOverview
        session={session}
        beginPending={beginPending}
        beginError={beginError}
        onBegin={() => {
          void handleBegin();
        }}
      />
    );
  }

  if (mode === "edit-list") {
    return (
      <div className="space-y-4">
        <a href="/client/plan" className="text-sm text-blue-100/70 hover:text-white">
          ← Calendar
        </a>
        <h1 className="text-2xl font-bold text-white">{session.name ?? "Workout"}</h1>
        <p className="text-sm text-blue-100/70">Edit list view — full UI in Phase 4.</p>
        <ul className="space-y-2">
          {orderedExercises.map((exercise, index) => (
            <li key={exercise.id} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white">
              {exercise.exercise_name || "Exercise"}
              <button
                type="button"
                className="ml-3 text-sm text-blue-200 underline"
                onClick={() => {
                  setExerciseIndex(index);
                  setMode("guided");
                }}
              >
                Edit
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-blue-100/70">
          {exerciseIndex + 1} of {orderedExercises.length}
        </span>
        <button
          type="button"
          className="text-sm text-blue-100/70 hover:text-white"
          onClick={() => {
            setMode("edit-list");
          }}
        >
          All exercises
        </button>
      </div>

      {orderedExercises.length === 0 ? (
        <p className="text-sm text-blue-100/60">No exercises in this session.</p>
      ) : (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <p className="font-mono text-xs tracking-widest text-blue-200/80">
            {phaseLabel(orderedExercises[exerciseIndex].phase)}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            {orderedExercises[exerciseIndex].exercise_name || "Exercise"}
          </h2>
          <p className="mt-4 text-sm text-blue-100/60">Guided logging UI ships in Phase 3.</p>
        </section>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          className="min-h-11 flex-1 rounded-lg border border-white/20 bg-white/5 px-4 text-white disabled:opacity-40"
          disabled={exerciseIndex === 0}
          onClick={() => {
            setExerciseIndex((index) => Math.max(0, index - 1));
          }}
        >
          Prev
        </button>
        <button
          type="button"
          className="min-h-11 flex-1 rounded-lg border border-white/20 bg-white/5 px-4 text-white disabled:opacity-40"
          disabled={exerciseIndex >= orderedExercises.length - 1}
          onClick={() => {
            setExerciseIndex((index) => Math.min(orderedExercises.length - 1, index + 1));
          }}
        >
          {exerciseIndex >= orderedExercises.length - 1 ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
