import type { SessionStatus } from "@/types";

/** Shared session shape for client/trainer calendar hubs. */
export interface PlanCalendarSession {
  id: string;
  scheduled_date: string;
  name: string;
  status: SessionStatus;
  source_template_id?: string | null;
  started_at?: string | null;
}
