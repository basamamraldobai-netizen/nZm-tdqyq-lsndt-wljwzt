export type RawCell = string | number | boolean | Date | null;

export interface SourceRow {
  id: string;
  sourceRowNumber: number;
  rawCells: RawCell[];
  passportName: string;
  receiptNumber: string;
  paidRaw: RawCell;
  remainingRaw: RawCell;
  agentRaw: string;
  statusRaw: string;
  professionRaw: RawCell;
  dateRaw: RawCell;
  noteRaw: string;
  approvedPassportNames?: string[];
}

export interface AgentAlias {
  canonicalName: string;
  aliases: string[];
  approved: boolean;
}

export interface PassportAllocation {
  passportName: string;
  amount: number;
  note?: string;
}

export interface SharedVoucher {
  sourceRowId: string;
  receiptNumber: string;
  totalPaidRaw: RawCell;
  passportNames: string[];
  allocations: PassportAllocation[];
}

export type ReviewIssueKind =
  | "missing-passport"
  | "missing-receipt"
  | "missing-paid"
  | "invalid-paid"
  | "missing-remaining"
  | "invalid-remaining"
  | "composite-passport"
  | "repeated-passport"
  | "reused-receipt"
  | "possible-agent-alias";

export interface ReviewIssue {
  id: string;
  rowId: string;
  kind: ReviewIssueKind;
  severity: "info" | "review" | "warning";
  message: string;
  resolved: boolean;
}

export interface ImportResult {
  fileName: string;
  sheetName: string;
  rows: SourceRow[];
  skippedBlankRows: number;
  rowsWithExtraColumns: number;
}

export interface AgentAliasCandidate {
  normalizedName: string;
  spellings: string[];
  rowIds: string[];
}

export interface AllocationSummary {
  status:
    | "unallocated"
    | "partial"
    | "complete"
    | "invalid-total"
    | "invalid-allocation"
    | "overallocated";
  total: number | null;
  allocated: number;
  unallocated: number | null;
}

export const EXPORT_HEADERS = [
  "اسم الجواز",
  "رقم السند",
  "المبلغ المدفوع",
  "المبلغ المتبقي",
  "اسم الوكيل",
  "حالة الجواز",
  "التاريخ",
  "الملاحظة",
] as const;

const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

export function rawToText(value: RawCell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString("ar");
  return String(value).trim();
}

export function normalizeArabicText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ar");
}

export function normalizeAgentForSuggestion(value: string): string {
  let normalized = normalizeArabicText(value).replace(/[\s.,،؛:_-]/g, "");
  const titles = ["الدكتور", "دكتور", "الدكتورة", "دكتورة", "د."];
  for (const title of titles) {
    if (normalized.startsWith(title)) {
      normalized = normalized.slice(title.length);
      break;
    }
  }
  return normalized;
}

