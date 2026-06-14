import { useCallback, useMemo, useState } from "react";
import GuidedExerciseView from "@/components/guided-workout/GuidedExerciseView";
import SessionOverview from "@/components/guided-workout/SessionOverview";
import { resolveInitialMode, type GuidedWorkoutMode } from "@/lib/guided-workout/session-mode";
import type { ClientSessionDetail } from "@/lib/workout-sessions/service";
import type { SetLog } from "@/types";

interface GuidedWorkoutHubProps {
  initialSession: ClientSessionDetail;
}

function mergeSetLog(exercises: ClientSessionDetail["exercises"], setLog: SetLog) {
  return exercises.map((exercise) => {
    if (exercise.id !== setLog.session_exercise_id) {
      return exercise;
    }

    const existingIndex = exercise.logs.findIndex((log) => log.set_number === setLog.set_number);
    const logs =
      existingIndex === -1
        ? [...exercise.logs, setLog].sort((a, b) => a.set_number - b.set_number)
        : exercise.logs.map((log, index) => (index === existingIndex ? setLog : log));

    return { ...exercise, logs };
  });
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

  const handleLogSaved = useCallback((setLog: SetLog) => {
    setSession((prev) => ({
      ...prev,
      exercises: mergeSetLog(prev.exercises, setLog),
    }));
  }, []);

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

  if (orderedExercises.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-blue-100/60">No exercises in this session.</p>
        <a href="/client/plan" className="text-sm text-blue-100/70 hover:text-white">
          ← Calendar
        </a>
      </div>
    );
  }

  const currentExercise = orderedExercises[exerciseIndex] ?? orderedExercises[0];

  return (
    <GuidedExerciseView
      key={currentExercise.id}
      exercise={currentExercise}
      exerciseIndex={exerciseIndex}
      totalExercises={orderedExercises.length}
      startedAt={session.started_at}
      onBackToOverview={() => {
        setMode("overview");
      }}
      onBackToEditList={() => {
        setMode("edit-list");
      }}
      onPrev={() => {
        setExerciseIndex((index) => Math.max(0, index - 1));
      }}
      onNext={() => {
        setExerciseIndex((index) => Math.min(orderedExercises.length - 1, index + 1));
      }}
      onLogSaved={handleLogSaved}
    />
  );
}
