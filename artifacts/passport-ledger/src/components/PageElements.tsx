import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "blue",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  tone?: "blue" | "amber" | "green" | "violet";
}) {
  return (
    <article className={`metric-card metric-${tone}`} data-testid={`metric-${tone}`}>
      <div className="metric-top">
        <span className="metric-icon">
          <Icon size={18} strokeWidth={1.9} />
        </span>
        <span className="metric-label">{label}</span>
      </div>
      <strong className="metric-value" data-testid="text-metric-value">
        {value}
      </strong>
      <span className="metric-detail">{detail}</span>
    </article>
  );
}

export function SectionHeading({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  icon: Icon,
}: {
  title: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={24} strokeWidth={1.7} />
      </span>
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}

