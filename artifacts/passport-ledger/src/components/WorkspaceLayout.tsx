import type { ReactNode } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  FileSearch,
  Files,
  LayoutDashboard,
  ReceiptText,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useWorkspace } from "@/lib/workspace-context";

const navigation = [
  { href: "/", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/transactions", label: "السجلات", icon: Files },
  { href: "/review", label: "المراجعة", icon: FileSearch },
  { href: "/shared", label: "السندات المشتركة", icon: ReceiptText },
  { href: "/agents", label: "أسماء الوكلاء", icon: UsersRound },
  { href: "/export", label: "التصدير", icon: ArrowUpRight },
];

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const {
    fileName,
    isReady,
    isSaving,
    storageError,
    savedAt,
    issues,
  } = useWorkspace();

  const saveLabel = !isReady
    ? "جارٍ استعادة البيانات"
    : isSaving
      ? "جارٍ الحفظ على الجهاز"
      : storageError
        ? "تعذر الحفظ"
        : savedAt
          ? "محفوظ محليًا"
          : "لا توجد بيانات محفوظة";

  return (
    <div className="workspace-shell" dir="rtl">
      <aside className="workspace-sidebar">
        <Link href="/" className="brand-lockup" data-testid="link-home-brand">
          <span className="brand-mark" aria-hidden="true">
            <BadgeCheck size={21} strokeWidth={2.1} />
          </span>
          <span>
            <span className="brand-title">مِيزان</span>
            <span className="brand-caption">تدقيق السندات والجوازات</span>
          </span>
        </Link>

        <div className="sidebar-section-label">مساحة العمل</div>
        <nav className="main-navigation" aria-label="التنقل الرئيسي">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link
                href={href}
                key={href}
                className={`nav-link${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
                data-testid={`link-nav-${href === "/" ? "home" : href.slice(1)}`}
              >
                <Icon size={18} strokeWidth={1.9} />
                <span>{label}</span>
                {href === "/review" && (
                  <span className="nav-count" data-testid="text-nav-review-count">
                      {issues.filter((issue) => !issue.resolved).length}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />
        <div className="privacy-card">
          <span className="privacy-icon">
            <ShieldCheck size={17} />
          </span>
          <div>
            <strong>خصوصية البيانات</strong>
            <p>الملفات والتعديلات محفوظة في هذا المتصفح فقط.</p>
          </div>
        </div>
        <div className="sidebar-footer">
          <WalletCards size={16} />
          <span>{saveLabel}</span>
          <span
            className={`save-indicator${storageError ? " error" : ""}`}
            aria-label={saveLabel}
          />
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <div className="topbar-title">
            <span className="topbar-eyebrow">دفتر المعاملات</span>
            <span className="topbar-file" data-testid="text-current-filename">
              {fileName || "ابدأ برفع ملف Excel"}
            </span>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <span className="local-dot" />
              معالجة محلية
            </span>
            {storageError && (
              <span className="storage-warning" role="status">
                {storageError}
              </span>
            )}
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>

      <nav className="mobile-navigation" aria-label="التنقل">
        {navigation.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link
              href={href}
              key={href}
              className={`mobile-nav-link${active ? " active" : ""}`}
              data-testid={`mobile-nav-${href === "/" ? "home" : href.slice(1)}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

