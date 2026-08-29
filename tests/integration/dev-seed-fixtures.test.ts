import { describe, expect, it } from "vitest";

import { getAdmin } from "./helpers/admin.js";

const FIXTURE_EXERCISES = [
  {
    id: "e2000001-0000-4000-8000-000000000001",
    trainerId: "c2000001-0000-4000-8000-000000000001",
    name: "Bench Press",
  },
  {
    id: "e2000001-0000-4000-8000-000000000002",
    trainerId: "c2000001-0000-4000-8000-000000000001",
    name: "Back Squat",
  },
  {
    id: "e2000001-0000-4000-8000-000000000003",
    trainerId: "c2000001-0000-4000-8000-000000000001",
    name: "Plank",
  },
  {
    id: "e2000001-0000-4000-8000-000000000004",
    trainerId: "c2000001-0000-4000-8000-000000000003",
    name: "Barbell Row",
  },
  {
    id: "e2000001-0000-4000-8000-000000000005",
    trainerId: "c2000001-0000-4000-8000-000000000003",
    name: "Romanian Deadlift",
  },
  {
    id: "e2000001-0000-4000-8000-000000000006",
    trainerId: "c2000001-0000-4000-8000-000000000003",
    name: "Lat Pulldown",
  },
] as const;

describe("dev seed fixtures", () => {
  it("pins the E2E exercise IDs after starter catalog provisioning", async () => {
    const { data, error } = await getAdmin()
      .from("exercises")
      .select("id, trainer_id, name")
      .in(
        "id",
        FIXTURE_EXERCISES.map((fixture) => fixture.id),
      );

    expect(error).toBeNull();
    expect(data).toHaveLength(FIXTURE_EXERCISES.length);

    const byId = new Map(
      (data ?? []).map((row: { id: string; trainer_id: string; name: string }) => [row.id, row]),
    );

    for (const fixture of FIXTURE_EXERCISES) {
      expect(byId.get(fixture.id)).toEqual({
        id: fixture.id,
        trainer_id: fixture.trainerId,
        name: fixture.name,
      });
    }
  });
});