export function parseAmount(value: RawCell): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  let text = value.trim();
  if (!text) return null;

  text = text.replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS[digit] ?? digit);
  text = text.replace(/٬/g, ",").replace(/٫/g, ".");
  text = text.replace(/\s/g, "");

  // Only remove commas when they are unambiguous thousands separators.
  if (/^-?\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(text)) {
    text = text.replace(/,/g, "");
  } else if (/^-?\d+(\.\d{1,2})?$/.test(text)) {
    // Already a plain decimal number.
  } else {
    return null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function splitPassportCandidates(value: string): string[] {
  const text = value.trim();
  if (!text) return [];

  // A split is only a candidate. The original cell is never modified here.
  const pieces = text
    .split(/\s*(?:[+*#;,،؛/\\]|[-‐‑‒–—−])\s*/u)
    .map((piece) => piece.trim())
    .filter(Boolean);
  return pieces.length > 1 ? pieces : [];
}

export function makeSourceRow(
  rowNumber: number,
  rawCells: RawCell[],
  fileToken: string,
): SourceRow {
  const cell = (index: number) => rawCells[index] ?? null;
  return {
    id: `${fileToken}-${rowNumber}`,
    sourceRowNumber: rowNumber,
    rawCells,
    passportName: rawToText(cell(0)),
    receiptNumber: rawToText(cell(1)),
    paidRaw: cell(2),
    remainingRaw: cell(3),
    agentRaw: rawToText(cell(4)),
    statusRaw: rawToText(cell(5)),
    professionRaw: cell(6),
    dateRaw: cell(7),
    noteRaw: rawToText(cell(8)),
  };
}

export function findAgentAliasCandidates(rows: SourceRow[]): AgentAliasCandidate[] {
  const groups = new Map<string, { spellings: Set<string>; rowIds: string[] }>();

  for (const row of rows) {
    const spelling = row.agentRaw.trim();
    const key = normalizeAgentForSuggestion(spelling);
    if (!spelling || !key) continue;
    const group = groups.get(key) ?? { spellings: new Set<string>(), rowIds: [] };
    group.spellings.add(spelling);
    group.rowIds.push(row.id);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.spellings.size > 1)
    .map(([normalizedName, group]) => ({
      normalizedName,
      spellings: [...group.spellings].sort((a, b) => a.localeCompare(b, "ar")),
      rowIds: group.rowIds,
    }))
    .sort((a, b) => b.spellings.length - a.spellings.length);
}

export function buildReviewIssues(rows: SourceRow[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const passportRows = new Map<string, SourceRow[]>();
  const receiptRows = new Map<string, SourceRow[]>();
  const agentCandidates = findAgentAliasCandidates(rows);
  const rowsWithCandidateAgent = new Set(
    agentCandidates.flatMap((candidate) => candidate.rowIds),
  );

  const add = (
    row: SourceRow,
    kind: ReviewIssueKind,
    severity: ReviewIssue["severity"],
    message: string,
  ) => {
    issues.push({
      id: `${row.id}:${kind}`,
      rowId: row.id,
      kind,
      severity,
      message,
      resolved: false,
    });
  };

  for (const row of rows) {
    const passport = normalizeArabicText(row.passportName);
    if (!passport) add(row, "missing-passport", "warning", "اسم الجواز فارغ");
    else if (!splitPassportCandidates(row.passportName).length) {
      const group = passportRows.get(passport) ?? [];
      group.push(row);
      passportRows.set(passport, group);
    }

    if (!row.receiptNumber) add(row, "missing-receipt", "review", "رقم السند فارغ");

    const paidText = rawToText(row.paidRaw);
    if (!paidText) add(row, "missing-paid", "review", "المبلغ المدفوع فارغ");
    else if (parseAmount(row.paidRaw) === null) {
      add(row, "invalid-paid", "review", "صيغة المدفوع تحتاج مراجعة؛ لم تُحوّل تلقائيًا");
    }

    const remainingText = rawToText(row.remainingRaw);
    if (!remainingText) {
      add(row, "missing-remaining", "info", "المبلغ المتبقي غير مسجل");
    } else if (parseAmount(row.remainingRaw) === null) {
      add(
        row,
        "invalid-remaining",
        "review",
        "صيغة المتبقي تحتاج مراجعة؛ لم تُحوّل تلقائيًا",
      );
    }

    if (splitPassportCandidates(row.passportName).length) {
      add(
        row,
        "composite-passport",
        "review",
        "قد يحتوي هذا السجل على أكثر من جواز؛ راجع الأسماء قبل توزيع المبلغ",
      );
    }

    if (row.receiptNumber) {
      const group = receiptRows.get(row.receiptNumber) ?? [];
      group.push(row);
      receiptRows.set(row.receiptNumber, group);
    }

    if (rowsWithCandidateAgent.has(row.id)) {
      add(row, "possible-agent-alias", "info", "صيغة اسم الوكيل قد تطابق صيغة أخرى");
    }
  }

  for (const group of passportRows.values()) {
    if (group.length < 2) continue;
    for (const row of group) {
      add(
        row,
        "repeated-passport",
        "info",
        "ظهر اسم الجواز في سجلات متعددة؛ احتُفظ بكل الحركات",
      );
    }
  }

  for (const group of receiptRows.values()) {
    if (group.length < 2) continue;
    for (const row of group) {
      add(
        row,
        "reused-receipt",
        "review",
        "رقم السند مستخدم في أكثر من سجل؛ تحقق من عدم تكرار الحركة",
      );
    }
  }

  return issues;
}

function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function summarizeAllocation(
  totalRaw: RawCell,
  allocations: PassportAllocation[],
): AllocationSummary {
  const total = parseAmount(totalRaw);
  if (total === null || total < 0) {
    return { status: "invalid-total", total: null, allocated: 0, unallocated: null };
  }

  if (
    allocations.some(
      (item) =>
        !Number.isFinite(Number(item.amount)) ||
        Number(item.amount) < 0 ||
        !Number.isInteger(toMinorUnits(Number(item.amount))),
    )
  ) {
    return {
      status: "invalid-allocation",
      total,
      allocated: 0,
      unallocated: total,
    };
  }

  const allocated = allocations.reduce((sum, item) => {
    const amount = Number(item.amount);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const totalMinor = toMinorUnits(total);
  const allocatedMinor = toMinorUnits(allocated);

  if (allocatedMinor > totalMinor) {
    return {
      status: "overallocated",
      total,
      allocated,
      unallocated: total - allocated,
    };
  }
  if (allocatedMinor === totalMinor) {
    return { status: "complete", total, allocated, unallocated: 0 };
  }
  if (allocatedMinor === 0) {
    return { status: "unallocated", total, allocated: 0, unallocated: total };
  }
  return {
    status: "partial",
    total,
    allocated,
    unallocated: (totalMinor - allocatedMinor) / 100,
  };
}

export function sumAllocatedByPassport(
  allocations: Array<{ sourceRowId: string; allocation: PassportAllocation }>,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of allocations) {
    const key = normalizeArabicText(entry.allocation.passportName);
    const amount = Number(entry.allocation.amount);
    if (!key || !Number.isFinite(amount)) continue;
    totals.set(key, (totals.get(key) ?? 0) + amount);
  }
  return totals;
}
