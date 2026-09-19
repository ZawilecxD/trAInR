import ExcelJS from "exceljs";

import { comparePhaseThenSortOrder, TRANSFER_PHASE_ORDER } from "@/lib/session-templates/transfer-order";
import {
  parseSessionTemplateTransfer,
  type SessionTemplateTransfer,
  type TransferIssue,
} from "@/lib/session-templates/transfer-schema";
import type { ExerciseMetric, ExercisePhase } from "@/types";

const SHEET_NAME = "session_template";

const PHASE_EXPORT_TITLES: Record<ExercisePhase, string> = {
  warm_up: "Warm up",
  main: "Main phase",
  cool_down: "Cooldown",
};

const METRIC_EXPORT_LABELS: Record<ExerciseMetric, string> = {
  reps_weight: "Reps",
  time: "Duration",
  distance: "Distance",
};

/** Canonical header keys used after case-insensitive + trim normalization. */
const HEADER_KEYS = [
  "exercise",
  "metric",
  "set",
  "reps",
  "duration [s]",
  "load [kg]",
  "rest [s]",
  "is warmup",
  "notes",
] as const;

type HeaderKey = (typeof HEADER_KEYS)[number];

const HEADER_EXPORT_LABELS: Record<HeaderKey, string> = {
  exercise: "Exercise",
  metric: "Metric",
  set: "Set",
  reps: "Reps",
  "duration [s]": "Duration [s]",
  "load [kg]": "Load [kg]",
  "rest [s]": "Rest [s]",
  "is warmup": "Is warmup",
  notes: "Notes",
};

const PHASE_ALIASES: Record<string, ExercisePhase> = {
  "warm up": "warm_up",
  "warm-up": "warm_up",
  warmup: "warm_up",
  warm_up: "warm_up",
  main: "main",
  "main phase": "main",
  cooldown: "cool_down",
  "cool down": "cool_down",
  "cool-down": "cool_down",
  cool_down: "cool_down",
};

const METRIC_ALIASES: Record<string, ExerciseMetric> = {
  reps: "reps_weight",
  reps_weight: "reps_weight",
  "reps & weight": "reps_weight",
  "reps and weight": "reps_weight",
  duration: "time",
  time: "time",
  distance: "distance",
};

const OLD_LAYOUT_MARKERS = ["phase", "sort_order", "exercise_name", "default_metric"] as const;

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function cellText(value: ExcelJS.CellValue): string {
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
    return cellText(value.result);
  }
  return "";
}

function cellNumber(value: ExcelJS.CellValue): number | null {
  const text = cellText(value);
  if (text === "") {
    return null;
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function cellBoolean(value: ExcelJS.CellValue): boolean {
  const text = cellText(value).toLowerCase();
  if (text === "" || text === "false" || text === "0") {
    return false;
  }
  if (text === "true" || text === "1") {
    return true;
  }
  return Boolean(value);
}

function rowIsBlank(row: ExcelJS.Row): boolean {
  let blank = true;
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (cellText(cell.value) !== "") {
      blank = false;
    }
  });
  return blank;
}

function rowHasOnlyFirstColumn(row: ExcelJS.Row): boolean {
  const first = cellText(row.getCell(1).value);
  if (first === "") {
    return false;
  }
  let onlyFirst = true;
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (colNumber > 1 && cellText(cell.value) !== "") {
      onlyFirst = false;
    }
  });
  return onlyFirst;
}

function parseHeaderIndex(row: ExcelJS.Row): Map<HeaderKey, number> | null {
  const index = new Map<HeaderKey, number>();
  row.eachCell((cell, colNumber) => {
    const key = normalizeKey(cellText(cell.value));
    if ((HEADER_KEYS as readonly string[]).includes(key)) {
      index.set(key as HeaderKey, colNumber);
    }
  });
  for (const required of HEADER_KEYS) {
    if (!index.has(required)) {
      return null;
    }
  }
  return index;
}

