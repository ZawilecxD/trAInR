import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { estimateOneRepMax, type SessionStat, type WorkingSetInput } from "@/lib/exercise-stats/calculations";
import type { ExerciseHistory } from "@/lib/exercise-stats/service";

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) {
    return isoDate;
  }
  return `${day}.${month}.${year}`;
}

function formatWeight(kg: number): string {
  return `${kg} kg`;
}

function formatSet(set: WorkingSetInput, isTime: boolean): string {
  if (isTime) {
    return set.durationSeconds !== null ? `${set.durationSeconds}s` : "—";
  }
  if (set.reps === null) {
    return set.durationSeconds !== null ? `${set.durationSeconds}s` : "—";
  }
  if (set.loadKg !== null && set.loadKg > 0) {
    return `${set.reps} × ${formatWeight(set.loadKg)}`;
  }
  return `${set.reps} reps`;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="font-mono text-xs tracking-widest text-blue-200/70 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-blue-100/50">{hint}</p> : null}
    </div>
  );
}

function SessionRow({
  session,
  index,
  isTime,
  showWeightedCols,
  expanded,
  onToggle,
}: {
  session: SessionStat;
  index: number;
  isTime: boolean;
  showWeightedCols: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const colSpan = 3 + (showWeightedCols ? 2 : 1);

  return (
    <>
      <tr className="border-b border-white/5 last:border-b-0">
        <td className="px-2 py-2.5">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-1.5 font-medium text-white transition-colors hover:text-blue-200"
            aria-expanded={expanded}
            aria-controls={`session-sets-${index}`}
          >
            {expanded ? (
              <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
            )}
            {formatDate(session.scheduledDate)}
          </button>
        </td>
        <td className="px-2 py-2.5 text-blue-100/80">{session.topSet ? formatSet(session.topSet, isTime) : "—"}</td>
        <td className="px-2 py-2.5 text-center text-blue-100/80">{session.workingSetCount}</td>
        {showWeightedCols ? (
          <>
            <td className="px-2 py-2.5 text-center text-white">
              {session.estimated1RM !== null ? formatWeight(session.estimated1RM) : "—"}
            </td>
            <td className="px-2 py-2.5 text-center text-blue-100/80">
              {session.totalVolumeKg !== null ? formatWeight(session.totalVolumeKg) : "—"}
            </td>
          </>
        ) : (
          <td className="px-2 py-2.5 text-center text-blue-100/80">
            {isTime ? `${session.totalDurationSeconds}s` : `${session.totalReps} reps`}
          </td>
        )}
      </tr>
      {expanded ? (
        <tr id={`session-sets-${index}`} className="border-b border-white/5 last:border-b-0">
          <td colSpan={colSpan} className="bg-white/[0.02] px-2 py-3">
            <ul className="space-y-1.5">
              {session.sets.map((set, setIndex) => {
                const oneRm = estimateOneRepMax(set.loadKg, set.reps);
                return (
                  <li
                    key={setIndex}
                    className="flex items-center justify-between rounded-md border border-white/5 bg-white/5 px-3 py-1.5 text-sm"
                  >
                    <span className="text-blue-100/70">Set {setIndex + 1}</span>
                    <span className="text-white">{formatSet(set, isTime)}</span>
                    {showWeightedCols ? (
                      <span className="font-mono text-xs text-blue-100/60">
                        {oneRm !== null ? `1RM ${formatWeight(oneRm)}` : "—"}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </td>
        </tr>
      ) : null}
    </>
  );
}

interface ExerciseStatsViewProps {
  history: ExerciseHistory;
}

export default function ExerciseStatsView({ history }: ExerciseStatsViewProps) {
  const { exercise, sessions, summary } = history;
  const isTime = exercise.defaultMetric === "time";
  const hasWeighted = summary.allTimeBest1RM !== null || summary.bestSessionVolumeKg !== null;
  const showWeightedCols = !isTime && hasWeighted;

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (sessionId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {showWeightedCols ? (
          <StatCard
            label="Est. 1RM"
            value={summary.allTimeBest1RM !== null ? formatWeight(summary.allTimeBest1RM) : "—"}
            hint="best, estimated"
          />
        ) : null}
        {showWeightedCols ? (
          <StatCard
            label="Best volume"
            value={summary.bestSessionVolumeKg !== null ? formatWeight(summary.bestSessionVolumeKg) : "—"}
            hint="single session"
          />
        ) : null}
        <StatCard label="Sessions" value={String(summary.sessionCount)} />
        <StatCard label="Working sets" value={String(summary.totalWorkingSets)} />
      </div>

      {showWeightedCols ? (
        <p className="text-xs text-blue-100/50">
          Estimated 1RM uses the Epley formula and is a rough guide — it grows less accurate above ~10 reps.
        </p>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
        <h2 className="font-mono text-xs tracking-widest text-blue-200/80">SESSION HISTORY</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[24rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs tracking-wide text-blue-100/60 uppercase">
                <th className="px-2 py-2 font-medium">Date</th>
                <th className="px-2 py-2 font-medium">Top set</th>
                <th className="px-2 py-2 text-center font-medium">Sets</th>
                {showWeightedCols ? (
                  <>
                    <th className="px-2 py-2 text-center font-medium">Est. 1RM</th>
                    <th className="px-2 py-2 text-center font-medium">Volume</th>
                  </>
                ) : (
                  <th className="px-2 py-2 text-center font-medium">{isTime ? "Total time" : "Total reps"}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sessions.map((session, index) => (
                <SessionRow
                  key={session.sessionId}
                  session={session}
                  index={index}
                  isTime={isTime}
                  showWeightedCols={showWeightedCols}
                  expanded={expanded.has(session.sessionId)}
                  onToggle={() => {
                    toggle(session.sessionId);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
