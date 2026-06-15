"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ManualReviewBanner } from "./manual-review-banner";
import { LeagueIcon, type LeagueIconName } from "./league-icon";

const groups = [
  { label: "Workflow", links: [["Dashboard", "/", "shield"], ["Schedule", "/schedule", "calendar"], ["Result Entry", "/results", "result"], ["Week Review", "/week-review", "review"]] },
  { label: "Competition", links: [["Live Standings", "/live-standings", "table"], ["Standings", "/standings", "table"], ["H2H", "/head-to-head", "fight-card"], ["Streaks", "/streaks", "result"], ["Tiebreakers", "/tiebreakers", "belt"]] },
  { label: "Finals & Transition", links: [["League Finals", "/league-finals", "finals"], ["Post-Finals", "/post-finals-transition", "result"], ["Year Rollover", "/year-rollover", "history"], ["Schedule Setup", "/schedule-setup", "calendar"]] },
  { label: "Records & Admin", links: [["Legacy", "/legacy", "history"], ["History", "/history", "history"], ["Rulebook", "/rulebook", "rulebook"], ["Simulation", "/simulation", "simulation"]] },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="min-h-screen">
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/" className="brand"><span className="brand-mark"><LeagueIcon name="shield" /><b>LC</b></span><span><strong>League Control</strong><small>Wrestling operations center</small></span></Link>
        <details className="nav-menu">
          <summary><span>Navigation</span><span aria-hidden>☰</span></summary>
          <nav aria-label="Main navigation">
            {groups.map((group) => <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              <div>{group.links.map(([label, href, icon]) => {
                const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
                return <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}><LeagueIcon name={icon as LeagueIconName} />{label}</Link>;
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
