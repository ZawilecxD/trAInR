import type { SessionStatus } from "@/types";

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
