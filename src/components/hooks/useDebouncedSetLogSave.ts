import { useCallback, useEffect, useRef, useState } from "react";
import type { SetLog } from "@/types";

export type SetLogSaveStatus = "idle" | "saving" | "saved" | "error";

export interface SetLogValues {
  reps: number | null;
  duration_seconds: number | null;
  load_kg: number | null;
  is_complete: boolean;
}

interface UseDebouncedSetLogSaveOptions {
  sessionExerciseId: string;
  setNumber: number;
  values: SetLogValues;
  debounceMs?: number;
  onSaved?: (setLog: SetLog) => void;
}

interface SaveResponse {
  set_log?: SetLog;
  error?: string;
  details?: { message?: string };
}

function valuesKey(values: SetLogValues): string {
  return JSON.stringify(values);
}

export function useDebouncedSetLogSave({
  sessionExerciseId,
  setNumber,
  values,
  debounceMs = 500,
  onSaved,
}: UseDebouncedSetLogSaveOptions): {
  status: SetLogSaveStatus;
  error: string | null;
  retry: () => void;
  cancelPendingSave: () => void;
} {
  const [status, setStatus] = useState<SetLogSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const skipNextSaveRef = useRef(true);
  const saveGenerationRef = useRef(0);
  const serializedValues = valuesKey(values);

  const saveNow = useCallback(
    async (valuesToSave: SetLogValues) => {
      const generation = ++saveGenerationRef.current;
      setStatus("saving");
      setError(null);

      const payload = {
        session_exercise_id: sessionExerciseId,
        set_number: setNumber,
        ...valuesToSave,
      };

      try {
        const response = await fetch("/api/client/set-logs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const body = (await response.json()) as SaveResponse;

        if (generation !== saveGenerationRef.current) {
          return;
        }

        if (!response.ok) {
          const message = body.details?.message ?? body.error ?? `Save failed (${response.status})`;
          setStatus("error");
          setError(message);
          return;
        }

        if (body.set_log) {
          onSaved?.(body.set_log);
        }

        setStatus("saved");
      } catch (err) {
        if (generation !== saveGenerationRef.current) {
          return;
        }

        setStatus("error");
        setError(err instanceof Error ? err.message : "Save failed");
      }
    },
    [onSaved, sessionExerciseId, setNumber],
  );

  const retry = useCallback(() => {
    void saveNow(values);
  }, [saveNow, values]);

  const cancelPendingSave = useCallback(() => {
    saveGenerationRef.current += 1;
    skipNextSaveRef.current = true;
    setStatus("idle");
    setError(null);
  }, []);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    setStatus("idle");
    const valuesToSave = JSON.parse(serializedValues) as SetLogValues;
    const timer = window.setTimeout(() => {
      void saveNow(valuesToSave);
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [debounceMs, saveNow, serializedValues]);

  return { status, error, retry, cancelPendingSave };
}
