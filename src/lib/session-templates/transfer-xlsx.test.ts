import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import type { SessionTemplateTransfer } from "@/lib/session-templates/transfer-schema";
import { decodeTransferXlsx, encodeTransferXlsx } from "@/lib/session-templates/transfer-xlsx";

const sample: SessionTemplateTransfer = {
  schema_version: 1,
  kind: "session_template",
  name: "Full Session",
  description: "Three phases",
  exercises: [
    {
      name: "Bike",
      default_metric: "time",
      phase: "warm_up",
      sort_order: 0,
      notes: "easy",
      sets: [
        {
          prescribed_reps: null,
          prescribed_duration_seconds: 300,
          prescribed_load_kg: null,
          rest_after_seconds: 0,
          is_warmup: true,
        },
      ],
    },
    {
      name: "Squat",
      default_metric: "reps_weight",
      phase: "main",
      sort_order: 1,
      notes: null,
      sets: [
        {
          prescribed_reps: 5,
          prescribed_duration_seconds: null,
          prescribed_load_kg: null,
          rest_after_seconds: 120,
          is_warmup: true,
        },
        {
          prescribed_reps: 5,
          prescribed_duration_seconds: null,
          prescribed_load_kg: 100,
          rest_after_seconds: 180,
          is_warmup: false,
        },
      ],
    },
    {
      name: "Walk",
      default_metric: "distance",
      phase: "cool_down",
      sort_order: 2,
      notes: null,
      sets: [
        {
          prescribed_reps: null,
          prescribed_duration_seconds: 600,
          prescribed_load_kg: null,
          rest_after_seconds: null,
          is_warmup: false,
        },
      ],
    },
  ],
};

describe("transfer xlsx", () => {
  it("round-trips a DTO including null loads, warmup flags, and three phases", async () => {
    const buffer = await encodeTransferXlsx(sample);
    const decoded = await decodeTransferXlsx(buffer);

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.data).toEqual(sample);
  });

  it("returns issues for a garbled buffer instead of throwing", async () => {
    const result = await decodeTransferXlsx(Buffer.from("not-an-xlsx"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("returns issues for wrong schema_version", async () => {
    const buffer = await encodeTransferXlsx(sample);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    expect(workbook.worksheets.length).toBeGreaterThan(0);
    workbook.worksheets[0].getRow(1).getCell(2).value = 99;
    const corrupted = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await decodeTransferXlsx(corrupted);
    expect(result.ok).toBe(false);
  });
});
