import { CalendarDays, ChevronRight, Dumbbell, LayoutTemplate, UserPlus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { formatSessionOverviewDate } from "@/lib/guided-workout/format-session-date";
import type { TrainerActivityItem, TrainerDashboard, TrainerDashboardClient } from "@/lib/trainer-dashboard/service";
import type { ReadoutStatus } from "@/lib/trainer-dashboard/readout";
import { surfaceCardClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

interface TrainerDashboardOverviewProps {
  dashboard: TrainerDashboard;
  trainerName: string;
  greeting: string;
}

function readoutBadgeClass(status: ReadoutStatus): string {
  switch (status) {
    case "fully_logged":
      return "border-success/30 bg-success/15 text-success";
    case "in_progress":
      return "border-warning/30 bg-warning/15 text-warning";
    case "not_logged":
      return "border-border bg-muted text-muted-foreground";
  }
}

function formatRelativeActivity(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function clientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function clientSubtitle(client: TrainerDashboardClient): string {
  return client.activePlan ? client.activePlan.name : "No active plan";
}

export default function TrainerDashboardOverview({
  dashboard,
  trainerName,
  greeting,
}: TrainerDashboardOverviewProps) {
  const { clients, summary, recentActivity } = dashboard;
  const hasClients = clients.length > 0;
  const firstClient = clients.at(0);
  const scheduleHref = firstClient ? `/trainer/clients/${firstClient.clientId}/plan` : "/trainer/clients";
  const sidebarClients = clients.slice(0, 6);
  const activityPreview = recentActivity.slice(0, 6);

  const quickActions = [
    {
      label: "Invite client",
      description: "Generate a link for a new client",
      href: "/trainer/clients",
      icon: UserPlus,
    },
    {
      label: "New template",
      description: "Build a reusable session",
      href: "/trainer/templates",
      icon: LayoutTemplate,
    },
    {
      label: "Add exercise",
      description: "Expand your library",
      href: "/trainer/exercises",
      icon: Dumbbell,
    },
    {
      label: "Schedule session",
      description: "Place a session on a calendar",
      href: scheduleHref,
      icon: CalendarDays,
    },
  ];

  const honestStats = [
    { label: "Active clients", value: summary.activeClientCount },
    { label: "With active plan", value: summary.clientsWithActivePlanCount },
    { label: "Recent logged sessions", value: summary.recentLoggedSessionCount },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="headline-lg text-foreground">
            {greeting}, {trainerName}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Overview of your clients and recent session activity</p>
        </div>
        <a
          href="/trainer/clients"
          className="bg-primary hover:bg-primary/90 text-primary-foreground inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
        >
          <UserPlus className="size-4" aria-hidden="true" />
          Invite Client
        </a>
      </header>

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-3">
        {honestStats.map((stat) => (
          <div key={stat.label} className={cn(surfaceCardClass, "p-5")}>
            <p className="label-caps text-muted-foreground">{stat.label}</p>
            <p className="stat-readout text-foreground mt-2">{stat.value}</p>
          </div>
        ))}
      </section>

      {!hasClients ? (
        <EmptyState
          title="No clients yet"
          description="Invite your first client to start coaching asynchronously with trAInR."
          action={
            <a
              href="/trainer/clients"
              className="bg-primary hover:bg-primary/90 text-primary-foreground inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            >
              Invite Client
            </a>
          }
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className={cn(surfaceCardClass, "p-5 md:p-6")} aria-label="Recent activity">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-foreground text-lg font-semibold">Recent activity</h2>
              {hasClients ? (
                <a
                  href="/trainer/clients"
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors hover:underline"
                >
                  View all sessions
                </a>
              ) : null}
            </div>

            {recentActivity.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No logged activity yet"
                  description={
                    hasClients
                      ? "When clients start sessions and log sets, their activity will appear here."
                      : "Invite a client and schedule a session to begin tracking logged work."
                  }
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {activityPreview.map((item: TrainerActivityItem) => (
                  <li key={item.sessionId}>
                    <div className="border-border bg-background/40 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-sm font-medium">{item.clientDisplayName}</p>
                        <p className="text-muted-foreground mt-0.5 truncate text-sm">
                          {item.sessionName} · {formatRelativeActivity(item.lastActivityAt)}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {formatSessionOverviewDate(item.scheduledDate)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "label-caps inline-flex rounded-[var(--radius-pill)] border px-2.5 py-1",
                            readoutBadgeClass(item.readoutStatus),
                          )}
                        >
                          {item.readoutLabel}
                        </span>
                        <a
                          href={`/trainer/clients/${item.clientId}/sessions/${item.sessionId}`}
                          className="border-border hover:bg-accent text-foreground inline-flex min-h-10 items-center rounded-lg border px-3 py-1.5 text-sm transition-colors"
                        >
                          Review
                        </a>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          {hasClients ? (
            <section className={cn(surfaceCardClass, "p-5")} aria-label="Clients">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-foreground text-lg font-semibold">Clients</h2>
                <p className="text-muted-foreground text-sm">{summary.activeClientCount} active</p>
              </div>
              <ul className="mt-4 space-y-1">
                {sidebarClients.map((client: TrainerDashboardClient) => (
                  <li key={client.clientId}>
                    <a
                      href={`/trainer/clients/${client.clientId}/plan`}
                      className="hover:bg-accent/50 flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 transition-colors"
                    >
                      <span
                        className="border-border bg-muted text-foreground flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
                        aria-hidden="true"
                      >
                        {clientInitials(client.displayName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground flex items-center gap-2 truncate text-sm font-medium">
                          {client.displayName}
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              client.activePlan ? "bg-success" : "bg-muted-foreground/50",
                            )}
                            aria-hidden="true"
                          />
                        </span>
                        <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                          {clientSubtitle(client)}
                        </span>
                      </span>
                      <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
              <a
                href="/trainer/clients"
                className="text-muted-foreground hover:text-foreground mt-4 inline-flex text-sm transition-colors hover:underline"
              >
                View all clients
              </a>
            </section>
          ) : null}

          <section className={cn(surfaceCardClass, "p-5")} aria-label="Quick actions">
            <h2 className="text-foreground text-lg font-semibold">Quick actions</h2>
            <ul className="mt-4 grid gap-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <li key={action.label}>
                    <a
                      href={action.href}
                      className="border-border hover:border-primary/40 hover:bg-accent/40 flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors"
                    >
                      <span className="bg-muted text-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="text-foreground block text-sm font-medium">{action.label}</span>
                        <span className="text-muted-foreground mt-0.5 block text-xs">{action.description}</span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
