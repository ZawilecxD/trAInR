import { useState } from "react";
import { Copy, Link2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { InviteLink, Profile, TrainerClient } from "@/types";

type ClientWithProfile = TrainerClient & {
  client: Pick<Profile, "display_name">;
};

type InviteStatus = "active" | "used" | "expired";

interface Props {
  invites: InviteLink[];
  clients: ClientWithProfile[];
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
      return "border-emerald-500/40 bg-emerald-500/20 text-emerald-100";
    case "used":
      return "border-white/20 bg-white/10 text-blue-100/70";
    case "expired":
      return "border-amber-500/40 bg-amber-500/20 text-amber-100";
  }
}

function formatInviteUrl(origin: string, token: string): string {
  return `${origin}/auth/signup?token=${encodeURIComponent(token)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function InviteClientPanel({ invites: initialInvites, clients, origin }: Props) {
  const [invites, setInvites] = useState(initialInvites);
  const [latestUrl, setLatestUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
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

  const displayUrl = latestUrl ?? (invites[0] ? formatInviteUrl(origin, invites[0].token) : null);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Invite a client</h2>
        <p className="text-sm text-blue-100/70">
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

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {displayUrl ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input readOnly value={displayUrl} className="font-mono text-xs text-blue-100/90" aria-label="Invite URL" />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 border-white/20 bg-white/10 text-white hover:bg-white/20"
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
        <h2 className="text-lg font-semibold text-white">Recent invites</h2>
        {invites.length === 0 ? (
          <p className="text-sm text-blue-100/60">No invites yet. Generate your first link above.</p>
        ) : (
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/5">
            {invites.map((invite) => {
              const status = getInviteStatus(invite);
              const url = formatInviteUrl(origin, invite.token);

              return (
                <li key={invite.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-mono text-xs text-blue-100/80">{url}</p>
                    <p className="text-xs text-blue-100/50">
                      Created {formatDate(invite.created_at)}
                      {invite.expires_at ? ` · Expires ${formatDate(invite.expires_at)}` : null}
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
                        className="text-blue-100/80 hover:bg-white/10 hover:text-white"
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
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <Users className="size-5" />
          Your clients
        </h2>
        {clients.length === 0 ? (
          <p className="text-sm text-blue-100/60">No clients assigned yet. Share an invite link to get started.</p>
        ) : (
          <ul className="space-y-2">
            {clients.map((row) => (
              <li key={row.id} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                {row.client.display_name}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
