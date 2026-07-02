import { ClipboardPaste, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { useDebouncedSetLogSave, type SetLogValues } from "@/components/hooks/useDebouncedSetLogSave";
import RoundWarmupToggle from "@/components/session-templates/RoundWarmupToggle";
import { Input } from "@/components/ui/input";
import { fillValuesFromPrescription } from "@/lib/guided-workout/fill-from-prescription";
import { isSetLogged, isSetValuesLogged } from "@/lib/guided-workout/set-logged";
import { resolveLogIsWarmup } from "@/lib/guided-workout/warmup-default";
import { cn } from "@/lib/utils";
import type { ExerciseMetric, SessionExerciseSet, SetLog } from "@/types";

interface SetLogRowProps {
  sessionExerciseId: string;
  setNumber: number;
  existingLog: SetLog | undefined;
  prescribedSet: SessionExerciseSet | undefined;
  defaultMetric: ExerciseMetric;
  isPrescribed: boolean;
  isActive: boolean;
  readOnly?: boolean;
  onFocus: () => void;
  onSaved: (setLog: SetLog) => void;
  onDeleted?: () => void;
  onRowRemoved?: () => void;
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseOptionalFloat(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseOptionalRpe(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 10) {
    return null;
  }
  return parsed;
}

function initialValues(
  existingLog: SetLog | undefined,
  prescribedSet: SessionExerciseSet | undefined,
  isPrescribed: boolean,
): SetLogValues {
  return {
    reps: existingLog?.reps ?? null,
    duration_seconds: existingLog?.duration_seconds ?? null,
    load_kg: existingLog?.load_kg ?? null,
    rpe: existingLog?.rpe ?? null,
    is_complete: false,
    is_warmup: resolveLogIsWarmup({ existingLog, prescribedSet, isPrescribed }),
  };
}

function hasEnteredValues(values: SetLogValues): boolean {
  return values.reps !== null || values.duration_seconds !== null || values.load_kg !== null;
}

function SuffixInput({ suffix, className, ...props }: ComponentProps<typeof Input> & { suffix: string }) {
  return (
    <div className="relative">
      <Input className={cn("min-h-11 border-white/15 bg-white/5 pr-10 text-base text-white", className)} {...props} />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-blue-100/50">
        {suffix}
      </span>
    </div>
  );
}

export default function SetLogRow({
  sessionExerciseId,
  setNumber,
  existingLog,
  prescribedSet,
  defaultMetric,
  isPrescribed,
  isActive,
  readOnly = false,
  onFocus,
  onSaved,
  onDeleted,
  onRowRemoved,
}: SetLogRowProps) {
  const [values, setValues] = useState(() => initialValues(existingLog, prescribedSet, isPrescribed));
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { status, error, retry, cancelPendingSave } = useDebouncedSetLogSave({
    sessionExerciseId,
    setNumber,
    values,
    onSaved,
  });

  const showReps = defaultMetric !== "time";
  const showDuration = defaultMetric === "time";
  const showLoad = defaultMetric === "reps_weight";
  const isLogged = isSetValuesLogged(values, defaultMetric) || isSetLogged(existingLog, defaultMetric);
  const canFill = !readOnly && Boolean(prescribedSet) && !isLogged;
  const canDelete =
    !readOnly &&
    (!isPrescribed || Boolean(existingLog) || hasEnteredValues(values) || isSetLogged(existingLog, defaultMetric));

  async function handleDelete() {
    onFocus();
    setDeleteError(null);

    if (existingLog) {
      setDeletePending(true);

      const params = new URLSearchParams({
        session_exercise_id: sessionExerciseId,
        set_number: String(setNumber),
      });

      try {
        const response = await fetch(`/api/client/set-logs?${params.toString()}`, { method: "DELETE" });
        const body = (await response.json()) as { error?: string; details?: { message?: string } };

        if (!response.ok) {
          setDeleteError(body.details?.message ?? body.error ?? `Delete failed (${response.status})`);
          return;
        }

        onDeleted?.();
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : "Delete failed");
        return;
      } finally {
        setDeletePending(false);
      }
    }

    cancelPendingSave();
    setValues(initialValues(undefined, prescribedSet, isPrescribed));

    if (!isPrescribed) {
      onRowRemoved?.();
    }
  }

  function handleFill() {
    onFocus();
    setValues(
      fillValuesFromPrescription({
        prescribedSet,
        defaultMetric,
        existingLog,
        isPrescribed,
      }),
    );
  }

  return (
    <tr
      className={cn(
        "border-b border-white/5 transition-colors",
        values.is_warmup && "text-blue-100/60",
        isActive && "bg-blue-500/10 ring-1 ring-blue-400/40 ring-inset",
      )}
      onFocusCapture={onFocus}
    >
      <td className={cn("px-3 py-3 text-sm font-medium", values.is_warmup ? "text-blue-100/60" : "text-white")}>
        Set {setNumber}
      </td>

      {showReps ? (
        <td className="px-2 py-2">
          <SuffixInput
            suffix="reps"
            type="number"
            inputMode="numeric"
            aria-label={`Set ${setNumber} reps`}
            className="text-center"
            disabled={readOnly}
            readOnly={readOnly}
            value={values.reps ?? ""}
            onChange={(event) => {
              onFocus();
              setValues((prev) => ({ ...prev, reps: parseOptionalInt(event.target.value) }));
            }}
          />
        </td>
      ) : null}

      {showDuration ? (
        <td className="px-2 py-2">
          <SuffixInput
            suffix="s"
            type="number"
            inputMode="numeric"
            aria-label={`Set ${setNumber} duration seconds`}
            className="text-center"
            disabled={readOnly}
            readOnly={readOnly}
            value={values.duration_seconds ?? ""}
            onChange={(event) => {
              onFocus();
              setValues((prev) => ({ ...prev, duration_seconds: parseOptionalInt(event.target.value) }));
            }}
          />
        </td>
      ) : null}

      {showLoad ? (
        <td className="px-2 py-2">
          <SuffixInput
            suffix="kg"
            type="number"
            inputMode="decimal"
            aria-label={`Set ${setNumber} load kg`}
            className="text-center"
            disabled={readOnly}
            readOnly={readOnly}
            value={values.load_kg ?? ""}
            onChange={(event) => {
              onFocus();
              setValues((prev) => ({ ...prev, load_kg: parseOptionalFloat(event.target.value) }));
            }}
          />
        </td>
      ) : null}

      <td className="px-2 py-2">
        <SuffixInput
          suffix="RPE"
          type="number"
          inputMode="numeric"
          min={1}
          max={10}
          aria-label={`Set ${setNumber} RPE`}
          className="text-center font-mono"
          disabled={readOnly}
          readOnly={readOnly}
          value={values.rpe ?? ""}
          onChange={(event) => {
            onFocus();
            setValues((prev) => ({ ...prev, rpe: parseOptionalRpe(event.target.value) }));
          }}
        />
      </td>

      <td className="px-2 py-2 whitespace-nowrap">
        <div className="flex min-h-11 shrink-0 items-center justify-center">
          <RoundWarmupToggle
            isWarmup={values.is_warmup}
            disabled={readOnly}
            onChange={(isWarmup) => {
              if (readOnly) return;
              onFocus();
              setValues((prev) => ({ ...prev, is_warmup: isWarmup }));
            }}
          />
        </div>
      </td>

      <td className="px-2 py-2">
        <div className="flex min-h-11 items-center justify-center">
          {canFill ? (
            <button
              type="button"
              aria-label={`Fill set ${setNumber} from prescription`}
              className="flex size-11 items-center justify-center rounded-lg border border-blue-400/40 bg-blue-500/15 text-blue-100 transition-colors hover:border-blue-300/60 hover:bg-blue-500/25"
              onClick={handleFill}
            >
              <ClipboardPaste className="size-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </td>

      <td className="w-10 px-2 py-2">
        <div className="flex min-h-11 items-center justify-center">
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg text-blue-100/40 hover:bg-white/5 hover:text-red-300 disabled:opacity-30"
            aria-label={`Remove set ${setNumber} log`}
            disabled={!canDelete || deletePending}
            onClick={() => {
              void handleDelete();
            }}
          >
            {deletePending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </td>

      <td className="w-10 px-2 py-2">
        <div className="flex min-h-11 items-center justify-center">
          {status === "saving" ? (
            <Loader2 className="size-4 animate-spin text-blue-200/70" aria-label="Saving" />
          ) : null}
          {status === "error" ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-red-300 hover:text-red-200"
              aria-label={error ? `Retry save: ${error}` : "Retry save"}
              onClick={retry}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
          {deleteError ? <span className="sr-only">{deleteError}</span> : null}
        </div>
      </td>
    </tr>
  );
}
