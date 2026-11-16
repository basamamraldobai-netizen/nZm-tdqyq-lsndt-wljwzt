import { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCheck,
  FileSearch,
  Pencil,
  Split,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/PageElements";
import { RowEditDialog } from "@/components/RowEditDialog";
import {
  splitPassportCandidates,
  type ReviewIssue,
  type SourceRow,
} from "@/lib/domain";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";

const ISSUE_LABELS: Record<ReviewIssue["kind"], string> = {
  "missing-passport": "اسم الجواز غير مدخل",
  "missing-receipt": "رقم السند غير مدخل",
  "missing-paid": "المبلغ المدفوع غير مسجل",
  "invalid-paid": "صيغة المدفوع تحتاج مراجعة",
  "missing-remaining": "المتبقي غير مسجل",
  "invalid-remaining": "صيغة المتبقي تحتاج مراجعة",
  "missing-date": "التاريخ غير مسجل",
  "invalid-date": "صيغة التاريخ تحتاج مراجعة",
  "ambiguous-date": "ترتيب اليوم والشهر غير محسوم",
  "composite-passport": "قد يحتوي الحقل عدة جوازات",
  "repeated-passport": "اسم الجواز ظاهر في أكثر من حركة",
  "reused-receipt": "رقم السند مستخدم في أكثر من سجل",
  "possible-agent-alias": "صيغة اسم الوكيل قد تطابق صيغة أخرى",
};

export default function ReviewPage() {
  const {
    rows,
    issues,
    markIssueResolved,
    approvePassportSplit,
  } = useWorkspace();
  const [showResolved, setShowResolved] = useState(false);
  const [splitDrafts, setSplitDrafts] = useState<Record<string, string[]>>({});
  const [editingRow, setEditingRow] = useState<SourceRow | null>(null);
  const rowMap = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const visibleIssues = issues.filter((issue) =>
    showResolved ? issue.resolved : !issue.resolved,
  );
  const openCount = issues.filter((issue) => !issue.resolved).length;

  function getDraft(issue: ReviewIssue, row: SourceRow): string[] {
    return (
      splitDrafts[row.id] ??
      row.approvedPassportNames ??
      splitPassportCandidates(row.passportName)
    );
  }

  function updateDraft(rowId: string, index: number, value: string) {
    setSplitDrafts((current) => {
      const row = rowMap.get(rowId);
      const names = current[rowId] ?? [
        ...(row?.approvedPassportNames ??
          (row ? splitPassportCandidates(row.passportName) : [])),
      ];
      return {
        ...current,
        [rowId]: names.map((name, i) => (i === index ? value : name)),
      };
    });
  }

  function addDraftName(rowId: string) {
    setSplitDrafts((current) => ({
      ...current,
      [rowId]: [...(current[rowId] ?? []), ""],
    }));
  }

  function removeDraftName(rowId: string, index: number) {
    setSplitDrafts((current) => ({
      ...current,
      [rowId]: (current[rowId] ?? []).filter((_, i) => i !== index),
    }));
  }

  function approveSplit(issue: ReviewIssue, row: SourceRow) {
    const names = getDraft(issue, row);
    if (!approvePassportSplit(row.id, names)) {
      toast.error("أدخل اسمين مختلفين على الأقل.");
      return;
    }
    toast.success("تم اعتماد أسماء الجوازات. المبلغ ما زال غير موزع.");
  }

  function resolveIssue(issue: ReviewIssue, row: SourceRow) {
    markIssueResolved(issue.id, row.sourceRowNumber);
    toast.success("تم تسجيل مراجعة التنبيه دون حذف السجل.");
  }

  return (
    <>
      <PageHeader
        eyebrow="تدقيق بشري"
        title="المراجعة والتنبيهات"
        description="راجع كل اقتراح قبل اعتماده. إغلاق التنبيه لا يحذف الحركة ولا يوزع أي مبلغ."
        actions={
          rows.length > 0 ? (
            <Button
              variant="outline"
              onClick={() => setShowResolved((current) => !current)}
              data-testid="button-toggle-resolved"
            >
              <CheckCheck size={16} />
              {showResolved ? "عرض المفتوحة" : "عرض التي راجعتها"}
            </Button>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="بانتظار ملف Excel"
          detail="بعد الاستيراد ستظهر هنا القيم الناقصة والأسماء المركبة والمبالغ أو التواريخ التي تحتاج مراجعة."
          icon={FileSearch}
        />
      ) : (
        <>
          <div className="review-status-banner">
            <span className="review-status-icon">
              {openCount ? <AlertCircle size={20} /> : <Check size={20} />}
            </span>
            <div>
              <b>
                {showResolved
                  ? "هذه التنبيهات سبق أن راجعتها"
                  : openCount
                    ? `${openCount.toLocaleString("ar")} تنبيهًا مفتوحًا`
                    : "لا توجد تنبيهات مفتوحة"}
              </b>
              <p>
                المبالغ والتواريخ غير الواضحة تبقى كما وردت حتى تصححها يدويًا.
              </p>
            </div>
          </div>

          {visibleIssues.length === 0 ? (
            <EmptyState
              title={showResolved ? "لا توجد تنبيهات مغلقة" : "أحسنت، لا توجد تنبيهات مفتوحة"}
              detail={
                showResolved
                  ? "ستظهر هنا التنبيهات التي سجلت أنك راجعتها."
                  : "كل التنبيهات الحالية عولجت أو سُجلت للمراجعة."
              }
              icon={Check}
            />
          ) : (
            <div className="review-list">
              {visibleIssues.map((issue) => {
                const row = rowMap.get(issue.rowId);
                if (!row) return null;
                const isComposite = issue.kind === "composite-passport";
                const names = isComposite ? getDraft(issue, row) : [];
                return (
                  <article
                    className={`review-card severity-${issue.severity}`}
                    key={issue.id}
                    data-testid={`issue-${issue.id}`}
                  >
                    <div className="review-card-top">
                      <span className="severity-icon">
                        <AlertCircle size={18} />
                      </span>
                      <div className="review-card-title">
                        <b>{ISSUE_LABELS[issue.kind]}</b>
                        <span className={`severity-label ${issue.severity}`}>
                          {issue.severity === "warning"
                            ? "مهم"
                            : issue.severity === "review"
                              ? "يتطلب قرارًا"
                              : "للعلم"}
                        </span>
                      </div>
                      <span className="source-row-label">
                        صف {row.sourceRowNumber.toLocaleString("ar")}
                      </span>
                    </div>

                    <p className="review-card-message">{issue.message}</p>
                    <div className="review-source-summary">
                      <span>
                        <small>الجواز</small>
                        <b>{row.passportName || "غير مدخل"}</b>
                      </span>
                      <span>
                        <small>السند</small>
                        <b>{row.receiptNumber || "غير محدد"}</b>
                      </span>
                      <span>
                        <small>المدفوع كما ورد</small>
                        <b>{row.paidRaw === null ? "فارغ" : String(row.paidRaw)}</b>
                      </span>
                    </div>

                    {isComposite && (
                      <div className="split-review">
                        <div className="split-review-heading">
                          <Split size={16} />
                          <b>راجع أسماء الجوازات قبل التوزيع</b>
                          <span>المبلغ يبقى إجماليًا وغير موزع</span>
                        </div>
                        <div className="split-name-list">
                          {names.map((name, index) => (
                            <div className="split-name-row" key={`${row.id}-${index}`}>
                              <label htmlFor={`split-${row.id}-${index}`}>
                                الجواز {index + 1}
                              </label>
                              <input
                                id={`split-${row.id}-${index}`}
                                value={name}
                                onChange={(event) =>
                                  updateDraft(row.id, index, event.target.value)
                                }
                                data-testid={`input-split-name-${row.id}-${index}`}
                              />
                              {names.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => removeDraftName(row.id, index)}
                                  aria-label={`حذف الجواز ${index + 1}`}
                                  data-testid={`button-remove-split-${row.id}-${index}`}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => addDraftName(row.id)}
                            data-testid={`button-add-split-${row.id}`}
                          >
                            إضافة اسم آخر
                          </button>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => approveSplit(issue, row)}
                          data-testid={`button-approve-split-${row.id}`}
                        >
                          <Check size={15} />
                          اعتماد الأسماء فقط
                        </Button>
                      </div>
                    )}

                    <div className="review-card-actions">
                      {["invalid-paid", "invalid-remaining", "invalid-date", "ambiguous-date"].includes(
                        issue.kind,
                      ) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingRow(row)}
                          data-testid={`button-edit-issue-${issue.id}`}
                        >
                          <Pencil size={14} />
                          تصحيح يدوي
                        </Button>
                      )}
                      {!isComposite && !issue.resolved && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resolveIssue(issue, row)}
                          data-testid={`button-resolve-${issue.id}`}
                        >
                          <Check size={14} />
                          تمت المراجعة دون تعديل
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <RowEditDialog
        row={editingRow}
        open={!!editingRow}
        onOpenChange={(open) => {
          if (!open) setEditingRow(null);
        }}
      />
    </>
  );
}

