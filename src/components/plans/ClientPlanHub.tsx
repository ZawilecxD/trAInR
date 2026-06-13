import { useMemo, useState } from "react";
import { CalendarPlus, ChevronRight, Pencil } from "lucide-react";
import PlanCalendar, { type PlanCalendarSession } from "@/components/plans/PlanCalendar";
import TemplatePickerModal from "@/components/workout-sessions/TemplatePickerModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { monthRange, parseISODate, toLocalISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { SessionTemplate, SessionStatus } from "@/types";

interface ClientPlanHubProps {
  clientId: string;
  clientName: string;
  initialSessions: PlanCalendarSession[];
  initialSelectedDate: string;
  initialMonth: string;
  templates: SessionTemplate[];
  showAssignedBanner: boolean;
}

function statusLabel(status: SessionStatus): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "finished":
      return "Finished";
    case "finished_partially":
      return "Partial";
  }
}

function statusBadgeClass(status: SessionStatus): string {
  switch (status) {
    case "not_started":
      return "border-blue-400/40 bg-blue-500/20 text-blue-100";
    case "finished":
      return "border-emerald-400/40 bg-emerald-500/20 text-emerald-100";
    case "finished_partially":
      return "border-amber-400/40 bg-amber-500/20 text-amber-100";
  }
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
      const range = monthRange(nextMonth.getFullYear(), nextMonth.getMonth());
      setSelectedDate(parseISODate(range.from));
      const nextSessions = await fetchSessions(clientId, range.from, range.to);
      setSessions(nextSessions);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoadingMonth(false);
    }
  }

  return (
    <div className="space-y-6">
      {showAssignedBanner && !dismissedBanner ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-green-400/30 bg-green-500/10 px-4 py-3 text-sm text-green-100">
          <p>Session saved successfully.</p>
          <button
            type="button"
            className="shrink-0 text-green-200/80 hover:text-green-50"
            onClick={() => {
              setDismissedBanner(true);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
        <section className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-blue-100/80">Calendar</h2>
            {loadingMonth ? <span className="text-xs text-blue-100/50">Loading…</span> : null}
            {fetchError ? <span className="text-xs text-red-400/80">{fetchError}</span> : null}
          </div>
          <PlanCalendar
            sessions={sessions}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              if (date) {
                setSelectedDate(date);
              }
            }}
            month={month}
            onMonthChange={(nextMonth) => {
              void handleMonthChange(nextMonth);
            }}
          />
          {sessions.length === 0 ? (
            <p className="mt-4 text-center text-sm text-blue-100/60">
              No sessions yet — pick a day and add your first session.
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {selectedDate.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              <p className="text-sm text-blue-100/60">{clientName}&apos;s plan</p>
            </div>
            <Button
              type="button"
              className="bg-purple-500 text-white hover:bg-purple-500/90"
              onClick={() => {
                setPickerOpen(true);
              }}
            >
              <CalendarPlus className="size-4" />
              Add session
            </Button>
          </div>

          {sessionsOnSelectedDay.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/15 px-4 py-8 text-center text-sm text-blue-100/60">
              No sessions on this day. Use &quot;Add session&quot; to assign from a template or start blank.
            </div>
          ) : (
            <ul className="space-y-2">
              {sessionsOnSelectedDay.map((session) => (
                <li key={session.id}>
                  <a
                    href={`/trainer/clients/${clientId}/sessions/${session.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-white">{session.name}</span>
                      <Badge variant="outline" className={cn("mt-1", statusBadgeClass(session.status))}>
                        {statusLabel(session.status)}
                      </Badge>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-sm text-blue-100/70">
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
