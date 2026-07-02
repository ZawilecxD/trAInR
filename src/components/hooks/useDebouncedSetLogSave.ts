import { useCallback, useEffect, useRef, useState } from "react";
import { useRegisterSetLogFlush } from "@/components/hooks/useSetLogFlush";
import type { SetLog } from "@/types";

export type SetLogSaveStatus = "idle" | "saving" | "saved" | "error";

export interface SetLogValues {
  reps: number | null;
  duration_seconds: number | null;
  load_kg: number | null;
  rpe: number | null;
  is_complete: boolean;
  is_warmup: boolean;
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
  flush: () => Promise<boolean>;
} {
  const [status, setStatus] = useState<SetLogSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const skipNextSaveRef = useRef(true);
  const saveGenerationRef = useRef(0);
  // Pending = scheduled but not yet sent; inFlight = sent and awaiting response.
  // Both are consulted by flush() so navigation can force-complete a save.
  const pendingValuesRef = useRef<SetLogValues | null>(null);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const serializedValues = valuesKey(values);

  const saveNow = useCallback(
    async (valuesToSave: SetLogValues): Promise<boolean> => {
      const generation = ++saveGenerationRef.current;
      setStatus("saving");
      setError(null);

      const payload = {
        session_exercise_id: sessionExerciseId,
        set_number: setNumber,
        ...valuesToSave,
      };

      const promise = (async (): Promise<boolean> => {
        try {
          const response = await fetch("/api/client/set-logs", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const body = (await response.json()) as SaveResponse;

          if (generation !== saveGenerationRef.current) {
            return false;
          }

          if (!response.ok) {
            const message = body.details?.message ?? body.error ?? `Save failed (${response.status})`;
            setStatus("error");
            setError(message);
            return false;
          }

          if (body.set_log) {
            onSaved?.(body.set_log);
          }

          setStatus("saved");
          return true;
        } catch (err) {
          if (generation !== saveGenerationRef.current) {
            return false;
          }

          setStatus("error");
          setError(err instanceof Error ? err.message : "Save failed");
          return false;
        }
      })();

      inFlightRef.current = promise;
      const result = await promise;
      if (inFlightRef.current === promise) {
        inFlightRef.current = null;
      }
      return result;
    },
    [onSaved, sessionExerciseId, setNumber],
  );

  const retry = useCallback(() => {
    void saveNow(values);
  }, [saveNow, values]);

  const cancelPendingSave = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingValuesRef.current = null;
    saveGenerationRef.current += 1;
    skipNextSaveRef.current = true;
    setStatus("idle");
    setError(null);
  }, []);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const pending = pendingValuesRef.current;
    if (pending !== null) {
      pendingValuesRef.current = null;
      return saveNow(pending);
    }

    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    return true;
  }, [saveNow]);

  useRegisterSetLogFlush(`${sessionExerciseId}:${setNumber}`, flush);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    setStatus("idle");
    const valuesToSave = JSON.parse(serializedValues) as SetLogValues;
    pendingValuesRef.current = valuesToSave;
    const timer = window.setTimeout(() => {
      timerRef.current = null;
      pendingValuesRef.current = null;
      void saveNow(valuesToSave);
    }, debounceMs);
    timerRef.current = timer;

    return () => {
      window.clearTimeout(timer);
    };
  }, [debounceMs, saveNow, serializedValues]);

  return { status, error, retry, cancelPendingSave, flush };
}
