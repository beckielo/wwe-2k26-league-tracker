"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ManualReviewBanner } from "./manual-review-banner";

const groups = [
  { label: "Workflow", links: [["Dashboard", "/"], ["Schedule", "/schedule"], ["Result Entry", "/results"], ["Week Review", "/week-review"]] },
  { label: "Competition", links: [["Standings", "/standings"], ["H2H", "/head-to-head"], ["Streaks", "/streaks"], ["Tiebreakers", "/tiebreakers"]] },
  { label: "Finals & Transition", links: [["League Finals", "/league-finals"], ["Post-Finals", "/post-finals-transition"], ["Year Rollover", "/year-rollover"], ["Schedule Setup", "/schedule-setup"]] },
  { label: "Records & Admin", links: [["History", "/history"], ["Rulebook", "/rulebook"], ["Simulation", "/simulation"]] },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="min-h-screen">
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/" className="brand"><span className="brand-mark">2K</span><span><strong>League Control</strong><small>WWE 2K26</small></span></Link>
        <details className="nav-menu">
          <summary><span>Navigation</span><span aria-hidden>☰</span></summary>
          <nav aria-label="Main navigation">
            {groups.map((group) => <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              <div>{group.links.map(([label, href]) => {
                const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
                return <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>{label}</Link>;
              })}</div>
            </div>)}
          </nav>
        </details>
      </div>
    </header>
    <ManualReviewBanner />
    <main className="app-main">{children}</main>
    <footer className="app-footer"><span>Workbook authoritative</span><span>Explicit actions only · No guessed fixtures</span></footer>
  </div>;
}
