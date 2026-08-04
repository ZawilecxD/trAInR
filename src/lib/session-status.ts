import type { SessionStatus } from "@/types";

/** Matches StatusBadge `status` variants without importing the React component into lib/. */
export type SessionChipStatus = "success" | "warning" | "muted";

export function sessionStatusLabel(status: SessionStatus): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "finished":
      return "Finished";
    case "finished_partially":
      return "Partial";
    case "cancelled":
      return "Cancelled";
  }
}

export function sessionStatusBadgeClass(status: SessionStatus): string {
  switch (status) {
    case "not_started":
      return "border-muted-foreground/40 bg-muted text-foreground";
    case "finished":
      return "border-success/40 bg-success/20 text-success";
    case "finished_partially":
      return "border-warning/40 bg-warning/20 text-warning";
    case "cancelled":
      return "border-muted-foreground/40 bg-muted text-muted-foreground";
  }
}

/** Map session status to shared StatusBadge variants (DESIGN.md Badge / Status). */
export function sessionStatusToBadgeStatus(status: SessionStatus): SessionChipStatus {
  switch (status) {
    case "finished":
      return "success";
    case "finished_partially":
      return "warning";
    case "not_started":
    case "cancelled":
      return "muted";
  }
}

export function clientSessionChip(
  status: SessionStatus,
  startedAt?: string | null,
): {
  label: string;
  status: SessionChipStatus;
} {
  if (status === "not_started" && startedAt) {
    return { label: "In progress", status: "warning" };
  }
  return { label: sessionStatusLabel(status), status: sessionStatusToBadgeStatus(status) };
}
