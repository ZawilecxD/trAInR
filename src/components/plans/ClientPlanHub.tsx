import { useMemo, useState } from "react";
import { CalendarPlus, ChevronRight, Pencil } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import PlanCalendar from "@/components/plans/PlanCalendar";
import { StatusBadge } from "@/components/StatusBadge";
import TemplatePickerModal from "@/components/workout-sessions/TemplatePickerModal";
import { Button } from "@/components/ui/button";
import { monthRange, parseISODate, startOfMonth, toLocalISODate, visibleMonthRange } from "@/lib/dates";
import { type PlanCalendarSession } from "@/lib/plans/calendar-session";
import { sessionStatusLabel, sessionStatusToBadgeStatus } from "@/lib/session-status";
import { successBannerClass, surfaceCardClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { SessionTemplate } from "@/types";

interface ClientPlanHubProps {
  clientId: string;
  clientName: string;
  initialSessions: PlanCalendarSession[];
  initialSelectedDate: string;
  initialMonth: string;
  templates: SessionTemplate[];
  showAssignedBanner: boolean;
}

async function fetchSessions(clientId: string, from: string, to: string): Promise<PlanCalendarSession[]> {
  const params = new URLSearchParams({ client_id: clientId, from, to });
  const response = await fetch(`/api/workout-sessions?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to load sessions (${response.status})`);
  }
  const body = (await response.json()) as { sessions?: PlanCalendarSession[] };
  return body.sessions ?? [];
}

export default function ClientPlanHub({
  clientId,
  clientName,
  initialSessions,
  initialSelectedDate,
  initialMonth,
  templates,
  showAssignedBanner,
}: ClientPlanHubProps) {
  const initialMonthDate = parseISODate(`${initialMonth}-01`);
  const [month, setMonth] = useState(initialMonthDate);
  const [selectedDate, setSelectedDate] = useState(parseISODate(initialSelectedDate));
  const [sessions, setSessions] = useState(initialSessions);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  const selectedIso = toLocalISODate(selectedDate);

  const sessionsOnSelectedDay = useMemo(
    () =>
      sessions.filter((session) => session.scheduled_date === selectedIso).sort((a, b) => a.name.localeCompare(b.name)),
    [sessions, selectedIso],
  );

  async function handleMonthChange(nextMonth: Date) {
    setMonth(nextMonth);
    setLoadingMonth(true);
    setFetchError(null);
    try {
      const monthStart = monthRange(nextMonth.getFullYear(), nextMonth.getMonth());
      setSelectedDate(parseISODate(monthStart.from));
      const range = visibleMonthRange(nextMonth.getFullYear(), nextMonth.getMonth());
      const nextSessions = await fetchSessions(clientId, range.from, range.to);
      setSessions(nextSessions);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoadingMonth(false);
    }
  }

  async function handleSelectDate(date: Date | undefined) {
    if (!date) {
      return;
    }
    setSelectedDate(date);
    const isOutsideMonth = date.getFullYear() !== month.getFullYear() || date.getMonth() !== month.getMonth();
    if (!isOutsideMonth) {
      return;
    }
    const nextMonth = startOfMonth(date);
    setMonth(nextMonth);
    setLoadingMonth(true);
    setFetchError(null);
    try {
      const range = visibleMonthRange(nextMonth.getFullYear(), nextMonth.getMonth());
      const nextSessions = await fetchSessions(clientId, range.from, range.to);
      setSessions(nextSessions);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoadingMonth(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      {showAssignedBanner && !dismissedBanner ? (
        <div className={cn(successBannerClass, "flex items-start justify-between gap-3")}>
          <p className="min-w-0">Session saved successfully.</p>
          <button
            type="button"
            className="text-success/80 hover:text-success shrink-0"
            onClick={() => {
              setDismissedBanner(true);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
        <section className={cn(surfaceCardClass, "min-w-0 overflow-hidden p-4")}>
          <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
            <h2 className="text-text-soft label-caps">Calendar</h2>
            {loadingMonth ? <span className="text-muted-foreground shrink-0 text-xs">Loading…</span> : null}
            {fetchError ? <span className="text-destructive/80 min-w-0 truncate text-xs">{fetchError}</span> : null}
          </div>
          <PlanCalendar
            sessions={sessions}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              void handleSelectDate(date);
            }}
            month={month}
            onMonthChange={(nextMonth) => {
              void handleMonthChange(nextMonth);
            }}
          />
          <ul className="text-muted-foreground mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs">
            <li className="inline-flex items-center gap-1.5">
              <span className="bg-success size-1.5 rounded-full" aria-hidden="true" />
              Finished
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="bg-warning size-1.5 rounded-full" aria-hidden="true" />
              Partial
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="bg-primary size-1.5 rounded-full" aria-hidden="true" />
              Scheduled
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="bg-muted-foreground/50 size-1.5 rounded-full" aria-hidden="true" />
              Cancelled
            </li>
          </ul>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground mt-4 text-center text-sm text-pretty">
              No sessions yet — pick a day and add your first session.
            </p>
          ) : null}
        </section>

        <section className={cn(surfaceCardClass, "min-w-0 p-4 sm:p-5")}>
          <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-foreground text-lg font-semibold text-pretty">
                {selectedDate.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              <p className="text-muted-foreground truncate text-sm">{clientName}&apos;s plan</p>
            </div>
            <Button
              type="button"
              className="bg-primary hover:bg-primary/90 text-primary-foreground min-h-11 w-full sm:w-auto"
              onClick={() => {
                setPickerOpen(true);
              }}
            >
              <CalendarPlus className="size-4" />
              Add session
            </Button>
          </div>

          {sessionsOnSelectedDay.length === 0 ? (
            <EmptyState
              title="No sessions on this day"
              description='Use "Add session" to assign from a template or start blank.'
              className="border-dashed"
              action={
                <Button
                  type="button"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground min-h-11"
                  onClick={() => {
                    setPickerOpen(true);
                  }}
                >
                  <CalendarPlus className="size-4" />
                  Add session
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {sessionsOnSelectedDay.map((session) => (
                <li key={session.id}>
                  <a
                    href={`/trainer/clients/${clientId}/sessions/${session.id}`}
                    className={cn(
                      surfaceCardClass,
                      "hover:bg-accent/60 flex items-center justify-between gap-3 p-4 transition-colors",
                    )}
                  >
                    <span className="min-w-0 space-y-2">
                      <span className="text-foreground block truncate text-base font-semibold">{session.name}</span>
                      <StatusBadge status={sessionStatusToBadgeStatus(session.status)}>
                        {sessionStatusLabel(session.status)}
                      </StatusBadge>
                    </span>
                    <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-sm">
                      {session.status === "not_started" ? (
                        <>
                          <Pencil className="size-3.5" />
                          Edit
                        </>
                      ) : (
                        "View"
                      )}
                      <ChevronRight className="size-4" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <TemplatePickerModal
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
        }}
        templates={templates}
        clientId={clientId}
        scheduledDate={selectedIso}
      />
    </div>
  );
}
