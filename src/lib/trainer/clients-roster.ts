import type { ActiveClientPlan } from "@/lib/client-plans/service";
import type { Profile, TrainerClient } from "@/types";

export interface TrainerClientRosterItem {
  assignmentId: string;
  clientId: string;
  displayName: string;
  assignedAt: string;
  activePlan?: ActiveClientPlan;
}

export function mapAssignmentsToRoster(
  assignments: TrainerClient[],
  profileById: Record<string, Pick<Profile, "display_name">>,
  planByClientId: Map<string, ActiveClientPlan>,
): TrainerClientRosterItem[] {
  return assignments.map((row) => {
    const item: TrainerClientRosterItem = {
      assignmentId: row.id,
      clientId: row.client_id,
      displayName: (profileById[row.client_id] ?? { display_name: "Unknown client" }).display_name,
      assignedAt: row.assigned_at,
    };

    const activePlan = planByClientId.get(row.client_id);
    if (activePlan) {
      item.activePlan = activePlan;
    }

    return item;
  });
}
