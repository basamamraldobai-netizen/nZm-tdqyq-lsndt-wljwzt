import * as XLSX from "xlsx";
import {
  EXPORT_HEADERS,
  type AgentAlias,
  type ImportResult,
  type PassportAllocation,
  type RawCell,
  type SourceRow,
  makeSourceRow,
  normalizeAgentForSuggestion,
  rawToText,
} from "./domain";

const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function makeFileToken(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function cellValue(sheet: XLSX.WorkSheet, row: number, column: number): RawCell {
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  const cell = sheet[address];
  if (!cell || cell.v === undefined || cell.v === null) return null;
  if (cell.v instanceof Date) return cell.v;
  if (
    typeof cell.v === "string" ||
    typeof cell.v === "number" ||
    typeof cell.v === "boolean"
  ) {
    return cell.v;
  }
  return String(cell.v);
}

export async function parseWorkbookFile(file: File): Promise<ImportResult> {
  if (!/\.(xlsx|xls|xlsm)$/i.test(file.name)) {
    throw new Error("اختر ملف Excel بصيغة XLSX أو XLS أو XLSM.");
  }

  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: false,
    cellNF: false,
    cellText: false,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("لم أجد ورقة عمل داخل الملف.");

  const sheet = workbook.Sheets[sheetName];
  const reference = sheet["!ref"];
  if (!reference) throw new Error("ورقة العمل الأولى فارغة.");

  const range = XLSX.utils.decode_range(reference);
  const rows: SourceRow[] = [];
  let skippedBlankRows = 0;
  let rowsWithExtraColumns = 0;
  const fileToken = makeFileToken();

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const rawCells: RawCell[] = Array.from(
      { length: range.e.c + 1 },
      () => null,
    );
    let hasValue = false;
    let hasExtraValue = false;

    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const value = cellValue(sheet, rowIndex, columnIndex);
      rawCells[columnIndex] = value;
      if (rawToText(value)) {
        hasValue = true;
        if (columnIndex > 8) hasExtraValue = true;
      }
    }

    if (!hasValue) {
      skippedBlankRows += 1;
      continue;
    }
    if (hasExtraValue) rowsWithExtraColumns += 1;

    rows.push(
      makeSourceRow(rowIndex + 1, rawCells, fileToken),
    );
  }

  if (rows.length === 0) throw new Error("لم أجد سجلات غير فارغة في ورقة العمل.");

  return {
    fileName: file.name,
    sheetName,
    rows,
    skippedBlankRows,
    rowsWithExtraColumns,
  };
}

function approvedAgentName(
  rawName: string,
  aliases: AgentAlias[],
): string {
  const normalized = normalizeAgentForSuggestion(rawName);
  if (!normalized) return rawName;

  for (const mapping of aliases) {
    if (!mapping.approved) continue;
    const names = [mapping.canonicalName, ...mapping.aliases];
    if (names.some((name) => normalizeAgentForSuggestion(name) === normalized)) {
      return mapping.canonicalName;
    }
  }
  return rawName;
}

function makeTransactionSheet(rows: SourceRow[], aliases: AgentAlias[]) {
  const data: (string | number | boolean | Date | null)[][] = [
    [...EXPORT_HEADERS],
  ];

  for (const row of rows) {
    data.push([
      row.rawCells[0] ?? "",
      row.rawCells[1] ?? "",
      row.rawCells[2] ?? "",
      row.rawCells[3] ?? "",
      approvedAgentName(row.agentRaw, aliases),
      row.rawCells[5] ?? "",
      row.rawCells[7] ?? "",
      row.rawCells[8] ?? "",
    ]);
  }

  return XLSX.utils.aoa_to_sheet(data);
}

function makeAllocationSheet(
  chunk: SourceRow[],
  allocationMap: Record<string, PassportAllocation[]>,
) {
  const ids = new Set(chunk.map((row) => row.id));
  const data: (string | number)[][] = [
    ["صف المصدر", "رقم السند", "اسم الجواز", "الحصة الموزعة", "ملاحظة"],
  ];

  for (const row of chunk) {
    if (!ids.has(row.id)) continue;
    for (const allocation of allocationMap[row.id] ?? []) {
      data.push([
        row.sourceRowNumber,
        row.receiptNumber,
        allocation.passportName,
        allocation.amount,
        allocation.note ?? "",
      ]);
    }
  }
  return XLSX.utils.aoa_to_sheet(data);
}

export interface ExportOptions {
  rows: SourceRow[];
  aliases?: AgentAlias[];
  allocations?: Record<string, PassportAllocation[]>;
  fileName?: string;
  maxRowsPerFile?: number;
}

export function downloadReviewedWorkbooks({
  rows,
  aliases = [],
  allocations = {},
  fileName = "تدقيق_السندات",
  maxRowsPerFile = 3000,
}: ExportOptions): number {
  if (rows.length === 0) throw new Error("لا توجد سجلات جاهزة للتصدير.");
  if (!Number.isInteger(maxRowsPerFile) || maxRowsPerFile < 1) {
    throw new Error("عدد السجلات لكل ملف غير صالح.");
  }

  const safeName = fileName
    .replace(/\.(xlsx|xls|xlsm)$/i, "")
    .replace(/[\\/:*?"<>|]/g, "_");
  const chunks: SourceRow[][] = [];
  for (let index = 0; index < rows.length; index += maxRowsPerFile) {
    chunks.push(rows.slice(index, index + maxRowsPerFile));
  }

  chunks.forEach((chunk, index) => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      makeTransactionSheet(chunk, aliases),
      "المعاملات",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      makeAllocationSheet(chunk, allocations),
      "توزيعات السندات",
    );

    const output = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
      compression: true,
    });
    const blob = new Blob([new Uint8Array(output)], { type: EXCEL_MIME });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeName}_${index + 1}.xlsx`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  return chunks.length;
}

