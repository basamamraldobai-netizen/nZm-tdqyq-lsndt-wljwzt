import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  FileSpreadsheet,
  Files,
  ShieldCheck,
  Split,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, MetricCard, PageHeader } from "@/components/PageElements";
import { useWorkspace } from "@/lib/workspace-context";
import { downloadReviewedWorkbooks } from "@/lib/workbook";
import { toast } from "sonner";

const MAX_ROWS_PER_FILE = 3000;

export default function ExportPage() {
  const {
    rows,
    fileName,
    issues,
    agentAliases,
    allocations,
    rowsWithExtraColumns,
  } = useWorkspace();
  const [acknowledged, setAcknowledged] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const unresolvedIssues = issues.filter((issue) => !issue.resolved);
  const allocatedCount = useMemo(
    () => Object.values(allocations).filter((items) => items.length > 0).length,
    [allocations],
  );
  const fileCount = Math.max(1, Math.ceil(rows.length / MAX_ROWS_PER_FILE));
  const hasOpenIssues = unresolvedIssues.length > 0;

  function download() {
    if (!rows.length) return;
    if (hasOpenIssues && !acknowledged) {
      toast.error("أكّد أنك راجعت التنبيهات المفتوحة قبل التصدير.");
      return;
    }
    setIsDownloading(true);
    try {
      const count = downloadReviewedWorkbooks({
        rows,
        aliases: agentAliases,
        allocations,
        fileName: fileName.replace(/\.[^.]+$/, "") || "سندات_مراجعة",
        maxRowsPerFile: MAX_ROWS_PER_FILE,
      });
      toast.success(
        count === 1
          ? "تم تنزيل ملف Excel."
          : `بدأ تنزيل ${count.toLocaleString("ar")} ملفات Excel.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "تعذر إنشاء ملف التصدير.",
      );
    } finally {
      window.setTimeout(() => setIsDownloading(false), 700);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="نسخة جديدة · المصدر محفوظ"
        title="تصدير ملفات Excel"
        description="أنشئ نسخة مراجعة جديدة. لا يُعدّل النظام الملف الأصلي، ويقسّم النتائج إلى ملفات لا تتجاوز 3000 سجل."
      />

      {!rows.length ? (
        <EmptyState
          title="لا توجد سجلات للتصدير"
          detail="استورد ملف Excel أولًا، ثم راجع البيانات وأنشئ نسختك."
          icon={ArrowDownToLine}
        />
      ) : (
        <>
          <section className="metric-grid export-metrics">
            <MetricCard
              icon={FileSpreadsheet}
              label="السجلات"
              value={rows.length.toLocaleString("ar")}
              detail="تتضمن الحركات المتكررة"
              tone="blue"
            />
            <MetricCard
              icon={Files}
              label="عدد الملفات"
              value={fileCount.toLocaleString("ar")}
              detail="حد أقصى 3000 سجل في الملف"
              tone="violet"
            />
            <MetricCard
              icon={Split}
              label="سندات لها حصص"
              value={allocatedCount.toLocaleString("ar")}
              detail="تُرفق في ورقة توزيع منفصلة"
              tone="green"
            />
            <MetricCard
              icon={AlertTriangle}
              label="تنبيهات مفتوحة"
              value={unresolvedIssues.length.toLocaleString("ar")}
              detail="يمكن تصديرها بعد الإقرار بها"
              tone={hasOpenIssues ? "amber" : "green"}
            />
          </section>

          <div className="export-layout">
            <section className="export-main panel">
              <div className="export-ready-mark">
                <ArrowDownToLine size={23} />
              </div>
              <div className="eyebrow">ملف التصدير</div>
              <h2>{fileName.replace(/\.[^.]+$/, "") || "سندات_مراجعة"}</h2>
              <p className="export-description">
                ستُنشأ ورقة للمعاملات وورقة لتوزيعات السندات اليدوية. إذا تجاوزت
                السجلات 3000، يُقسّم التصدير إلى عدة ملفات.
              </p>

              <div className="export-includes">
                <div className="export-include">
                  <CheckCircle2 size={17} />
                  <div>
                    <b>المهنة مستبعدة</b>
                    <span>لا يظهر العمود G في الملفات الناتجة.</span>
                  </div>
                </div>
                <div className="export-include">
                  <CheckCircle2 size={17} />
                  <div>
                    <b>التعديلات التي اعتمدتها</b>
                    <span>يظهر اسم الوكيل المعتمد والقيم التي صححتها يدويًا.</span>
                  </div>
                </div>
                <div className="export-include">
                  <CheckCircle2 size={17} />
                  <div>
                    <b>مبالغ السند المشترك محفوظة مرة واحدة</b>
                    <span>
                      الحصص اليدوية فقط تظهر في ورقة منفصلة؛ لا يتكرر الإجمالي
                      على كل جواز.
                    </span>
                  </div>
                </div>
                <div className="export-include">
                  <CheckCircle2 size={17} />
                  <div>
                    <b>المتبقي كما ورد</b>
                    <span>لا يُعاد حساب الرصيد من دون قاعدة مؤكدة.</span>
                  </div>
                </div>
              </div>

              {hasOpenIssues && (
                <label className="export-acknowledge">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(event) =>
                      setAcknowledged(event.target.checked)
                    }
                    data-testid="checkbox-acknowledge-issues"
                  />
                  <span>
                    راجعت التنبيهات المفتوحة، وأفهم أن القيم غير المحسومة ستبقى
                    كما وردت.
                  </span>
                </label>
              )}

              <Button
                size="lg"
                onClick={download}
                disabled={isDownloading || (hasOpenIssues && !acknowledged)}
                data-testid="button-download-export"
              >
                <ArrowDownToLine size={17} />
                {isDownloading ? "جارٍ إعداد الملفات…" : "تنزيل ملفات Excel"}
              </Button>
            </section>

            <aside className="export-side panel">
              <div className="export-side-icon">
                <ShieldCheck size={19} />
              </div>
              <h3>قبل التنزيل</h3>
              <ul>
                <li>صف العناوين يُضاف إلى كل ملف.</li>
                <li>أرقام صفوف المصدر محفوظة في ورقة سجل التوزيعات.</li>
                <li>السجلات التي لم تُوزع حصصها تبقى غير موزعة.</li>
                <li>تظل النسخة الأصلية محفوظة دون تغيير.</li>
              </ul>
              {rowsWithExtraColumns > 0 && (
                <div className="side-warning">
                  <AlertTriangle size={16} />
                  <span>
                    توجد أعمدة بعد I في {rowsWithExtraColumns.toLocaleString("ar")} صفًا؛
                    لن تدخل هذه الأعمدة في التصدير.
                  </span>
                </div>
              )}
              <div className="export-side-footer">
                {rows.length.toLocaleString("ar")} سجلًا · {fileCount.toLocaleString("ar")}{" "}
                ملف
              </div>
            </aside>
          </div>

          {hasOpenIssues && (
            <div className="notice notice-warning export-warning">
              <AlertTriangle size={17} />
              <span>
                يوجد {unresolvedIssues.length.toLocaleString("ar")} تنبيهًا
                مفتوحًا. لا تُصحح هذه القيم تلقائيًا؛ راجعها قبل التصدير أو أقرّ
                بإبقائها كما وردت.
              </span>
            </div>
          )}
        </>
      )}
    </>
  );
}

