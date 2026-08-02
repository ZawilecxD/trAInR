import { useMemo, useState } from "react";
import { CalendarDays, Copy, Link2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { surfaceCardClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { TrainerClientRosterItem } from "@/lib/trainer/clients-roster";
import type { InviteLink } from "@/types";

export type { TrainerClientRosterItem } from "@/lib/trainer/clients-roster";

type InviteStatus = "active" | "used" | "expired";

interface Props {
  invites: InviteLink[];
  clients: TrainerClientRosterItem[];
  origin: string;
}

function getInviteStatus(invite: InviteLink): InviteStatus {
  if (invite.used_at) {
    return "used";
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return "expired";
  }
  return "active";
}

function statusLabel(status: InviteStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "used":
      return "Used";
    case "expired":
      return "Expired";
  }
}

function statusBadgeVariant(status: InviteStatus): "success" | "warning" | "muted" {
  switch (status) {
    case "active":
      return "success";
    case "used":
      return "muted";
    case "expired":
      return "warning";
  }
}

function formatInviteUrl(origin: string, token: string): string {
  return `${origin}/auth/signup?token=${encodeURIComponent(token)}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatAssignedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPlanStartDate(iso: string | null): string | null {
  if (!iso) {
    return null;
  }

  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function clientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

export default function InviteClientPanel({ invites: initialInvites, clients: initialClients, origin }: Props) {
  const [invites, setInvites] = useState(initialInvites);
  const [clients, setClients] = useState(initialClients);
  const [latestUrl, setLatestUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const pendingInvites = useMemo(
    () => invites.filter((invite) => getInviteStatus(invite) === "active").length,
    [invites],
  );
  const withActivePlan = useMemo(() => clients.filter((client) => client.activePlan).length, [clients]);

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const sorted = [...clients].sort((a, b) => a.displayName.localeCompare(b.displayName));
    if (!normalized) {
      return sorted;
    }
    return sorted.filter((client) => client.displayName.toLowerCase().includes(normalized));
  }, [clients, query]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/invites", { method: "POST" });
      const body = (await response.json()) as { url?: string; invite?: InviteLink; error?: string };

      if (!response.ok) {
        setError(body.error ?? "Failed to generate invite");
        return;
      }

      const newInvite = body.invite;
      const newUrl = body.url;
      if (newInvite && newUrl) {
        setInvites((prev) => [newInvite, ...prev]);
        setLatestUrl(newUrl);
        setInviteOpen(true);
      }
    } catch {
      setError("Failed to generate invite");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  async function handleRemove(assignmentId: string, displayName: string) {
    setRemovingId(assignmentId);

    try {
      const response = await fetch(`/api/trainer-clients/${assignmentId}`, { method: "DELETE" });
      const body = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok) {
        toast.error(body.error ?? "Failed to remove client");
        return;
      }

      setClients((prev) => prev.filter((row) => row.assignmentId !== assignmentId));
      toast.success(`${displayName} removed from your client list`);
    } catch {
      toast.error("Failed to remove client");
    } finally {
      setRemovingId(null);
    }
  }

  const displayUrl = latestUrl ?? (invites[0] ? formatInviteUrl(origin, invites[0].token) : null);

  const stats = [
    { label: "Active clients", value: clients.length },
    { label: "With active plan", value: withActivePlan },
    { label: "Pending invites", value: pendingInvites },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="headline-lg text-foreground">Clients</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your roster, active plans, and client calendars.
          </p>
        </div>
        <Button
          type="button"
          className="bg-primary hover:bg-primary/90 text-primary-foreground min-h-11 w-full sm:w-auto"
          disabled={generating}
          onClick={() => {
            setInviteOpen(true);
            if (!displayUrl) {
              void handleGenerate();
            }
          }}
        >
          <Link2 className="size-4" />
          {generating ? "Generating…" : "Invite Client"}
        </Button>
      </header>

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className={cn(surfaceCardClass, "p-5")}>
            <p className="label-caps text-muted-foreground">{stat.label}</p>
            <p className="stat-readout text-foreground mt-2">{stat.value}</p>
          </div>
        ))}
      </section>

      {(inviteOpen || displayUrl) && (
        <section className={cn(surfaceCardClass, "space-y-4 p-5")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-foreground text-lg font-semibold">Invite link</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-border hover:bg-accent bg-transparent"
              disabled={generating}
              onClick={() => {
                void handleGenerate();
              }}
            >
              Generate new
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            Share a single-use link via WhatsApp, SMS, or any channel you prefer.
          </p>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          {displayUrl ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                readOnly
                value={displayUrl}
                className="text-foreground/90 font-mono text-xs"
                aria-label="Invite URL"
              />
              <Button
                type="button"
                variant="outline"
                className="border-border bg-muted hover:bg-accent text-foreground shrink-0"
                onClick={() => {
                  void handleCopy(displayUrl);
                }}
              >
                <Copy className="size-4" />
                Copy
              </Button>
            </div>
          ) : null}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search clients…"
              className="pl-9"
              aria-label="Search clients"
            />
          </div>
          <p className="text-muted-foreground text-sm">Sorted by name</p>
        </div>

        {filteredClients.length === 0 ? (
          clients.length === 0 ? (
            <EmptyState
              title="No clients assigned yet"
              description="Share an invite link to get started."
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="border-border hover:bg-accent bg-transparent"
                  disabled={generating}
                  onClick={() => {
                    setInviteOpen(true);
                    void handleGenerate();
                  }}
                >
                  Invite Client
                </Button>
              }
            />
          ) : (
            <EmptyState title="No clients match your search" description="Try a different name." />
          )
        ) : (
          <ul className="space-y-3">
            {filteredClients.map((client) => {
              const planStart = client.activePlan ? formatPlanStartDate(client.activePlan.start_date) : null;

              return (
                <li key={client.assignmentId} className={cn(surfaceCardClass, "p-4 backdrop-blur-xl")}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className="border-border bg-muted text-foreground flex size-11 shrink-0 items-center justify-center rounded-full border text-sm font-semibold"
                        aria-hidden="true"
                      >
                        {clientInitials(client.displayName)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-2 truncate text-base font-medium">
                          {client.displayName}
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              client.activePlan ? "bg-success" : "bg-muted-foreground/50",
                            )}
                            aria-hidden="true"
                          />
                        </p>
                        <p className="label-caps text-muted-foreground mt-1">
                          Joined {formatAssignedDate(client.assignedAt)}
                        </p>
                        {client.activePlan ? (
                          <p className="text-muted-foreground mt-2 text-sm">
                            <span className="text-foreground font-medium">{client.activePlan.name}</span>
                            {planStart ? <span> · Started {planStart}</span> : null}
                          </p>
                        ) : (
                          <p className="text-warning mt-2 text-sm">No active plan</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className={cn(
                          "min-h-11",
                          client.activePlan
                            ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                            : "border-border bg-transparent",
                        )}
                        variant={client.activePlan ? "default" : "outline"}
                        asChild
                      >
                        <a href={`/trainer/clients/${client.clientId}/plan`}>
                          <CalendarDays className="size-3.5" />
                          Open calendar
                        </a>
                      </Button>
                      {!client.activePlan ? (
                        <a
                          href={`/trainer/clients/${client.clientId}/plan`}
                          className="text-muted-foreground hover:text-foreground text-sm transition-colors hover:underline"
                        >
                          Assign plan →
                        </a>
                      ) : null}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={removingId === client.assignmentId}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive min-h-11"
                          >
                            <Trash2 className="size-3.5" />
                            Remove
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-border bg-popover text-foreground">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove client?</AlertDialogTitle>
                            <AlertDialogDescription className="text-muted-foreground">
                              {client.displayName} will be removed from your client list. Their workout history is
                              retained; you will no longer see them or their plans.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="border-border bg-muted hover:bg-accent text-foreground">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                              disabled={removingId === client.assignmentId}
                              onClick={() => {
                                void handleRemove(client.assignmentId, client.displayName);
                              }}
                            >
                              {removingId === client.assignmentId ? "Removing…" : "Remove client"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground text-lg font-semibold">Recent invites</h2>
        {invites.length === 0 ? (
          <p className="text-muted-foreground text-sm">No invites yet. Generate your first link above.</p>
        ) : (
          <ul className={cn(surfaceCardClass, "divide-border divide-y")}>
            {invites.map((invite) => {
              const status = getInviteStatus(invite);
              const url = formatInviteUrl(origin, invite.token);

              return (
                <li key={invite.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-muted-foreground truncate font-mono text-xs">{url}</p>
                    <p className="text-muted-foreground text-xs">
                      Created {formatDateTime(invite.created_at)}
                      {invite.expires_at ? ` · Expires ${formatDateTime(invite.expires_at)}` : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={statusBadgeVariant(status)}>{statusLabel(status)}</StatusBadge>
                    {status === "active" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={() => {
                          void handleCopy(url);
                        }}
                      >
                        <Copy className="size-3.5" />
                        Copy
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
