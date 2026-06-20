import { useCallback, useMemo, useState } from "react";
import ExerciseNavList from "@/components/guided-workout/ExerciseNavList";
import ExerciseNavMenu from "@/components/guided-workout/ExerciseNavMenu";
import GuidedExerciseView from "@/components/guided-workout/GuidedExerciseView";
import SessionEditList from "@/components/guided-workout/SessionEditList";
import SessionOverview from "@/components/guided-workout/SessionOverview";
import { sortByPhaseThenSortOrder } from "@/lib/guided-workout/phase-labels";
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

function removeSetLog(exercises: ClientSessionDetail["exercises"], sessionExerciseId: string, setNumber: number) {
  return exercises.map((exercise) => {
    if (exercise.id !== sessionExerciseId) {
      return exercise;
    }

    return {
      ...exercise,
      logs: exercise.logs.filter((log) => log.set_number !== setNumber),
    };
  });
}

export default function GuidedWorkoutHub({ initialSession }: GuidedWorkoutHubProps) {
  const [session, setSession] = useState(initialSession);
  const [mode, setMode] = useState<GuidedWorkoutMode>(() => resolveInitialMode(initialSession));
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [beginPending, setBeginPending] = useState(false);
  const [beginError, setBeginError] = useState<string | null>(null);

  const orderedExercises = useMemo(() => sortByPhaseThenSortOrder(session.exercises), [session.exercises]);

  const handleLogSaved = useCallback((setLog: SetLog) => {
    setSession((prev) => ({
      ...prev,
      exercises: mergeSetLog(prev.exercises, setLog),
    }));
  }, []);

  const handleLogDeleted = useCallback((sessionExerciseId: string, setNumber: number) => {
    setSession((prev) => ({
      ...prev,
      exercises: removeSetLog(prev.exercises, sessionExerciseId, setNumber),
    }));
  }, []);

  async function handleRestart() {
    const response = await fetch(`/api/client/sessions/${session.id}/restart`, { method: "POST" });
    const body = (await response.json()) as {
      session?: { started_at: string | null };
      error?: string;
      details?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(body.details?.message ?? body.error ?? `Failed to restart session (${response.status})`);
    }

    setSession((prev) => ({
      ...prev,
      started_at: body.session?.started_at ?? null,
      exercises: prev.exercises.map((exercise) => ({ ...exercise, logs: [] })),
    }));
    setExerciseIndex(0);
    setMode("overview");
  }

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
      <SessionEditList
        session={session}
        exercises={orderedExercises}
        onContinueWorkout={(index) => {
          setExerciseIndex(index);
          setMode("guided");
        }}
        onJumpToExercise={(index) => {
          setExerciseIndex(index);
          setMode("guided");
        }}
        onLogSaved={handleLogSaved}
        onLogDeleted={handleLogDeleted}
        onRestart={handleRestart}
      />
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
    <div className="lg:flex lg:min-h-[calc(100vh-4rem)] lg:items-stretch lg:gap-6">
      <aside className="hidden lg:flex lg:w-72 lg:shrink-0 xl:w-80">
        <div className="sticky top-8 flex max-h-[calc(100vh-4rem)] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <ExerciseNavList
            exercises={orderedExercises}
            exerciseIndex={exerciseIndex}
            onSelectExercise={setExerciseIndex}
            className="min-h-0 flex-1 p-4"
          />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
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
          onOpenMenu={() => {
            setMenuOpen(true);
          }}
          onPrev={() => {
            setExerciseIndex((index) => Math.max(0, index - 1));
          }}
          onNext={() => {
            setExerciseIndex((index) => Math.min(orderedExercises.length - 1, index + 1));
          }}
          onLogSaved={handleLogSaved}
          onLogDeleted={handleLogDeleted}
        />
      </div>

      <ExerciseNavMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        exercises={orderedExercises}
        exerciseIndex={exerciseIndex}
        onSelectExercise={setExerciseIndex}
      />
    </div>
  );
}
