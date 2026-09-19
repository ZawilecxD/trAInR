import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SessionTrendChart } from "@/components/exercise-stats/ExerciseCharts";
import { estimateOneRepMax, type SessionStat, type WorkingSetInput } from "@/lib/exercise-stats/calculations";
import { primaryTrendForSessions } from "@/lib/exercise-stats/chart-series";
import type { ExerciseHistory } from "@/lib/exercise-stats/service";
import { surfaceCardClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

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
    <div className={cn(surfaceCardClass, "p-4")}>
      <p className="label-caps text-muted-foreground">{label}</p>
      <p className="stat-readout text-foreground mt-1">{value}</p>
      {hint ? <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
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
      <tr className="border-border border-b last:border-b-0">
        <td className="px-2 py-2.5">
          <button
            type="button"
            onClick={onToggle}
            className="text-foreground hover:text-text-lavender flex min-h-11 items-center gap-1.5 font-medium transition-colors"
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
        <td className="text-text-soft px-2 py-2.5">{session.topSet ? formatSet(session.topSet, isTime) : "—"}</td>
        <td className="text-text-soft px-2 py-2.5 text-center">{session.workingSetCount}</td>
        {showWeightedCols ? (
          <>
            <td className="text-foreground px-2 py-2.5 text-center">
              {session.estimated1RM !== null ? formatWeight(session.estimated1RM) : "—"}
            </td>
            <td className="text-text-soft px-2 py-2.5 text-center">
              {session.totalVolumeKg !== null ? formatWeight(session.totalVolumeKg) : "—"}
            </td>
          </>
        ) : (
          <td className="text-text-soft px-2 py-2.5 text-center">
            {isTime ? `${session.totalDurationSeconds}s` : `${session.totalReps} reps`}
          </td>
        )}
      </tr>
      {expanded ? (
        <tr id={`session-sets-${index}`} className="border-border border-b last:border-b-0">
          <td colSpan={colSpan} className="bg-muted/40 px-2 py-3">
            <ul className="space-y-1.5">
              {session.sets.map((set, setIndex) => {
                const oneRm = estimateOneRepMax(set.loadKg, set.reps);
                return (
                  <li
                    key={setIndex}
                    className="border-border bg-card flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                  >
                    <span className="text-muted-foreground">Set {setIndex + 1}</span>
                    <span className="text-foreground">{formatSet(set, isTime)}</span>
                    {showWeightedCols ? (
                      <span className="data-mono text-muted-foreground text-xs">
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
  const trend = primaryTrendForSessions(sessions, exercise.defaultMetric);

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
        <p className="text-muted-foreground text-xs">
          Estimated 1RM uses the Epley formula and is a rough guide — it grows less accurate above ~10 reps.
        </p>
      ) : null}

      <section className={cn(surfaceCardClass, "p-5")} aria-label={`${trend.label} chart`}>
        <SessionTrendChart trend={trend} />
      </section>

      <section className={cn(surfaceCardClass, "p-4")}>
        <h2 className="label-caps text-muted-foreground">Session history</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[24rem] border-collapse text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wide uppercase">
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
