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

function cellAsText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  if (typeof value === "object" && "result" in value) {
    return cellAsText(value.result);
  }
  return "";
}

function toExcelJsBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

async function sheetCellTexts(buffer: Uint8Array): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toExcelJsBuffer(buffer));
  const sheet = workbook.worksheets[0];
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      while (cells.length < colNumber - 1) {
        cells.push("");
      }
      cells.push(cellAsText(cell.value));
    });
    rows.push(cells);
  });
  return rows;
}

describe("transfer xlsx", () => {
  it("round-trips a DTO including null loads, warmup flags, and three phases", async () => {
    const buffer = await encodeTransferXlsx(sample);
    const decoded = await decodeTransferXlsx(buffer);

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.data).toEqual({
      ...sample,
      exercises: [
        { ...sample.exercises[0], sort_order: 0 },
        { ...sample.exercises[1], sort_order: 0 },
        { ...sample.exercises[2], sort_order: 0 },
      ],
    });
  });

  it("exports human layout without machine envelope or sort_order/phase columns", async () => {
    const buffer = await encodeTransferXlsx(sample);
    const rows = await sheetCellTexts(buffer);
    const flat = rows.flat().join("\n");

    expect(flat).not.toContain("schema_version");
    expect(flat).not.toContain("session_template");
    expect(flat).not.toMatch(/\bsort_order\b/);
    expect(rows.some((row) => row[0] === "Warm up")).toBe(true);
    expect(rows.some((row) => row[0] === "Main phase")).toBe(true);
    expect(rows.some((row) => row[0] === "Cooldown")).toBe(true);
    expect(rows.some((row) => row[0] === "Exercise" && row[1] === "Metric")).toBe(true);
    expect(flat).toContain("Reps");
    expect(flat).toContain("Duration");
    expect(flat).toContain("Distance");
  });

  it("imports headers with mixed case and trailing spaces", async () => {
    const buffer = await encodeTransferXlsx(sample);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(toExcelJsBuffer(buffer));
    const sheet = workbook.worksheets[0];

    sheet.eachRow((row) => {
      if (cellAsText(row.getCell(1).value).toLowerCase() === "exercise") {
        row.getCell(1).value = "Exercise ";
        row.getCell(3).value = "Set ";
      }
    });

    const tweaked = Buffer.from(await workbook.xlsx.writeBuffer());
    const decoded = await decodeTransferXlsx(tweaked);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.data.exercises).toHaveLength(3);
  });

  it("maps human metric labels back to machine enums", async () => {
    const buffer = await encodeTransferXlsx(sample);
    const decoded = await decodeTransferXlsx(buffer);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.data.exercises.map((e) => e.default_metric)).toEqual(["time", "reps_weight", "distance"]);
  });

  it("returns issues for a garbled buffer instead of throwing", async () => {
    const result = await decodeTransferXlsx(Buffer.from("not-an-xlsx"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("rejects the old machine column layout with a fix-list", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("session_template");
    sheet.addRow(["name", "Old Layout"]);
    sheet.addRow(["description", ""]);
    sheet.addRow([]);
    sheet.addRow([
      "phase",
      "sort_order",
      "exercise_name",
      "default_metric",
      "set_number",
      "prescribed_reps",
      "prescribed_duration_seconds",
      "prescribed_load_kg",
      "rest_after_seconds",
      "is_warmup",
      "exercise_notes",
    ]);
    sheet.addRow(["main", 0, "Squat", "reps_weight", 1, 5, null, 100, 60, 0, ""]);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await decodeTransferXlsx(buffer);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toMatch(/old column layout/i);
  });

  it("returns issues when data rows appear before any phase title", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("session_template");
    sheet.addRow(["name", "No Phase"]);
    sheet.addRow(["description", ""]);
    sheet.addRow([]);
    sheet.addRow(["Exercise", "Metric", "Set", "Reps", "Duration [s]", "Load [kg]", "Rest [s]", "Is warmup", "Notes"]);
    sheet.addRow(["Squat", "Reps", 1, 5, null, 100, 60, 0, ""]);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await decodeTransferXlsx(buffer);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((issue) => issue.message.includes("before any phase title"))).toBe(true);
  });

  it("assigns sort_order by consecutive exercise blocks within a phase", async () => {
    const interleaved: SessionTemplateTransfer = {
      schema_version: 1,
      kind: "session_template",
      name: "Import Export example",
      description: "Example",
      exercises: [
        {
          name: "Romanian Deadlift",
          default_metric: "reps_weight",
          phase: "warm_up",
          sort_order: 0,
          notes: null,
          sets: [
            {
              prescribed_reps: 10,
              prescribed_duration_seconds: null,
              prescribed_load_kg: 11,
              rest_after_seconds: 26,
              is_warmup: true,
            },
          ],
        },
        {
          name: "Barbell Back Squat",
          default_metric: "reps_weight",
          phase: "main",
          sort_order: 0,
          notes: null,
          sets: [
            {
              prescribed_reps: 8,
              prescribed_duration_seconds: null,
              prescribed_load_kg: 40,
              rest_after_seconds: 90,
              is_warmup: true,
            },
          ],
        },
        {
          name: "Leg Press",
          default_metric: "reps_weight",
          phase: "main",
          sort_order: 1,
          notes: null,
          sets: [
            {
              prescribed_reps: 10,
              prescribed_duration_seconds: null,
              prescribed_load_kg: 1,
              rest_after_seconds: 2,
              is_warmup: false,
            },
          ],
        },
        {
          name: "Treadmill Run",
          default_metric: "time",
          phase: "main",
          sort_order: 2,
          notes: null,
          sets: [
            {
              prescribed_reps: null,
              prescribed_duration_seconds: 125,
              prescribed_load_kg: null,
              rest_after_seconds: null,
              is_warmup: false,
            },
          ],
        },
        {
          name: "Lat Pulldown",
          default_metric: "reps_weight",
          phase: "cool_down",
          sort_order: 0,
          notes: null,
          sets: [
            {
              prescribed_reps: 31,
              prescribed_duration_seconds: null,
              prescribed_load_kg: 1,
              rest_after_seconds: 2,
              is_warmup: false,
            },
          ],
        },
        {
          name: "Hip Thrust",
          default_metric: "reps_weight",
          phase: "cool_down",
          sort_order: 1,
          notes: null,
          sets: [
            {
              prescribed_reps: 10,
              prescribed_duration_seconds: null,
              prescribed_load_kg: 1,
              rest_after_seconds: 1,
              is_warmup: false,
            },
          ],
        },
      ],
    };

    const buffer = await encodeTransferXlsx(interleaved);
    const decoded = await decodeTransferXlsx(buffer);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    expect(decoded.data.exercises.map((e) => `${e.phase}:${e.sort_order}:${e.name}`)).toEqual([
      "warm_up:0:Romanian Deadlift",
      "main:0:Barbell Back Squat",
      "main:1:Leg Press",
      "main:2:Treadmill Run",
      "cool_down:0:Lat Pulldown",
      "cool_down:1:Hip Thrust",
    ]);
  });
});
