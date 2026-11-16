import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ExternalLink,
  ReceiptText,
  Save,
  ShieldAlert,
  Split,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/PageElements";
import {
  parseAmount,
  splitPassportCandidates,
  summarizeAllocation,
  type PassportAllocation,
  type SourceRow,
} from "@/lib/domain";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";

export default function SharedVouchersPage() {
  const { rows, allocations, saveVoucherAllocations } = useWorkspace();
  const compositeRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (row.approvedPassportNames?.length ?? 0) > 1 ||
          splitPassportCandidates(row.passportName).length > 1,
      ),
    [rows],
  );
  const [drafts, setDrafts] = useState<
    Record<string, Array<{ passportName: string; amount: string; note: string }>>
  >({});

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const row of compositeRows) {
        if (next[row.id]) continue;
        const names =
          row.approvedPassportNames ??
          splitPassportCandidates(row.passportName);
        next[row.id] = names.map((passportName) => {
          const existing = (allocations[row.id] ?? []).find(
            (allocation) => allocation.passportName === passportName,
          );
          return {
            passportName,
            amount: existing ? String(existing.amount) : "",
            note: existing?.note ?? "",
          };
        });
      }
      return next;
    });
  }, [compositeRows, allocations]);

  function updateDraft(
    row: SourceRow,
    index: number,
    key: "passportName" | "amount" | "note",
    value: string,
  ) {
    setDrafts((current) => {
      const rowDraft = current[row.id] ?? [];
      return {
        ...current,
        [row.id]: rowDraft.map((item, itemIndex) =>
          itemIndex === index ? { ...item, [key]: value } : item,
        ),
      };
    });
  }

  function save(row: SourceRow) {
    const next: PassportAllocation[] = (drafts[row.id] ?? [])
      .filter((item) => item.passportName.trim())
      .map((item) => ({
        passportName: item.passportName.trim(),
        amount: item.amount.trim() ? Number(item.amount) : 0,
        ...(item.note.trim() ? { note: item.note.trim() } : {}),
      }));
    const result = saveVoucherAllocations(row.id, next);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
  }

  return (
    <>
      <PageHeader
        eyebrow="توزيع يدوي فقط"
        title="السندات ذات الجوازات المشتركة"
        description="كل بطاقة هنا تمثل صفًا واحدًا من المصدر ومبلغًا إجماليًا واحدًا. لا يكرر النظام المبلغ على كل جواز."
      />
      <div className="notice notice-warning">
        <ShieldAlert size={18} />
        <span>
          الحصص لا تُقدّر تلقائيًا. اترك حصة الجواز فارغة إذا لم تحددها؛ ويبقى
          الفرق ظاهرًا كمبلغ غير موزع.
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="لا يوجد ملف مستورد"
          detail="استورد ملف Excel أولًا لاكتشاف السندات التي تضم أكثر من اسم جواز."
          icon={ReceiptText}
        />
      ) : compositeRows.length === 0 ? (
        <EmptyState
          title="لم تُكتشف أسماء مركبة بعد"
          detail="إذا ظهر أكثر من اسم في خلية اسم الجواز، راجع اقتراح الفصل في صفحة المراجعة."
          icon={Split}
        />
      ) : (
        <div className="shared-voucher-list">
          {compositeRows.map((row) => {
            const approvedNames = row.approvedPassportNames;
            const isApproved = Boolean(approvedNames && approvedNames.length > 1);
            const names =
              drafts[row.id] ??
              (approvedNames ?? splitPassportCandidates(row.passportName)).map(
                (passportName) => ({
                  passportName,
                  amount: "",
                  note: "",
                }),
              );
            const savedAllocations = allocations[row.id] ?? [];
            const summary = summarizeAllocation(row.paidRaw, savedAllocations);
            const total = parseAmount(row.paidRaw);

            return (
              <article
                className="shared-voucher-card"
                key={row.id}
                data-testid={`shared-voucher-${row.id}`}
              >
                <div className="shared-voucher-head">
                  <div>
                    <div className="eyebrow">السند · صف المصدر {row.sourceRowNumber}</div>
                    <h2>{row.receiptNumber || "رقم سند غير مدخل"}</h2>
                    <p className="shared-original-name">
                      الاسم كما ورد: <b>{row.passportName || "غير مدخل"}</b>
                    </p>
                  </div>
                  <div className="shared-total-box">
                    <span>إجمالي المدفوع في هذا الصف</span>
                    <strong>{total === null ? "يحتاج مراجعة" : total.toLocaleString("ar")}</strong>
                    <small>يُسجل مرة واحدة، لا لكل اسم</small>
                  </div>
                </div>

                {!isApproved ? (
                  <div className="pending-split">
                    <div className="pending-split-icon">
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <b>اعتمد أسماء الجوازات أولًا</b>
                      <p>
                        الأسماء المقترحة:{" "}
                        {splitPassportCandidates(row.passportName).join(" · ")}
                      </p>
                    </div>
                    <Link
                      href="/review"
                      className="button button-outline"
                      data-testid={`link-review-split-${row.id}`}
                    >
                      مراجعة الأسماء <ExternalLink size={14} />
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="allocation-table-head">
                      <span>الجواز المعتمد</span>
                      <span>الحصة اليدوية</span>
                      <span>ملاحظة اختيارية</span>
                      <span />
                    </div>
                    <div className="allocation-table">
                      {names.map((item, index) => (
                        <div className="allocation-editor-row" key={`${row.id}-${index}`}>
                          <input
                            value={item.passportName}
                            readOnly
                            aria-label={`اسم الجواز ${index + 1}`}
                            data-testid={`input-shared-name-${row.id}-${index}`}
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={item.amount}
                            onChange={(event) =>
                              updateDraft(row, index, "amount", event.target.value)
                            }
                            placeholder="لم يحدد"
                            aria-label={`حصة الجواز ${index + 1}`}
                            data-testid={`input-allocation-${row.id}-${index}`}
                          />
                          <input
                            value={item.note}
                            onChange={(event) =>
                              updateDraft(row, index, "note", event.target.value)
                            }
                            placeholder="اختياري"
                            aria-label={`ملاحظة الجواز ${index + 1}`}
                            data-testid={`input-allocation-note-${row.id}-${index}`}
                          />
                          <span />
                        </div>
                      ))}
                    </div>
                    <div
                      className={`allocation-summary allocation-${summary.status}`}
                      data-testid={`allocation-summary-${row.id}`}
                    >
                      <div>
                        <span>إجمالي السند</span>
                        <b>{summary.total?.toLocaleString("ar") ?? "غير واضح"}</b>
                      </div>
                      <div>
                        <span>الموزع يدويًا</span>
                        <b>{summary.allocated.toLocaleString("ar")}</b>
                      </div>
                      <div>
                        <span>الباقي غير الموزع</span>
                        <b>{summary.unallocated?.toLocaleString("ar") ?? "غير متاح"}</b>
                      </div>
                      <span className="allocation-state-label">
                        {summary.status === "complete"
                          ? "اكتمل التوزيع"
                          : summary.status === "partial"
                            ? "توزيع جزئي"
                            : summary.status === "overallocated"
                              ? "تجاوز الإجمالي"
                              : summary.status === "invalid-total"
                                ? "راجع المبلغ الإجمالي"
                                : summary.status === "invalid-allocation"
                                  ? "راجع الحصص"
                                  : "غير موزع"}
                      </span>
                    </div>
                    <div className="shared-voucher-actions">
                      <p>
                        {savedAllocations.length
                          ? "الحصص المحفوظة لا تتغير حتى تضغط حفظ التوزيع."
                          : "لم تُحفظ أي حصة بعد. ستبقى قيمة السند غير موزعة."}
                      </p>
                      <Button
                        onClick={() => save(row)}
                        disabled={total === null || summary.status === "overallocated"}
                        data-testid={`button-save-allocation-${row.id}`}
                      >
                        <Save size={15} />
                        حفظ التوزيع
                      </Button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

