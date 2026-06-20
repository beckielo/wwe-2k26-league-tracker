import Link from "next/link";
import type { ReactNode } from "react";

export type StatusTone = "current" | "completed" | "locked" | "review" | "ready" | "neutral";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusTone }) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}

export function PhaseBadge({ children }: { children: ReactNode }) {
  return <span className="phase-badge">{children}</span>;
}

export function PageHeader({ eyebrow, title, description, aside, metadata }: { eyebrow: string; title: string; description: string; aside?: ReactNode; metadata?: string }) {
  return <header className="page-header">
    <div className="max-w-3xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1>{title}</h1>
      {metadata && <p className="page-metadata">{metadata}</p>}
      <p className="page-description">{description}</p>
    </div>
    {aside && <div className="page-header-aside">{aside}</div>}
  </header>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}

export function SectionCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`section-card ${className}`}>{children}</section>;
}

export function Stat({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="info-card">
    <p className="info-label">{label}</p>
    <p className="info-value">{value}</p>
    {detail && <p className="info-detail">{detail}</p>}
  </div>;
}

export const InfoCard = Stat;

export function ActionButton({ href, children, variant = "primary", disabled = false, reason }: { href?: string; children: ReactNode; variant?: "primary" | "secondary"; disabled?: boolean; reason?: string }) {
  const className = `action-button action-${variant}${disabled ? " is-disabled" : ""}`;
  return <div>
    {href && !disabled ? <Link href={href} className={className}>{children}</Link> : <button className={className} disabled={disabled}>{children}</button>}
    {disabled && reason && <LockedReason>{reason}</LockedReason>}
  </div>;
}

export function LockedReason({ children }: { children: ReactNode }) {
  return <p className="locked-reason"><span aria-hidden>🔒</span> {children}</p>;
}

export function PrimaryActionCard({ eyebrow = "Next action", title, description, href, action, tone = "current", lockedReason, children }: { eyebrow?: string; title: string; description: string; href?: string; action?: string; tone?: StatusTone; lockedReason?: string; children?: ReactNode }) {
  return <section className={`primary-action-card action-card-${tone}`}>
    <div>
      <div className="flex flex-wrap items-center gap-3"><Eyebrow>{eyebrow}</Eyebrow><StatusBadge tone={tone}>{tone === "current" ? "Next Action" : tone}</StatusBadge></div>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
    {action && <ActionButton href={href} disabled={Boolean(lockedReason)} reason={lockedReason}>{action}</ActionButton>}
  </section>;
}

export function AdvancedDetails({ summary, children }: { summary: string; children: ReactNode }) {
  return <details className="advanced-details"><summary>{summary}</summary><div>{children}</div></details>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><div className="empty-state-mark" aria-hidden>—</div><h3>{title}</h3><p>{description}</p></div>;
}

export function WarningPanel({ category, title, children, collapsible = false }: { category: "Blocking" | "Review Required" | "Source Warning" | "Historical / Non-blocking"; title: string; children: ReactNode; collapsible?: boolean }) {
  const content = <><StatusBadge tone={category === "Blocking" ? "locked" : category === "Review Required" ? "review" : "neutral"}>{category}</StatusBadge><h3>{title}</h3><div className="warning-copy">{children}</div></>;
  return collapsible ? <details className="warning-panel"><summary>{category}: {title}</summary><div className="warning-inner">{content}</div></details> : <section className="warning-panel warning-inner">{content}</section>;
}

export function WorkflowTimeline({ items }: { items: { label: string; status: StatusTone }[] }) {
  return <ol className="workflow-timeline" aria-label="League year workflow">
    {items.map((item, index) => <li key={item.label} className={`timeline-${item.status}`}>
      <span className="timeline-index">{index + 1}</span><span>{item.label}</span><StatusBadge tone={item.status}>{item.status}</StatusBadge>
    </li>)}
  </ol>;
}
