import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const STARTER_MIGRATION = resolve(process.cwd(), "supabase/migrations/20260620140200_starter_exercise_seed.sql");
const DEV_SEED = resolve(process.cwd(), "scripts/seed-dev-users.sql");

function starterCatalogNames(sql: string): string[] {
  const end = sql.indexOf(") as starter_catalog");
  const valuesIdx = sql.lastIndexOf("values", end);
  const block = sql.slice(valuesIdx, end);
  return [...block.matchAll(/\(\s*'((?:\\'|[^'])*)'/g)].map((match) => match[1]);
}

function fixtureExercises(sql: string): { trainerId: string; name: string }[] {
  const values = /insert into public\.exercises \(id, trainer_id, name[\s\S]*?values([\s\S]*?);/.exec(sql)?.[1];
  if (!values) {
    throw new Error("Could not find fixture exercise insert in seed-dev-users.sql");
  }

  return [...values.matchAll(/\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'/g)].map((match) => ({
    trainerId: match[2],
    name: match[3],
  }));
}

describe("dev seed vs unique exercise names", () => {
  it("removes starter-catalog rows before inserting pinned fixture names", () => {
    const starterSql = readFileSync(STARTER_MIGRATION, "utf8");
    const seedSql = readFileSync(DEV_SEED, "utf8");

    const starterNames = new Set(starterCatalogNames(starterSql).map((name) => name.toLowerCase()));
    const fixtures = fixtureExercises(seedSql);
    const collisions = fixtures.filter((fixture) => starterNames.has(fixture.name.toLowerCase()));

    expect(collisions.map((fixture) => fixture.name)).toEqual([
      "Bench Press",
      "Plank",
      "Barbell Row",
      "Romanian Deadlift",
      "Lat Pulldown",
    ]);

    const deleteSql = /delete from public\.exercises[\s\S]*?;/.exec(seedSql)?.[0] ?? "";
    const insertIdx = seedSql.indexOf("insert into public.exercises (id, trainer_id, name");
    const deleteIdx = seedSql.indexOf("delete from public.exercises");

    expect(deleteSql).not.toBe("");
    expect(deleteIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeLessThan(insertIdx);

    for (const fixture of fixtures) {
      expect(deleteSql).toContain(fixture.trainerId);
      expect(deleteSql).toContain(fixture.name.toLowerCase());
    }
  });
});
