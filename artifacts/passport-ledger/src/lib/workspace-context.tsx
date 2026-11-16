import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  buildReviewIssues,
  findAgentAliasCandidates,
  normalizeAgentForSuggestion,
  normalizeArabicText,
  parseAmount,
  rawToText,
  summarizeAllocation,
  type AgentAlias,
  type AgentAliasCandidate,
  type ImportResult,
  type PassportAllocation,
  type ReviewIssue,
  type SourceRow,
} from "./domain";
import {
  clearLocalWorkspace,
  loadLocalWorkspace,
  saveLocalWorkspace,
  type AuditEvent,
} from "./local-store";
import { parseWorkbookFile } from "./workbook";

interface SaveAllocationResult {
  ok: boolean;
  message: string;
}

export interface EditableRowValues {
  passportName: string;
  receiptNumber: string;
  paidRaw: string;
  remainingRaw: string;
  agentRaw: string;
  statusRaw: string;
  dateRaw: string;
  noteRaw: string;
}

interface WorkspaceContextValue {
  rows: SourceRow[];
  fileName: string;
  sheetName: string;
  firstRowIsHeader: boolean;
  issues: ReviewIssue[];
  agentAliases: AgentAlias[];
  agentCandidates: AgentAliasCandidate[];
  allocations: Record<string, PassportAllocation[]>;
  auditEvents: AuditEvent[];
  skippedBlankRows: number;
  rowsWithExtraColumns: number;
  isReady: boolean;
  isSaving: boolean;
  savedAt: string | null;
  storageError: string | null;
  importError: string | null;
  importFile: (file: File, firstRowIsHeader?: boolean) => Promise<ImportResult>;
  approveAgentAlias: (
    candidate: AgentAliasCandidate,
    canonicalName: string,
  ) => void;
  addManualAgentAlias: (canonicalName: string, aliases: string[]) => boolean;
  removeAgentAlias: (normalizedName?: string) => void;
  approvePassportSplit: (rowId: string, names: string[]) => boolean;
  updateSourceRow: (rowId: string, values: EditableRowValues) => boolean;
  saveVoucherAllocations: (
    rowId: string,
    allocations: PassportAllocation[],
  ) => SaveAllocationResult;
  markIssueResolved: (issueId: string, sourceRowNumber?: number) => void;
  clearWorkspace: () => Promise<void>;
  getAgentDisplayName: (rawName: string) => string;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(false);
  const [agentAliases, setAgentAliases] = useState<AgentAlias[]>([]);
  const [allocations, setAllocations] = useState<
    Record<string, PassportAllocation[]>
  >({});
  const [resolvedIssueIds, setResolvedIssueIds] = useState<string[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [skippedBlankRows, setSkippedBlankRows] = useState(0);
  const [rowsWithExtraColumns, setRowsWithExtraColumns] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLocalWorkspace()
      .then((workspace) => {
        if (cancelled || !workspace) return;
        setRows(workspace.rows ?? []);
        setFileName(workspace.fileName ?? "");
        setSheetName(workspace.sheetName ?? "");
        setFirstRowIsHeader(workspace.firstRowIsHeader ?? false);
        setAgentAliases(workspace.agentAliases ?? []);
        setAllocations(workspace.allocations ?? {});
        setResolvedIssueIds(workspace.resolvedIssueIds ?? []);
        setAuditEvents(workspace.auditEvents ?? []);
        setSkippedBlankRows(workspace.skippedBlankRows ?? 0);
        setRowsWithExtraColumns(workspace.rowsWithExtraColumns ?? 0);
        setSavedAt(workspace.updatedAt ?? null);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStorageError(
            error instanceof Error
              ? error.message
              : "تعذر قراءة البيانات المحلية.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isReady || rows.length === 0) return;

    const timer = window.setTimeout(() => {
      setIsSaving(true);
      saveLocalWorkspace({
        fileName,
        sheetName,
        firstRowIsHeader,
        rows,
        agentAliases,
        allocations,
        approvedSplits: Object.fromEntries(
          rows
            .filter((row) => row.approvedPassportNames?.length)
            .map((row) => [row.id, row.approvedPassportNames ?? []]),
        ),
        resolvedIssueIds,
        auditEvents,
        skippedBlankRows,
        rowsWithExtraColumns,
      })
        .then((workspace) => {
          setSavedAt(workspace.updatedAt);
          setStorageError(null);
        })
        .catch((error: unknown) => {
          setStorageError(
            error instanceof Error
              ? error.message
              : "تعذر حفظ التعديلات على هذا الجهاز.",
          );
        })
        .finally(() => setIsSaving(false));
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    isReady,
    rows,
    fileName,
    sheetName,
    firstRowIsHeader,
    agentAliases,
    allocations,
    resolvedIssueIds,
    auditEvents,
    skippedBlankRows,
    rowsWithExtraColumns,
  ]);

  const addAuditEvent = useCallback(
    (action: string, summary: string, sourceRowNumber?: number) => {
      setAuditEvents((current) => [
        {
          id: makeId(),
          at: new Date().toISOString(),
          action,
          summary,
          ...(sourceRowNumber ? { sourceRowNumber } : {}),
        },
        ...current,
      ].slice(0, 300));
    },
    [],
  );

  const importFile = useCallback(
    async (file: File, skipHeader = false) => {
      setImportError(null);
      const result = await parseWorkbookFile(file, skipHeader);
      setRows(result.rows);
      setFileName(result.fileName);
      setSheetName(result.sheetName);
      setFirstRowIsHeader(skipHeader);
      setAgentAliases([]);
      setAllocations({});
      setResolvedIssueIds([]);
      setSkippedBlankRows(result.skippedBlankRows);
      setRowsWithExtraColumns(result.rowsWithExtraColumns);
      setAuditEvents([
        {
          id: makeId(),
          at: new Date().toISOString(),
          action: "استيراد ملف",
          summary: `تم استيراد ${result.rows.length.toLocaleString("ar")} سجلًا من الورقة الأولى`,
        },
      ]);
      return result;
    },
    [],
  );

  const issues = useMemo(
    () =>
      buildReviewIssues(rows).map((issue) => ({
        ...issue,
        resolved: resolvedIssueIds.includes(issue.id),
      })),
    [rows, resolvedIssueIds],
  );

  const agentCandidates = useMemo(() => {
    const candidates = findAgentAliasCandidates(rows);
    return candidates.filter(
      (candidate) =>
        !agentAliases.some(
          (mapping) =>
            mapping.approved &&
            candidate.spellings.every((spelling) =>
              [mapping.canonicalName, ...mapping.aliases].some(
                (name) =>
                  normalizeAgentForSuggestion(name) ===
                  normalizeAgentForSuggestion(spelling),
              ),
            ),
        ),
    );
  }, [rows, agentAliases]);

  const approveAgentAlias = useCallback(
    (candidate: AgentAliasCandidate, canonicalName: string) => {
      const selectedName = canonicalName.trim();
      if (!candidate.spellings.includes(selectedName)) return;

      setAgentAliases((current) => [
        ...current.filter(
          (mapping) =>
            mapping.normalizedName !== candidate.normalizedName,
        ),
        {
          canonicalName: selectedName,
          aliases: candidate.spellings.filter((name) => name !== selectedName),
          approved: true,
          normalizedName: candidate.normalizedName,
        },
      ]);
      setResolvedIssueIds((current) => [
        ...new Set([
          ...current,
          ...candidate.rowIds.map((rowId) => `${rowId}:possible-agent-alias`),
        ]),
      ]);
      addAuditEvent("اعتماد اسم وكيل", "تم اعتماد ربط صيغ اسم وكيل يدويًا");
    },
    [addAuditEvent],
  );

  const addManualAgentAlias = useCallback(
    (canonicalName: string, aliases: string[]) => {
      const canonical = canonicalName.trim();
      const cleanedAliases = [
        ...new Set(
          aliases
            .map((alias) => alias.trim())
            .filter(
              (alias) =>
                alias &&
                normalizeAgentForSuggestion(alias) !==
                  normalizeAgentForSuggestion(canonical),
            ),
        ),
      ];
      if (!canonical || cleanedAliases.length === 0) return false;

      const mapping: AgentAlias = {
        canonicalName: canonical,
        aliases: cleanedAliases,
        approved: true,
        normalizedName: normalizeAgentForSuggestion(canonical),
      };
      setAgentAliases((current) => [
        ...current.filter(
          (item) =>
            item.normalizedName !== mapping.normalizedName &&
            !item.aliases.some((alias) =>
              cleanedAliases.some(
                (nextAlias) =>
                  normalizeAgentForSuggestion(nextAlias) ===
                  normalizeAgentForSuggestion(alias),
              ),
            ),
        ),
        mapping,
      ]);

      const variants = new Set(
        [canonical, ...cleanedAliases].map(normalizeAgentForSuggestion),
      );
      const matchedRows = rows.filter((row) =>
        variants.has(normalizeAgentForSuggestion(row.agentRaw)),
      );
      setResolvedIssueIds((current) => [
        ...new Set([
          ...current,
          ...matchedRows.map((row) => `${row.id}:possible-agent-alias`),
        ]),
      ]);
      addAuditEvent("اعتماد أسماء وكيل", "تم اعتماد ربط يدوي لصيغ اسم وكيل");
      return true;
    },
    [rows, addAuditEvent],
  );

  const removeAgentAlias = useCallback(
    (normalizedName?: string) => {
      if (!normalizedName) return;
      setAgentAliases((current) =>
        current.filter((mapping) => mapping.normalizedName !== normalizedName),
      );
      addAuditEvent(
        "إلغاء توحيد اسم وكيل",
        "أُعيدت صيغ الاسم إلى قيمها الأصلية للعرض والتصدير",
      );
    },
    [addAuditEvent],
  );

  const approvePassportSplit = useCallback(
    (rowId: string, names: string[]) => {
      const row = rows.find((item) => item.id === rowId);
      const cleaned = names.map((name) => name.trim()).filter(Boolean);
      if (!row || cleaned.length < 2) return false;
      if (new Set(cleaned.map(normalizeArabicText)).size !== cleaned.length) {
        return false;
      }
      setRows((current) =>
        current.map((item) =>
          item.id === rowId
            ? { ...item, approvedPassportNames: cleaned }
            : item,
        ),
      );
      setResolvedIssueIds((current) => [
        ...new Set([...current, `${rowId}:composite-passport`]),
      ]);
      addAuditEvent(
        "اعتماد أسماء سند مشترك",
        `تم اعتماد ${cleaned.length} أسماء للسند دون توزيع المبلغ`,
        row.sourceRowNumber,
      );
      return true;
    },
    [rows, addAuditEvent],
  );

  const updateSourceRow = useCallback(
    (rowId: string, values: EditableRowValues) => {
      const row = rows.find((item) => item.id === rowId);
      if (!row) return false;

      const amountCell = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        return parseAmount(trimmed) ?? trimmed;
      };

      setRows((current) =>
        current.map((item) =>
          item.id === rowId
            ? {
                ...item,
                passportName: values.passportName.trim(),
                receiptNumber: values.receiptNumber.trim(),
                paidRaw: amountCell(values.paidRaw),
                remainingRaw: amountCell(values.remainingRaw),
                agentRaw: values.agentRaw.trim(),
                statusRaw: values.statusRaw.trim(),
                dateRaw: values.dateRaw.trim(),
                noteRaw: values.noteRaw.trim(),
              }
            : item,
        ),
      );

      const changedFields: string[] = [];
      if (values.passportName.trim() !== row.passportName) changedFields.push("اسم الجواز");
      if (values.receiptNumber.trim() !== row.receiptNumber) changedFields.push("رقم السند");
      if (rawToText(row.paidRaw) !== values.paidRaw.trim()) changedFields.push("المبلغ المدفوع");
      if (rawToText(row.remainingRaw) !== values.remainingRaw.trim()) changedFields.push("المبلغ المتبقي");
      if (values.agentRaw.trim() !== row.agentRaw) changedFields.push("اسم الوكيل");
      if (values.statusRaw.trim() !== row.statusRaw) changedFields.push("حالة الجواز");
      if (rawToText(row.dateRaw) !== values.dateRaw.trim()) changedFields.push("التاريخ");
      if (values.noteRaw.trim() !== row.noteRaw) changedFields.push("الملاحظة");
      if (changedFields.length) {
        addAuditEvent(
          "تصحيح يدوي",
          `تم تعديل الحقول: ${changedFields.join("، ")}`,
          row.sourceRowNumber,
        );
      }
      return true;
    },
    [rows, addAuditEvent],
  );

  const saveVoucherAllocations = useCallback(
    (rowId: string, nextAllocations: PassportAllocation[]) => {
      const row = rows.find((item) => item.id === rowId);
      if (!row) return { ok: false, message: "لم أجد السجل المطلوب." };
      if (!row.approvedPassportNames || row.approvedPassportNames.length < 2) {
        return {
          ok: false,
          message: "اعتمد أسماء الجوازات المشتركة قبل إدخال الحصص.",
        };
      }

      const allowedNames = new Set(
        row.approvedPassportNames.map(normalizeArabicText),
      );
      if (
        nextAllocations.some(
          (allocation) =>
            !allowedNames.has(normalizeArabicText(allocation.passportName)),
        )
      ) {
        return {
          ok: false,
          message: "الحصة يجب أن تكون لأحد الأسماء المعتمدة في هذا السند.",
        };
      }

      const uniqueNames = new Set(
        nextAllocations.map((allocation) =>
          normalizeArabicText(allocation.passportName),
        ),
      );
      if (uniqueNames.size !== nextAllocations.length) {
        return {
          ok: false,
          message: "يوجد اسم جواز مكرر في التوزيع.",
        };
      }

      const summary = summarizeAllocation(row.paidRaw, nextAllocations);
      if (summary.status === "invalid-total") {
        return {
          ok: false,
          message: "المبلغ الإجمالي غير رقمي؛ راجعه قبل إدخال الحصص.",
        };
      }
      if (summary.status === "invalid-allocation") {
        return {
          ok: false,
          message: "أدخل حصصًا رقمية موجبة أو صفرًا وبحد أقصى منزلتين عشريتين.",
        };
      }
      if (summary.status === "overallocated") {
        return {
          ok: false,
          message: "مجموع الحصص يتجاوز المبلغ الإجمالي للسند.",
        };
      }

      setAllocations((current) => ({
        ...current,
        [rowId]: nextAllocations.filter((allocation) => allocation.amount > 0),
      }));
      addAuditEvent(
        "حفظ توزيع يدوي",
        `تم حفظ حصص بمجموع ${summary.allocated.toLocaleString("ar")}`,
        row.sourceRowNumber,
      );
      return {
        ok: true,
        message:
          summary.status === "complete"
            ? "اكتمل توزيع مبلغ السند."
            : `حُفظ التوزيع الجزئي؛ المتبقي غير موزع ${summary.unallocated?.toLocaleString("ar") ?? ""}.`,
      };
    },
    [rows, addAuditEvent],
  );

  const markIssueResolved = useCallback(
    (issueId: string, sourceRowNumber?: number) => {
      setResolvedIssueIds((current) =>
        current.includes(issueId) ? current : [...current, issueId],
      );
      addAuditEvent("مراجعة تنبيه", "تمت مراجعة التنبيه دون حذف السجل", sourceRowNumber);
    },
    [addAuditEvent],
  );

  const clearWorkspace = useCallback(async () => {
    await clearLocalWorkspace();
    setRows([]);
    setFileName("");
    setSheetName("");
    setFirstRowIsHeader(false);
    setAgentAliases([]);
    setAllocations({});
    setResolvedIssueIds([]);
    setAuditEvents([]);
    setSkippedBlankRows(0);
    setRowsWithExtraColumns(0);
    setSavedAt(null);
    setStorageError(null);
  }, []);

  const getAgentDisplayName = useCallback(
    (rawName: string) => {
      const normalized = normalizeAgentForSuggestion(rawName);
      const mapping = agentAliases.find(
        (item) =>
          item.approved &&
          [item.canonicalName, ...item.aliases].some(
            (name) => normalizeAgentForSuggestion(name) === normalized,
          ),
      );
      return mapping?.canonicalName ?? rawName;
    },
    [agentAliases],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      rows,
      fileName,
      sheetName,
      firstRowIsHeader,
      issues,
      agentAliases,
      agentCandidates,
      allocations,
      auditEvents,
      skippedBlankRows,
      rowsWithExtraColumns,
      isReady,
      isSaving,
      savedAt,
      storageError,
      importError,
      importFile: async (file) => {
        try {
          return await importFile(file);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "تعذر قراءة الملف.";
          setImportError(message);
          throw error;
        }
      },
      approveAgentAlias,
      addManualAgentAlias,
      removeAgentAlias,
      approvePassportSplit,
      updateSourceRow,
      saveVoucherAllocations,
      markIssueResolved,
      clearWorkspace,
      getAgentDisplayName,
    }),
    [
      rows,
      fileName,
      sheetName,
      firstRowIsHeader,
      issues,
      agentAliases,
      agentCandidates,
      allocations,
      auditEvents,
      skippedBlankRows,
      rowsWithExtraColumns,
      isReady,
      isSaving,
      savedAt,
      storageError,
      importError,
      importFile,
      approveAgentAlias,
      addManualAgentAlias,
      removeAgentAlias,
      approvePassportSplit,
      updateSourceRow,
      saveVoucherAllocations,
      markIssueResolved,
      clearWorkspace,
      getAgentDisplayName,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  }
  return context;
}

export function getRowPaidAmount(row: SourceRow): number | null {
  return parseAmount(row.paidRaw);
}
