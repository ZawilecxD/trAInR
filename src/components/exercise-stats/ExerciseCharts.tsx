import { cn } from "@/lib/utils";
import {
  areaPath,
  linePath,
  plotPoints,
  yScaleForTrend,
  type ExerciseTrend,
  type TrendKind,
  type WeekBucket,
} from "@/lib/exercise-stats/chart-series";
import { parseISODate } from "@/lib/dates";

function formatCompactDate(isoDate: string): string {
  return parseISODate(isoDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTrendValue(value: number, unit: string): string {
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return unit === "reps" ? `${rounded} reps` : `${rounded} ${unit}`;
}

function SparklinePath({ values, kind }: { values: number[]; kind: TrendKind }) {
  const width = 88;
  const height = 36;
  const pad = 3;
  const scale = yScaleForTrend(values, kind);
  const points = plotPoints(values, width, height, pad, scale);
  const baselineY = height - pad;
  const lastPoint = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="text-primary h-9 w-[5.5rem] shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      {points.length > 1 ? <path d={areaPath(points, baselineY)} fill="currentColor" className="opacity-25" /> : null}
      {points.length > 1 ? (
        <path d={linePath(points)} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      ) : null}
      <circle cx={lastPoint.x} cy={lastPoint.y} r="2.4" className="fill-warning" />
    </svg>
  );
}

export function ExerciseSparkline({ trend, className }: { trend: ExerciseTrend; className?: string }) {
  const values = trend.points.map((point) => point.value);
  const lastPoint = trend.points[trend.points.length - 1];
  const description =
    values.length === 0
      ? `${trend.label} has no plotted sessions yet`
      : `${trend.label} across ${values.length} session${values.length === 1 ? "" : "s"}, latest ${formatTrendValue(lastPoint.value, trend.unit)}`;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {values.length > 0 ? <SparklinePath values={values} kind={trend.kind} /> : null}
      <span className="sr-only">{description}</span>
    </div>
  );
}

function AxisDate({ iso }: { iso: string }) {
  return <span className="data-mono text-muted-foreground text-[10px]">{formatCompactDate(iso)}</span>;
}

export function SessionTrendChart({ trend }: { trend: ExerciseTrend }) {
  if (trend.points.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Not enough logged sets to plot {trend.label.toLowerCase()} yet.</p>
    );
  }

  const firstPoint = trend.points[0];
  const lastPoint = trend.points[trend.points.length - 1];
  const width = 320;
  const height = 148;
  const pad = 14;
  const values = trend.points.map((point) => point.value);
  const scale = yScaleForTrend(values, trend.kind);
  const points = plotPoints(values, width, height, pad, scale);
  const baselineY = height - pad;
  const lastPlotted = points[points.length - 1];
  const midPoint = trend.points[Math.floor(trend.points.length / 2)];
  const showMidDate = trend.points.length > 2 && midPoint.date !== firstPoint.date && midPoint.date !== lastPoint.date;

  return (
    <figure className="space-y-3">
      <figcaption className="flex items-end justify-between gap-3">
        <div>
          <p className="label-caps text-muted-foreground">{trend.label}</p>
          <p className="stat-readout text-foreground mt-1">{formatTrendValue(lastPoint.value, trend.unit)}</p>
        </div>
        <p className="text-muted-foreground text-xs">Latest session</p>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="text-primary h-40 w-full"
        role="img"
        aria-label={`${trend.label} from ${formatCompactDate(firstPoint.date)} to ${formatCompactDate(lastPoint.date)}`}
      >
        <path d={areaPath(points, baselineY)} fill="currentColor" className="opacity-20" />
        {points.length > 1 ? (
          <path
            d={linePath(points)}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {points.map((point, index) => {
          const session = trend.points[index];
          return (
            <circle key={`${session.date}-${index}`} cx={point.x} cy={point.y} r="3" className="fill-primary">
              <title>
                {formatCompactDate(session.date)}: {formatTrendValue(session.value, trend.unit)}
              </title>
            </circle>
          );
        })}
        <circle
          cx={lastPlotted.x}
          cy={lastPlotted.y}
          r="4.5"
          className="fill-warning stroke-background"
          strokeWidth="2"
        />
      </svg>
      <div className="flex justify-between">
        <AxisDate iso={firstPoint.date} />
        {showMidDate ? <AxisDate iso={midPoint.date} /> : null}
        <AxisDate iso={lastPoint.date} />
      </div>
    </figure>
  );
}

export function WeeklyVolumeChart({ weeks }: { weeks: WeekBucket[] }) {
  if (weeks.length === 0) {
    return null;
  }

  const firstWeek = weeks[0];
  const latestWeek = weeks[weeks.length - 1];

  const values = weeks.map((week) => week.volumeKg);
  const hasVolume = values.some((value) => value > 0);
  const plotted = hasVolume ? values : weeks.map((week) => week.sessionCount);
  const label = hasVolume ? "Weekly volume" : "Sessions per week";
  const unit = hasVolume ? "kg" : "sessions";
  const max = Math.max(...plotted, 1);

  return (
    <figure className="space-y-4">
      <figcaption className="flex items-end justify-between gap-3">
        <div>
          <p className="label-caps text-muted-foreground">{label}</p>
          <p className="stat-readout text-foreground mt-1">
            {formatTrendValue(hasVolume ? latestWeek.volumeKg : latestWeek.sessionCount, unit)}
          </p>
        </div>
        <p className="text-muted-foreground max-w-[10rem] text-right text-xs">
          Last {weeks.length} weeks of logged work
        </p>
      </figcaption>
      <svg
        viewBox="0 0 320 132"
        className="text-primary h-32 w-full"
        role="img"
        aria-label={`${label} from ${formatCompactDate(firstWeek.weekStart)} to ${formatCompactDate(latestWeek.weekStart)}`}
      >
        {weeks.map((week, index) => {
          const value = plotted[index] ?? 0;
          const barWidth = 28;
          const gap = (320 - barWidth * weeks.length) / (weeks.length + 1);
          const x = gap + index * (barWidth + gap);
          const barHeight = (value / max) * 108;
          const y = 120 - barHeight;
          return (
            <g key={week.weekStart}>
              <rect
                x={x}
                y={value > 0 ? y : 117}
                width={barWidth}
                height={value > 0 ? Math.max(barHeight, 4) : 3}
                rx="6"
                className={cn(
                  index === weeks.length - 1 && value > 0 ? "fill-warning" : "fill-current",
                  value === 0 && "fill-muted-foreground/40",
                )}
                opacity={index === weeks.length - 1 && value > 0 ? 1 : 0.72}
              >
                <title>
                  Week of {formatCompactDate(week.weekStart)}: {formatTrendValue(value, unit)}
                </title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between">
        <AxisDate iso={firstWeek.weekStart} />
        <AxisDate iso={latestWeek.weekStart} />
      </div>
    </figure>
  );
}