function looksLikeOldLayoutHeader(row: ExcelJS.Row): boolean {
  const values = new Set<string>();
  row.eachCell((cell) => {
    values.add(normalizeKey(cellText(cell.value)));
  });
  return OLD_LAYOUT_MARKERS.every((marker) => values.has(marker));
}

function resolvePhaseTitle(text: string): ExercisePhase | null {
  return PHASE_ALIASES[normalizeKey(text)] ?? null;
}

function resolveMetric(text: string): ExerciseMetric | null {
  return METRIC_ALIASES[normalizeKey(text)] ?? null;
}

export async function encodeTransferXlsx(document: SessionTemplateTransfer): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(SHEET_NAME);

  sheet.addRow(["name", document.name]);
  sheet.addRow(["description", document.description ?? ""]);
  sheet.addRow([]);

  const exercises = document.exercises.slice().sort(comparePhaseThenSortOrder);
  const headerRow = HEADER_KEYS.map((key) => HEADER_EXPORT_LABELS[key]);

  for (const phase of TRANSFER_PHASE_ORDER) {
    const phaseExercises = exercises.filter((exercise) => exercise.phase === phase);
    if (phaseExercises.length === 0) {
      continue;
    }

    sheet.addRow([PHASE_EXPORT_TITLES[phase]]);
    sheet.addRow([...headerRow]);

    for (const exercise of phaseExercises) {
      exercise.sets.forEach((set, index) => {
        sheet.addRow([
          exercise.name,
          METRIC_EXPORT_LABELS[exercise.default_metric],
          index + 1,
          set.prescribed_reps,
          set.prescribed_duration_seconds,
          set.prescribed_load_kg,
          set.rest_after_seconds,
          set.is_warmup ? 1 : 0,
          exercise.notes ?? "",
        ]);
      });
    }

    sheet.addRow([]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** ExcelJS `load` is typed against ArrayBuffer, not Node's Buffer. */
function toExcelJsBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export async function decodeTransferXlsx(
  input: Uint8Array,
): Promise<{ ok: true; data: SessionTemplateTransfer } | { ok: false; issues: TransferIssue[] }> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(toExcelJsBuffer(input));

    const sheets = workbook.worksheets;
    const sheet = workbook.getWorksheet(SHEET_NAME) ?? (sheets.length > 0 ? sheets[0] : undefined);
    if (sheet === undefined) {
      return { ok: false, issues: [{ path: "sheet", message: "Workbook has no worksheet" }] };
    }

    const meta = new Map<string, string>();
    let currentPhase: ExercisePhase | null = null;
    let headerIndex: Map<HeaderKey, number> | null = null;
    let nextSortOrder = 0;
    let lastExerciseName: string | null = null;

    interface AccExercise {
      name: string;
      default_metric: ExerciseMetric;
      phase: ExercisePhase;
      sort_order: number;
      notes: string | null;
      sets: {
        set_number: number;
        prescribed_reps: number | null;
        prescribed_duration_seconds: number | null;
        prescribed_load_kg: number | null;
        rest_after_seconds: number | null;
        is_warmup: boolean;
      }[];
    }

    const exercises: AccExercise[] = [];
    const issues: TransferIssue[] = [];

    for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      if (rowIsBlank(row)) {
        continue;
      }

      const first = cellText(row.getCell(1).value);
      const firstKey = normalizeKey(first);

      if (looksLikeOldLayoutHeader(row)) {
        return {
          ok: false,
          issues: [
            {
              path: "headers",
              message:
                "This file uses the old column layout (phase/sort_order). Re-export from the app to get the current format.",
            },
          ],
        };
      }

      if (firstKey === "schema_version" || firstKey === "kind") {
        continue;
      }

      if (firstKey === "name" || firstKey === "description") {
        meta.set(firstKey, cellText(row.getCell(2).value));
        continue;
      }

      const parsedHeaders = parseHeaderIndex(row);
      if (parsedHeaders) {
        headerIndex = parsedHeaders;
        continue;
      }

      if (rowHasOnlyFirstColumn(row)) {
        const phase = resolvePhaseTitle(first);
        if (phase === null) {
          issues.push({
            path: `row.${rowNumber}`,
            message: `Unknown phase title "${first}"`,
          });
          continue;
        }
        currentPhase = phase;
        headerIndex = null;
        nextSortOrder = 0;
        lastExerciseName = null;
        continue;
      }

      if (headerIndex === null) {
        if (first !== "") {
          issues.push({
            path: `row.${rowNumber}`,
            message: "Data row found before a column header under a phase title",
          });
        }
        continue;
      }

      if (currentPhase === null) {
        issues.push({
          path: `row.${rowNumber}`,
          message: "Data row found before any phase title",
        });
        continue;
      }

      const exerciseCol = headerIndex.get("exercise");
      const metricCol = headerIndex.get("metric");
      const setCol = headerIndex.get("set");
      const repsCol = headerIndex.get("reps");
      const durationCol = headerIndex.get("duration [s]");
      const loadCol = headerIndex.get("load [kg]");
      const restCol = headerIndex.get("rest [s]");
      const warmupCol = headerIndex.get("is warmup");
      const notesCol = headerIndex.get("notes");

      if (
        exerciseCol === undefined ||
        metricCol === undefined ||
        setCol === undefined ||
        repsCol === undefined ||
        durationCol === undefined ||
        loadCol === undefined ||
        restCol === undefined ||
        warmupCol === undefined ||
        notesCol === undefined
      ) {
        continue;
      }

      const exerciseName = cellText(row.getCell(exerciseCol).value);
      if (exerciseName === "") {
        continue;
      }

      const metricRaw = cellText(row.getCell(metricCol).value);
      const metric = resolveMetric(metricRaw);
      if (metric === null) {
        issues.push({
          path: `row.${rowNumber}.metric`,
          message: `Unknown metric "${metricRaw}"`,
        });
        continue;
      }

      if (lastExerciseName === null || lastExerciseName !== exerciseName) {
        const notesRaw = cellText(row.getCell(notesCol).value);
        exercises.push({
          name: exerciseName,
          default_metric: metric,
          phase: currentPhase,
          sort_order: nextSortOrder,
          notes: notesRaw === "" ? null : notesRaw,
          sets: [],
        });
        nextSortOrder += 1;
        lastExerciseName = exerciseName;
      }

      const current = exercises[exercises.length - 1];
      current.sets.push({
        set_number: cellNumber(row.getCell(setCol).value) ?? current.sets.length + 1,
        prescribed_reps: cellNumber(row.getCell(repsCol).value),
        prescribed_duration_seconds: cellNumber(row.getCell(durationCol).value),
        prescribed_load_kg: cellNumber(row.getCell(loadCol).value),
        rest_after_seconds: cellNumber(row.getCell(restCol).value),
        is_warmup: cellBoolean(row.getCell(warmupCol).value),
      });
    }

    if (issues.length > 0) {
      return { ok: false, issues };
    }

    const candidate = {
      schema_version: 1 as const,
      kind: "session_template" as const,
      name: meta.get("name") ?? "",
      description: (() => {
        const raw = meta.get("description");
        return raw === undefined || raw === "" ? null : raw;
      })(),
      exercises: exercises.map((exercise) => ({
        name: exercise.name,
        default_metric: exercise.default_metric,
        phase: exercise.phase,
        sort_order: exercise.sort_order,
        notes: exercise.notes,
        sets: exercise.sets
          .slice()
          .sort((a, b) => a.set_number - b.set_number)
          .map((set) => ({
            prescribed_reps: set.prescribed_reps,
            prescribed_duration_seconds: set.prescribed_duration_seconds,
            prescribed_load_kg: set.prescribed_load_kg,
            rest_after_seconds: set.rest_after_seconds,
            is_warmup: set.is_warmup,
          })),
      })),
    };

    return parseSessionTemplateTransfer(candidate);
  } catch {
    return {
      ok: false,
      issues: [{ path: "file", message: "Could not read xlsx workbook" }],
    };
  }
}
