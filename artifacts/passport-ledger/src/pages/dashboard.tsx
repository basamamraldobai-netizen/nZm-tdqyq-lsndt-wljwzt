import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet,
  FileUp,
  HardDrive,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  MetricCard,
  PageHeader,
  SectionHeading,
  EmptyState,
} from "@/components/PageElements";
import { useWorkspace } from "@/lib/workspace-context";
import {
  splitPassportCandidates,
  summarizeAllocation,
} from "@/lib/domain";
import { toast } from "sonner";

export default function DashboardPage() {
  const {
    rows,
    fileName,
    sheetName,
    issues,
    agentCandidates,
    allocations,
    auditEvents,
    importFile,
    importError,
    isReady,
    isSaving,
    skippedBlankRows,
    rowsWithExtraColumns,
    clearWorkspace,
  } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const openIssues = issues.filter((issue) => !issue.resolved);
  const sharedNameRows = rows.filter(
    (row) => (row.approvedPassportNames?.length ?? 0) > 1,
  );
  const unallocatedSharedCount = sharedNameRows.filter((row) => {
    const state = summarizeAllocation(
      row.paidRaw,
      allocations[row.id] ?? [],
    ).status;
    return state === "unallocated" || state === "partial";
  }).length;
  const suggestedSharedCount = rows.filter(
    (row) =>
      !row.approvedPassportNames?.length &&
      splitPassportCandidates(row.passportName).length > 1,
  ).length;
  const receiptCount = useMemo(
    () => new Set(rows.map((row) => row.receiptNumber).filter(Boolean)).size,
    [rows],
  );

  async function startImport(file: File) {
    if (rows.length > 0) {
      const approved = window.confirm(
        "سيستبدل الاستيراد الجديد السجلات الحالية المحفوظة على هذا الجهاز. هل تريد المتابعة؟",
      );
      if (!approved) {
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
    }
    setIsImporting(true);
    try {
      const result = await importFile(file, firstRowIsHeader);
      toast.success(
        `استوردت ${result.rows.length.toLocaleString("ar")} سجلًا. لم يتغير الملف الأصلي.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر استيراد الملف.");
    } finally {
      setIsImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void startImport(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void startImport(file);
  }

  async function onClear() {
    const approved = window.confirm(
      "سيُحذف ملف العمل والتعديلات المحفوظة من هذا المتصفح. لا يمكن التراجع بعد الحذف. هل تريد المتابعة؟",
    );
    if (!approved) return;
    try {
      await clearWorkspace();
      toast.success("تم حذف بيانات مساحة العمل من هذا الجهاز.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حذف البيانات.");
    }
  }

  if (!isReady) {
    return (
      <div className="loading-panel" role="status">
        جارٍ استعادة مساحة العمل المحفوظة على هذا الجهاز…
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="مراجعة محلية · اعتماد يدوي"
        title={rows.length ? "نظرة عامة على ملفك" : "ابدأ بمراجعة ملف السندات"}
        description={
          rows.length
            ? "كل حركة محفوظة كما وردت. راجع التنبيهات والتوزيعات قبل تنزيل نسخة جديدة."
            : "استورد ملف Excel لبدء تدقيق السجلات والأسماء والمبالغ دون رفع البيانات إلى خادم."
        }
        actions={
          rows.length > 0 ? (
            <Link
              href="/transactions"
              className="button button-primary"
              data-testid="link-all-transactions"
            >
              عرض السجلات <ArrowLeft size={16} />
            </Link>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <section
          className={`import-hero${isDragging ? " is-dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          data-testid="dropzone-workbook"
        >
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept=".xlsx,.xls,.xlsm"
            onChange={onFileChange}
            data-testid="input-workbook"
          />
          <div className="import-hero-copy">
            <span className="import-mark">
              <FileUp size={22} />
            </span>
            <div className="eyebrow">ملفك لا يغادر هذا المتصفح</div>
            <h2>ابدأ بملف Excel كما هو</h2>
            <p>
              يقرأ النظام الورقة الأولى، ويحفظ كل سجل منفصلًا. لن يدمج أسماء
              الوكلاء أو يوزع مبلغ السند المشترك دون قرارك.
            </p>
            <div className="import-actions">
              <Button
                onClick={() => inputRef.current?.click()}
                disabled={isImporting}
                data-testid="button-upload-workbook"
              >
                <FileSpreadsheet size={17} />
                {isImporting ? "جارٍ قراءة الملف…" : "اختيار ملف Excel"}
              </Button>
              <span className="drop-hint">أو اسحب الملف إلى هذه المنطقة</span>
            </div>
            <label className="header-toggle" data-testid="label-header-toggle">
              <input
                type="checkbox"
                checked={firstRowIsHeader}
                onChange={(event) => setFirstRowIsHeader(event.target.checked)}
                data-testid="checkbox-first-row-header"
              />
              <span>الصف الأول يحتوي على عناوين الأعمدة</span>
            </label>
            {importError && (
              <p className="inline-error" role="alert" data-testid="import-error">
                <AlertTriangle size={16} />
                {importError}
              </p>
            )}
          </div>
          <div className="import-hero-side">
            <div className="column-map-title">ترتيب الأعمدة المعروف</div>
            <div className="column-map-grid">
              {[
                ["A", "اسم الجواز"],
                ["B", "رقم السند"],
                ["C", "المبلغ المدفوع"],
                ["D", "المبلغ المتبقي"],
                ["E", "اسم الوكيل"],
                ["F", "حالة الجواز"],
                ["G", "المهنة"],
                ["H", "التاريخ"],
                ["I", "الملاحظة"],
              ].map(([letter, name]) => (
                <div className="column-map-row" key={letter}>
                  <span>{letter}</span>
                  <b>{name}</b>
                </div>
              ))}
            </div>
            <p className="side-note">
              المهنة لا تدخل في الملف الناتج. تبقى موجودة في المصدر المحفوظ.
            </p>
          </div>
        </section>
      ) : (
        <>
          <div className="source-strip">
            <span className="source-file-icon">
              <FileSpreadsheet size={19} />
            </span>
            <div className="source-file-copy">
              <strong data-testid="text-filename">{fileName}</strong>
              <span>
                الورقة: {sheetName} · {rows.length.toLocaleString("ar")} سجلًا
              </span>
            </div>
            <div className="source-status">
              <span className={`save-dot${isSaving ? " saving" : ""}`} />
              {isSaving ? "جارٍ الحفظ" : "محفوظ على هذا الجهاز"}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              data-testid="button-replace-workbook"
            >
              <RotateCcw size={15} />
              استبدال الملف
            </Button>
            <input
              ref={inputRef}
              className="visually-hidden"
              type="file"
              accept=".xlsx,.xls,.xlsm"
              onChange={onFileChange}
              data-testid="input-workbook"
            />
          </div>

          {(skippedBlankRows > 0 || rowsWithExtraColumns > 0) && (
            <div className="notice notice-warning" role="status">
              <AlertTriangle size={17} />
              <span>
                {skippedBlankRows > 0 &&
                  `تجاهلنا ${skippedBlankRows.toLocaleString("ar")} صفوفًا فارغة. `}
                {rowsWithExtraColumns > 0 &&
                  `${rowsWithExtraColumns.toLocaleString("ar")} صفًا يحتوي بيانات بعد العمود I؛ لم تدخل هذه الأعمدة في المراجعة.`}
              </span>
            </div>
          )}

          <section className="metric-grid" aria-label="ملخص الملف">
            <MetricCard
              icon={FileCheck2}
              label="سجلات محفوظة"
              value={rows.length.toLocaleString("ar")}
              detail="لم تُحذف الحركات المتكررة"
              tone="blue"
            />
            <MetricCard
              icon={ListChecks}
              label="تنبيهات مفتوحة"
              value={openIssues.length.toLocaleString("ar")}
              detail="تحتاج مراجعة أو قرارًا"
              tone={openIssues.length ? "amber" : "green"}
            />
            <MetricCard
              icon={UsersRound}
              label="صيغ وكلاء للمراجعة"
              value={agentCandidates.length.toLocaleString("ar")}
              detail="اقتراحات لا تدمج تلقائيًا"
              tone={agentCandidates.length ? "violet" : "green"}
            />
            <MetricCard
              icon={HardDrive}
              label="سندات غير موزعة"
              value={unallocatedSharedCount.toLocaleString("ar")}
              detail={
                suggestedSharedCount
                  ? `${suggestedSharedCount.toLocaleString("ar")} أسماء مركبة تنتظر الاعتماد`
                  : "الحصص تُدخل يدويًا فقط"
              }
              tone={unallocatedSharedCount ? "amber" : "blue"}
            />
          </section>

          <div className="dashboard-columns">
            <section className="panel workflow-panel">
              <SectionHeading
                title="الخطوة التالية"
                detail="انتقل إلى الجزء الذي يحتاج انتباهك"
              />
              <div className="workflow-list">
                <Link href="/review" className="workflow-link" data-testid="link-review-issues">
                  <span className="workflow-icon warm">
                    <ListChecks size={18} />
                  </span>
                  <span className="workflow-copy">
                    <b>مراجعة التنبيهات</b>
                    <small>أسماء مركبة، مبالغ وتواريخ تحتاج تحققًا</small>
                  </span>
                  <span className="workflow-count">
                    {openIssues.length.toLocaleString("ar")}
                  </span>
                  <ArrowLeft size={16} />
                </Link>
                <Link href="/shared" className="workflow-link" data-testid="link-shared-vouchers">
                  <span className="workflow-icon green">
                    <WalletCardsIcon />
                  </span>
                  <span className="workflow-copy">
                    <b>توزيع السندات المشتركة</b>
                    <small>أدخل الحصص بعد اعتماد أسماء الجوازات</small>
                  </span>
                  <span className="workflow-count">
                    {sharedNameRows.length.toLocaleString("ar")}
                  </span>
                  <ArrowLeft size={16} />
                </Link>
                <Link href="/agents" className="workflow-link" data-testid="link-agent-aliases">
                  <span className="workflow-icon violet">
                    <UsersRound size={18} />
                  </span>
                  <span className="workflow-copy">
                    <b>اعتماد أسماء الوكلاء</b>
                    <small>اربط الصيغ المتشابهة بالاسم الصحيح</small>
                  </span>
                  <span className="workflow-count">
                    {agentCandidates.length.toLocaleString("ar")}
                  </span>
                  <ArrowLeft size={16} />
                </Link>
                <Link href="/export" className="workflow-link" data-testid="link-export">
                  <span className="workflow-icon blue">
                    <ArrowDownToLine size={18} />
                  </span>
                  <span className="workflow-copy">
                    <b>إعداد ملفات Excel</b>
                    <small>استبعد المهنة وقسّم كل 3000 سجل</small>
                  </span>
                  <ArrowLeft size={16} />
                </Link>
              </div>
              <div className="accounting-note">
                <ShieldCheck size={17} />
                <span>
                  المبلغ المتبقي المعروض هو كما كُتب في الملف، وليس رصيدًا أعاد
                  النظام حسابه.
                </span>
              </div>
            </section>

            <section className="panel activity-panel">
              <SectionHeading
                title="سجل المراجعة"
                detail="آخر الإجراءات على هذا الملف"
              />
              {auditEvents.length === 0 ? (
                <EmptyState
                  title="لا توجد تعديلات بعد"
                  detail="سيظهر هنا اعتماد المطابقات والتوزيعات والتصحيحات اليدوية."
                  icon={CheckCircle2}
                />
              ) : (
                <div className="activity-list">
                  {auditEvents.slice(0, 6).map((event) => (
                    <article className="activity-item" key={event.id} data-testid={`activity-${event.id}`}>
                      <span className="activity-dot" />
                      <div>
                        <b>{event.action}</b>
                        <p>{event.summary}</p>
                        <time dateTime={event.at}>
                          {new Date(event.at).toLocaleString("ar", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                          {event.sourceRowNumber
                            ? ` · صف ${event.sourceRowNumber.toLocaleString("ar")}`
                            : ""}
                        </time>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="data-safety-bar">
            <ShieldCheck size={17} />
            <span>
              البيانات محفوظة في مساحة المتصفح على هذا الجهاز فقط، ولا تُرسل إلى
              خادم.
            </span>
            <button
              type="button"
              onClick={() => void onClear()}
              data-testid="button-clear-workspace"
            >
              حذف بيانات هذا الجهاز
            </button>
          </section>
        </>
      )}

      {!rows.length && (
        <section className="principle-grid">
          <article>
            <span>01</span>
            <b>الحركات لا تُحذف</b>
            <p>تكرار اسم الجواز يبقى جزءًا من تاريخه المالي.</p>
          </article>
          <article>
            <span>02</span>
            <b>المشترك لا يُقسم تلقائيًا</b>
            <p>كل مبلغ مشترك يبقى غير موزع حتى تدخل الحصص.</p>
          </article>
          <article>
            <span>03</span>
            <b>التعديل له أثر واضح</b>
            <p>القيمة الأصلية تبقى محفوظة، وكل تصحيح يظهر في سجل المراجعة.</p>
          </article>
        </section>
      )}
    </>
  );
}

function WalletCardsIcon() {
  return <FileSpreadsheet size={18} />;
}

