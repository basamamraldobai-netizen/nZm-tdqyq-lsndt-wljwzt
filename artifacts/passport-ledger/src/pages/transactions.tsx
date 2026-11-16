import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, FileSearch, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/PageElements";
import { RowEditDialog } from "@/components/RowEditDialog";
import {
  formatDateCell,
  rawToText,
  splitPassportCandidates,
  type SourceRow,
} from "@/lib/domain";
import { useWorkspace } from "@/lib/workspace-context";

const PAGE_SIZE = 50;

export default function TransactionsPage() {
  const { rows, fileName, getAgentDisplayName } = useWorkspace();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "composite" | "missing">("all");
  const [page, setPage] = useState(0);
  const [editingRow, setEditingRow] = useState<SourceRow | null>(null);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ar");
    return rows.filter((row) => {
      const composite = splitPassportCandidates(row.passportName).length > 1;
      const missing =
        !row.passportName ||
        !row.receiptNumber ||
        !rawToText(row.paidRaw) ||
        !rawToText(row.remainingRaw);
      if (filter === "composite" && !composite) return false;
      if (filter === "missing" && !missing) return false;
      if (!normalizedQuery) return true;
      return [
        row.passportName,
        row.receiptNumber,
        rawToText(row.paidRaw),
        rawToText(row.remainingRaw),
        row.agentRaw,
        row.statusRaw,
        row.noteRaw,
      ]
        .join(" ")
        .toLocaleLowerCase("ar")
        .includes(normalizedQuery);
    });
  }, [rows, query, filter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = filteredRows.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  function changeFilter(next: typeof filter) {
    setFilter(next);
    setPage(0);
  }

  return (
    <>
      <PageHeader
        eyebrow="دفتر المصدر"
        title="السجلات والحركات"
        description="كل صف يمثل حركة مستقلة. ابحث، راجع القيم كما وردت، وصححها يدويًا دون تغيير الملف الأصلي."
      />

      {!rows.length ? (
        <EmptyState
          title="لا يوجد ملف مستورد"
          detail="ارفع ملف Excel من الصفحة الرئيسية لبدء مراجعة السجلات."
          icon={FileSearch}
        />
      ) : (
        <>
          <section className="table-toolbar panel">
            <label className="search-field">
              <Search size={17} />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                placeholder="ابحث باسم الجواز أو رقم السند أو الوكيل…"
                data-testid="input-search-transactions"
              />
            </label>
            <div className="filter-pills" role="group" aria-label="تصفية السجلات">
              {[
                ["all", "كل السجلات"],
                ["composite", "أسماء مركبة"],
                ["missing", "حقول ناقصة"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`filter-pill${filter === value ? " active" : ""}`}
                  onClick={() => changeFilter(value as typeof filter)}
                  data-testid={`filter-transactions-${value}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="table-result-count" data-testid="text-row-count">
              {filteredRows.length.toLocaleString("ar")} من{" "}
              {rows.length.toLocaleString("ar")}
            </span>
          </section>

          <div className="table-wrap panel">
            <div className="table-meta">
              <span>
                <b>{fileName}</b> · القيم المعروضة من الملف أو من تصحيحاتك اليدوية
              </span>
              <span>المهنة مستبعدة من التصدير</span>
            </div>
            {visibleRows.length ? (
              <div className="table-scroll">
                <table className="data-table" data-testid="table-transactions">
                  <thead>
                    <tr>
                      <th>صف المصدر</th>
                      <th>اسم الجواز</th>
                      <th>رقم السند</th>
                      <th>المدفوع</th>
                      <th>المتبقي المكتوب</th>
                      <th>الوكيل</th>
                      <th>الحالة</th>
                      <th>التاريخ كما ورد</th>
                      <th>إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr
                        key={row.id}
                        data-testid={`row-transaction-${row.id}`}
                      >
                        <td className="numeric-cell row-number">
                          {row.sourceRowNumber.toLocaleString("ar")}
                        </td>
                        <td className="passport-cell">
                          <span>{row.passportName || "اسم غير مدخل"}</span>
                          {splitPassportCandidates(row.passportName).length > 1 && (
                            <small className="inline-tag">قد يحتوي عدة جوازات</small>
                          )}
                        </td>
                        <td className="numeric-cell">
                          {row.receiptNumber || "—"}
                        </td>
                        <td className="numeric-cell">
                          {rawToText(row.paidRaw) || "—"}
                        </td>
                        <td className="numeric-cell">
                          {rawToText(row.remainingRaw) || "—"}
                        </td>
                        <td>{getAgentDisplayName(row.agentRaw) || "—"}</td>
                        <td>
                          <span className="status-chip">
                            {row.statusRaw || "بلا حالة"}
                          </span>
                        </td>
                        <td className="numeric-cell">
                          {formatDateCell(row.dateRaw) || "—"}
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingRow(row)}
                            data-testid={`button-edit-row-${row.id}`}
                          >
                            <Pencil size={14} />
                            مراجعة
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="لا توجد نتائج"
                detail="جرّب عبارة بحث أخرى أو أزل التصفية الحالية."
                icon={Search}
              />
            )}

            <div className="table-footer">
              <span>
                الصفحة {(currentPage + 1).toLocaleString("ar")} من{" "}
                {pageCount.toLocaleString("ar")}
              </span>
              <div className="pagination-actions">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  data-testid="button-previous-page"
                >
                  <ArrowRight size={15} />
                  السابق
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= pageCount - 1}
                  onClick={() =>
                    setPage((current) => Math.min(pageCount - 1, current + 1))
                  }
                  data-testid="button-next-page"
                >
                  التالي
                  <ArrowLeft size={15} />
                </Button>
              </div>
            </div>
          </div>
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

