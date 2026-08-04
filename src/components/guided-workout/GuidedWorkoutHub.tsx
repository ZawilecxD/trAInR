import { useCallback, useMemo, useRef, useState } from "react";
import ExerciseNavList from "@/components/guided-workout/ExerciseNavList";
import ExerciseNavMenu from "@/components/guided-workout/ExerciseNavMenu";
import GuidedExerciseView from "@/components/guided-workout/GuidedExerciseView";
import SessionCompletedView from "@/components/guided-workout/SessionCompletedView";
import SessionEditList from "@/components/guided-workout/SessionEditList";
import SessionOverview from "@/components/guided-workout/SessionOverview";
import { SetLogFlushContext, useSetLogFlushRegistry } from "@/components/hooks/useSetLogFlush";
import { sortByPhaseThenSortOrder } from "@/lib/guided-workout/phase-labels";
import { isSessionSealed } from "@/lib/guided-workout/edit-window";
import { resolveInitialMode, type GuidedWorkoutMode } from "@/lib/guided-workout/session-mode";
import type { ClientSessionDetail } from "@/lib/workout-sessions/service";
import type { SessionStatus, SetLog } from "@/types";

interface GuidedWorkoutHubProps {
  initialSession: ClientSessionDetail;
  currentUserId: string;
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

function isTerminalStatus(status: SessionStatus): boolean {
  return status === "finished" || status === "finished_partially" || status === "cancelled";
}

export default function GuidedWorkoutHub({ initialSession, currentUserId }: GuidedWorkoutHubProps) {
  const [session, setSession] = useState(initialSession);
  const [mode, setMode] = useState<GuidedWorkoutMode>(() => resolveInitialMode(initialSession));
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [beginPending, setBeginPending] = useState(false);
  const [beginError, setBeginError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const orderedExercises = useMemo(() => sortByPhaseThenSortOrder(session.exercises), [session.exercises]);
  const isSealed = isSessionSealed(session.locked_at);

  const setModeForSession = useCallback(
    (target: GuidedWorkoutMode) => {
      if (target === "overview" && isTerminalStatus(session.status)) {
        setMode("completed");
        return;
      }

      setMode(target);
    },
    [session.status],
  );

  const { register, unregister, flushAll } = useSetLogFlushRegistry();
  const flushRegistry = useMemo(() => ({ register, unregister }), [register, unregister]);

  // Gate every exercise-leaving transition on a completed flush of all mounted
  // set-log rows. Changing exerciseIndex/mode unmounts the rows and cancels their
  // pending debounce timers, so the flush MUST resolve before apply() runs. On a
  // failed flush we abort the transition and leave the user on the current
  // exercise, where the row's existing error/retry UI is already visible.
  const navigatingRef = useRef(false);
  const runGuardedTransition = useCallback(
    async (apply: () => void) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      setIsNavigating(true);
      try {
        const ok = await flushAll();
        if (ok) {
          apply();
        }
      } finally {
        navigatingRef.current = false;
        setIsNavigating(false);
      }
    },
    [flushAll],
  );

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
      locked_at: null,
      exercises: prev.exercises.map((exercise) => ({ ...exercise, logs: [] })),
    }));
    setExerciseIndex(0);
    setModeForSession("overview");
  }

  async function handleComplete(status: "finished" | "finished_partially" | "cancelled") {
    const flushed = await flushAll();
    if (!flushed) {
      throw new Error("Save pending set logs before completing the workout");
    }

    const response = await fetch(`/api/client/sessions/${session.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    const body = (await response.json()) as {
      session?: {
        status: SessionStatus;
        locked_at: string | null;
        completed_at: string | null;
      };
      error?: string;
      details?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(body.details?.message ?? body.error ?? `Failed to save session status (${response.status})`);
    }

    const updatedSession = body.session;
    const newStatus = updatedSession?.status ?? status;
    const lockedAt = updatedSession?.locked_at ?? null;

    setSession((prev) => ({
      ...prev,
      status: newStatus,
      locked_at: lockedAt,
      completed_at: updatedSession?.completed_at ?? prev.completed_at,
    }));

    setMode("completed");
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
      setModeForSession("guided");
    } catch (err) {
      setBeginError(err instanceof Error ? err.message : "Failed to start session");
    } finally {
      setBeginPending(false);
    }
  }

  if (mode === "completed") {
    return (
      <SessionCompletedView
        session={session}
        currentUserId={currentUserId}
        onEdit={() => {
          setMode("edit-list");
        }}
      />
    );
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
        currentUserId={currentUserId}
        onCancel={handleComplete.bind(null, "cancelled")}
      />
    );
  }

  if (mode === "edit-list") {
    return (
      <SetLogFlushContext.Provider value={flushRegistry}>
        <SessionEditList
          session={session}
          exercises={orderedExercises}
          currentUserId={currentUserId}
          readOnly={isSealed}
          onContinueWorkout={(index) => {
            setExerciseIndex(index);
            setModeForSession("guided");
          }}
          onJumpToExercise={(index) => {
            setExerciseIndex(index);
            setModeForSession("guided");
          }}
          onLogSaved={handleLogSaved}
          onLogDeleted={handleLogDeleted}
          onRestart={handleRestart}
          onComplete={handleComplete}
          onBackToSummary={() => {
            setMode("completed");
          }}
        />
      </SetLogFlushContext.Provider>
    );
  }

  if (orderedExercises.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">No exercises in this session.</p>
        <a href="/client/plan" className="text-muted-foreground hover:text-foreground text-sm">
          ← Calendar
        </a>
      </div>
    );
  }

  const currentExercise = orderedExercises[exerciseIndex] ?? orderedExercises[0];

  return (
    <SetLogFlushContext.Provider value={flushRegistry}>
      <div className="lg:flex lg:min-h-[calc(100vh-4rem)] lg:items-stretch lg:gap-6">
        <aside className="hidden lg:flex lg:w-72 lg:shrink-0 xl:w-80">
          <div className="border-border bg-card sticky top-8 flex max-h-[calc(100vh-4rem)] w-full flex-col overflow-hidden rounded-2xl border backdrop-blur-xl">
            <ExerciseNavList
              exercises={orderedExercises}
              exerciseIndex={exerciseIndex}
              onSelectExercise={(index) => {
                void runGuardedTransition(() => {
                  setExerciseIndex(index);
                });
              }}
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
            readOnly={isSealed}
            isNavigating={isNavigating}
            onBackToOverview={() => {
              void runGuardedTransition(() => {
                setModeForSession("overview");
              });
            }}
            onBackToEditList={() => {
              void runGuardedTransition(() => {
                setModeForSession("edit-list");
              });
            }}
            onOpenMenu={() => {
              setMenuOpen(true);
            }}
            onPrev={() => {
              void runGuardedTransition(() => {
                setExerciseIndex((index) => Math.max(0, index - 1));
              });
            }}
            onNext={() => {
              void runGuardedTransition(() => {
                setExerciseIndex((index) => Math.min(orderedExercises.length - 1, index + 1));
              });
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
          onSelectExercise={(index) => {
            void runGuardedTransition(() => {
              setExerciseIndex(index);
            });
          }}
        />
      </div>
    </SetLogFlushContext.Provider>
  );
}
