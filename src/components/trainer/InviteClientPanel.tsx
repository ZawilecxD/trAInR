import { useState } from "react";
import { CalendarDays, Copy, Link2, Trash2, Users } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function statusBadgeClass(status: InviteStatus): string {
  switch (status) {
    case "active":
      return "border-success/40 bg-success/20 text-success";
    case "used":
      return "border-border bg-muted text-muted-foreground";
    case "expired":
      return "border-warning/40 bg-warning/20 text-warning";
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

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-foreground text-lg font-semibold">Invite a client</h2>
        <p className="text-muted-foreground text-sm">
          Generate a single-use link and share it via WhatsApp, SMS, or any channel you prefer.
        </p>

        <Button
          type="button"
          onClick={() => {
            void handleGenerate();
          }}
          disabled={generating}
          className="w-full sm:w-auto"
        >
          <Link2 className="size-4" />
          {generating ? "Generating…" : "Generate invite link"}
        </Button>

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

      <section className="space-y-3">
        <h2 className="text-foreground text-lg font-semibold">Recent invites</h2>
        {invites.length === 0 ? (
          <p className="text-muted-foreground text-sm">No invites yet. Generate your first link above.</p>
        ) : (
          <ul className="border-border bg-card divide-y divide-white/10 rounded-xl border">
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
                    <Badge variant="outline" className={cn(statusBadgeClass(status))}>
                      {statusLabel(status)}
                    </Badge>
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

      <section className="space-y-3">
        <h2 className="text-foreground flex items-center gap-2 text-lg font-semibold">
          <Users className="size-5" />
          Your clients
        </h2>
        {clients.length === 0 ? (
          <p className="text-muted-foreground text-sm">No clients assigned yet. Share an invite link to get started.</p>
        ) : (
          <ul className="space-y-3">
            {clients.map((client) => {
              const planStart = client.activePlan ? formatPlanStartDate(client.activePlan.start_date) : null;

              return (
                <li key={client.assignmentId} className="border-border bg-card rounded-xl border p-4 backdrop-blur-xl">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className="border-border bg-muted text-foreground flex size-11 shrink-0 items-center justify-center rounded-full border text-sm font-semibold"
                        aria-hidden="true"
                      >
                        {clientInitials(client.displayName)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-base font-medium">{client.displayName}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Joined {formatAssignedDate(client.assignedAt)}
                        </p>
                        {client.activePlan ? (
                          <p className="text-muted-foreground mt-2 text-sm">
                            <span className="text-foreground font-medium">{client.activePlan.name}</span>
                            {planStart ? <span className="text-muted-foreground"> · Started {planStart}</span> : null}
                          </p>
                        ) : (
                          <p className="text-warning/80 mt-2 text-sm">No active plan</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-border bg-card hover:bg-accent text-foreground min-h-11"
                        asChild
                      >
                        <a href={`/trainer/clients/${client.clientId}/plan`}>
                          <CalendarDays className="size-3.5" />
                          Open calendar
                        </a>
                      </Button>
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
    </div>
  );
}
