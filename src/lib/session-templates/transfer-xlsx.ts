import ExcelJS from "exceljs";

import {
  parseSessionTemplateTransfer,
  type SessionTemplateTransfer,
  type TransferIssue,
} from "@/lib/session-templates/transfer-schema";

const SHEET_NAME = "session_template";

const DATA_HEADERS = [
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
] as const;

type DataHeader = (typeof DATA_HEADERS)[number];

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

function isDataHeader(value: string): value is DataHeader {
  return (DATA_HEADERS as readonly string[]).includes(value);
}

export async function encodeTransferXlsx(document: SessionTemplateTransfer): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(SHEET_NAME);

  sheet.addRow(["schema_version", document.schema_version]);
  sheet.addRow(["kind", document.kind]);
  sheet.addRow(["name", document.name]);
  sheet.addRow(["description", document.description ?? ""]);
  sheet.addRow([]);
  sheet.addRow([...DATA_HEADERS]);

  const exercises = document.exercises.slice().sort((a, b) => a.sort_order - b.sort_order);
  for (const exercise of exercises) {
    exercise.sets.forEach((set, index) => {
      sheet.addRow([
        exercise.phase,
        exercise.sort_order,
        exercise.name,
        exercise.default_metric,
        index + 1,
        set.prescribed_reps,
        set.prescribed_duration_seconds,
        set.prescribed_load_kg,
        set.rest_after_seconds,
        set.is_warmup,
        exercise.notes ?? "",
      ]);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function decodeTransferXlsx(
  input: Buffer,
): Promise<{ ok: true; data: SessionTemplateTransfer } | { ok: false; issues: TransferIssue[] }> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(input);

    const sheets = workbook.worksheets;
    const sheet = workbook.getWorksheet(SHEET_NAME) ?? (sheets.length > 0 ? sheets[0] : undefined);
    if (sheet === undefined) {
      return { ok: false, issues: [{ path: "sheet", message: "Workbook has no worksheet" }] };
    }

    const meta = new Map<string, string>();
    let headerRowNumber = 0;

    for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const first = cellText(row.getCell(1).value);
      if (isDataHeader(first)) {
        headerRowNumber = rowNumber;
        break;
      }
      if (first === "schema_version" || first === "kind" || first === "name" || first === "description") {
        meta.set(first, cellText(row.getCell(2).value));
      }
    }

    if (headerRowNumber === 0) {
      return { ok: false, issues: [{ path: "sheet", message: "Missing data header row" }] };
    }

    const headerRow = sheet.getRow(headerRowNumber);
    const headerIndex = new Map<DataHeader, number>();
    headerRow.eachCell((cell, colNumber) => {
      const key = cellText(cell.value);
      if (isDataHeader(key)) {
        headerIndex.set(key, colNumber);
      }
    });

    for (const required of DATA_HEADERS) {
      if (!headerIndex.has(required)) {
        return {
          ok: false,
          issues: [{ path: "headers", message: `Missing column ${required}` }],
        };
      }
    }

    interface AccExercise {
      name: string;
      default_metric: string;
      phase: string;
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

    const exerciseMap = new Map<string, AccExercise>();

    for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const nameCol = headerIndex.get("exercise_name");
      const phaseCol = headerIndex.get("phase");
      const sortCol = headerIndex.get("sort_order");
      const metricCol = headerIndex.get("default_metric");
      const notesCol = headerIndex.get("exercise_notes");
      const setNumberCol = headerIndex.get("set_number");
      const repsCol = headerIndex.get("prescribed_reps");
      const durationCol = headerIndex.get("prescribed_duration_seconds");
      const loadCol = headerIndex.get("prescribed_load_kg");
      const restCol = headerIndex.get("rest_after_seconds");
      const warmupCol = headerIndex.get("is_warmup");

      if (
        nameCol === undefined ||
        phaseCol === undefined ||
        sortCol === undefined ||
        metricCol === undefined ||
        notesCol === undefined ||
        setNumberCol === undefined ||
        repsCol === undefined ||
        durationCol === undefined ||
        loadCol === undefined ||
        restCol === undefined ||
        warmupCol === undefined
      ) {
        continue;
      }

      const exerciseName = cellText(row.getCell(nameCol).value);
      if (exerciseName === "") {
        continue;
      }

      const phase = cellText(row.getCell(phaseCol).value);
      const sortOrder = cellNumber(row.getCell(sortCol).value) ?? 0;
      const key = `${phase}::${sortOrder}::${exerciseName}`;

      let exercise = exerciseMap.get(key);
      if (!exercise) {
        const notesRaw = cellText(row.getCell(notesCol).value);
        exercise = {
          name: exerciseName,
          default_metric: cellText(row.getCell(metricCol).value),
          phase,
          sort_order: sortOrder,
          notes: notesRaw === "" ? null : notesRaw,
          sets: [],
        };
        exerciseMap.set(key, exercise);
      }

      exercise.sets.push({
        set_number: cellNumber(row.getCell(setNumberCol).value) ?? exercise.sets.length + 1,
        prescribed_reps: cellNumber(row.getCell(repsCol).value),
        prescribed_duration_seconds: cellNumber(row.getCell(durationCol).value),
        prescribed_load_kg: cellNumber(row.getCell(loadCol).value),
        rest_after_seconds: cellNumber(row.getCell(restCol).value),
        is_warmup: cellBoolean(row.getCell(warmupCol).value),
      });
    }

    const exercises = [...exerciseMap.values()]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((exercise) => ({
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
      }));

    const schemaVersionRaw = meta.get("schema_version");
    const kindRaw = meta.get("kind");
    const nameRaw = meta.get("name");
    const descriptionRaw = meta.get("description");

    const candidate = {
      schema_version: schemaVersionRaw === undefined ? Number.NaN : Number(schemaVersionRaw),
      kind: kindRaw ?? "",
      name: nameRaw ?? "",
      description: descriptionRaw === undefined || descriptionRaw === "" ? null : descriptionRaw,
      exercises,
    };

    return parseSessionTemplateTransfer(candidate);
  } catch {
    return {
      ok: false,
      issues: [{ path: "file", message: "Could not read xlsx workbook" }],
    };
  }
}
