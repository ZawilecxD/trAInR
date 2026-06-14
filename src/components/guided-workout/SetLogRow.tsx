import { Check, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useDebouncedSetLogSave, type SetLogValues } from "@/components/hooks/useDebouncedSetLogSave";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ExerciseMetric, SessionExerciseSet, SetLog } from "@/types";

interface SetLogRowProps {
  sessionExerciseId: string;
  prescribedSet: SessionExerciseSet;
  existingLog: SetLog | undefined;
  defaultMetric: ExerciseMetric;
  isActive: boolean;
  onFocus: () => void;
  onSaved: (setLog: SetLog) => void;
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

function initialValues(prescribedSet: SessionExerciseSet, existingLog: SetLog | undefined): SetLogValues {
  return {
    reps: existingLog?.reps ?? prescribedSet.prescribed_reps,
    duration_seconds: existingLog?.duration_seconds ?? prescribedSet.prescribed_duration_seconds,
    load_kg: existingLog?.load_kg ?? prescribedSet.prescribed_load_kg,
    is_complete: existingLog?.is_complete ?? false,
  };
}

export default function SetLogRow({
  sessionExerciseId,
  prescribedSet,
  existingLog,
  defaultMetric,
  isActive,
  onFocus,
  onSaved,
}: SetLogRowProps) {
  const [values, setValues] = useState(() => initialValues(prescribedSet, existingLog));
  const { status, error, retry } = useDebouncedSetLogSave({
    sessionExerciseId,
    setNumber: prescribedSet.set_number,
    values,
    onSaved,
  });

  const showReps = defaultMetric !== "time";
  const showDuration = defaultMetric === "time";
  const showLoad = defaultMetric === "reps_weight";

  return (
    <tr
      className={cn(
        "border-b border-white/5 transition-colors",
        isActive && "bg-blue-500/10 ring-1 ring-blue-400/40 ring-inset",
      )}
      onFocusCapture={onFocus}
    >
      <td className="px-3 py-3 text-sm font-medium text-white">Set {prescribedSet.set_number}</td>

      {showReps ? (
        <td className="px-2 py-2">
          <Input
            type="number"
            inputMode="numeric"
            aria-label={`Set ${prescribedSet.set_number} reps`}
            className="min-h-11 border-white/15 bg-white/5 text-center text-base text-white"
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
          <Input
            type="number"
            inputMode="numeric"
            aria-label={`Set ${prescribedSet.set_number} duration seconds`}
            className="min-h-11 border-white/15 bg-white/5 text-center text-base text-white"
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
          <Input
            type="number"
            inputMode="decimal"
            aria-label={`Set ${prescribedSet.set_number} load kg`}
            className="min-h-11 border-white/15 bg-white/5 text-center text-base text-white"
            value={values.load_kg ?? ""}
            onChange={(event) => {
              onFocus();
              setValues((prev) => ({ ...prev, load_kg: parseOptionalFloat(event.target.value) }));
            }}
          />
        </td>
      ) : null}

      <td className="px-2 py-2">
        <div className="flex min-h-11 items-center justify-center gap-2">
          <button
            type="button"
            aria-label={`Mark set ${prescribedSet.set_number} complete`}
            aria-pressed={values.is_complete}
            className={cn(
              "flex size-11 items-center justify-center rounded-lg border transition-colors",
              values.is_complete
                ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                : "border-white/20 bg-white/5 text-blue-100/50 hover:border-white/40 hover:text-white",
            )}
            onClick={() => {
              onFocus();
              setValues((prev) => ({ ...prev, is_complete: !prev.is_complete }));
            }}
          >
            <Check className="size-5" aria-hidden="true" />
          </button>
        </div>
      </td>

      <td className="px-2 py-2 text-right">
        {status === "saving" ? <span className="text-xs text-blue-200/70">Saving…</span> : null}
        {status === "saved" ? <span className="text-xs text-emerald-300/80">Saved</span> : null}
        {status === "error" ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-red-300 hover:text-red-200"
            onClick={retry}
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            Retry
          </button>
        ) : null}
        {error && status === "error" ? (
          <p className="mt-1 max-w-24 text-[10px] leading-tight text-red-200/80">{error}</p>
        ) : null}
      </td>
    </tr>
  );
}
