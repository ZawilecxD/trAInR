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
      return "border-blue-400/40 bg-blue-500/20 text-blue-100";
    case "finished":
      return "border-emerald-400/40 bg-emerald-500/20 text-emerald-100";
    case "finished_partially":
      return "border-amber-400/40 bg-amber-500/20 text-amber-100";
    case "cancelled":
      return "border-slate-400/40 bg-slate-500/20 text-slate-300";
  }
}
