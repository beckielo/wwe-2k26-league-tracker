"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ManualReviewBanner } from "./manual-review-banner";
import { LeagueIcon, type LeagueIconName } from "./league-icon";
import { useTrackerState } from "@/state/tracker-state-provider";

type NavigationItem = {
  label: string;
  href: string;
  icon: LeagueIconName;
};

const navigationGroups = [
  {
    label: "Competition",
    links: [
      ["Dashboard", "/", "shield"],
      ["Schedule", "/schedule", "calendar"],
      ["Live Standings", "/live-standings", "table"],
      ["Result Entry", "/results", "result"],
      ["Simulation", "/simulation", "simulation"],
      ["Week Review", "/week-review", "review"],
      ["League Finals", "/league-finals", "finals"],
    ],
  },
] as const;

const internalNavigationGroups = [
  {
    label: "Analysis",
    internalOnly: true,
    links: [
      ["All Standings", "/standings", "table"],
      ["Head-to-Head", "/head-to-head", "fight-card"],
      ["Streaks", "/streaks", "result"],
      ["Tiebreakers", "/tiebreakers", "belt"],
    ],
  },
  {
    label: "Management",
    internalOnly: true,
    links: [
      ["Post-Finals", "/post-finals-transition", "result"],
      ["Year Rollover", "/year-rollover", "history"],
      ["Schedule Setup", "/schedule-setup", "calendar"],
      ["Legacy", "/legacy", "history"],
      ["History", "/history", "history"],
      ["Rulebook", "/rulebook", "rulebook"],
    ],
  },
] as const;

const mobileItems: NavigationItem[] = [
  { label: "Home", href: "/", icon: "shield" },
  { label: "Schedule", href: "/schedule", icon: "calendar" },
  { label: "Results", href: "/results", icon: "result" },
  { label: "Standings", href: "/live-standings", icon: "table" },
];

const mobileMoreItems: NavigationItem[] = navigationGroups[0].links
  .slice(4)
  .map(([label, href, icon]) => ({ label, href, icon }));

const routeTitles = Object.fromEntries(
  [...navigationGroups, ...internalNavigationGroups].flatMap((group) =>
    group.links.map(([label, href]) => [href, label]),
  ),
) as Record<string, string>;

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function NavigationLink({
  item,
  pathname,
  compact = false,
}: {
  item: NavigationItem;
  pathname: string;
  compact?: boolean;
}) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={`${compact ? "mobile-nav-link" : "sidebar-link"}${active ? " active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <LeagueIcon name={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const currentTitle = routeTitles[pathname] ?? "League Control";
  const { authority, hydrated, state } = useTrackerState();
  const sourceLabel = authority.activeSource === "local"
    ? "Validated local session"
    : authority.activeSource === "app-workbook"
      ? "Validated app checkpoint"
      : "Workbook fallback";
  const userLeague = state.activeWorkflow?.userLeague ?? "National League";

  return (
    <div className="sports-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <aside className="sports-sidebar" aria-label="League navigation">
        <Link href="/" className="shell-brand">
          <span className="shell-brand-mark">
            <Image
              src="/brand-assets/decorative/site/deco-gwf-logo.png"
              alt=""
              width={44}
              height={44}
              priority
            />
          </span>
          <span>
            <strong>League Control</strong>
            <small>Wrestling operations center</small>
          </span>
        </Link>

        <nav className="sidebar-navigation" aria-label="Main navigation">
          {navigationGroups.map((group) => (
            <section className="sidebar-group" key={group.label}>
              <p>{group.label}</p>
              <div>
                {group.links.map(([label, href, icon]) => (
                  <NavigationLink key={href} item={{ label, href, icon }} pathname={pathname} />
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="sidebar-context">
          <span>Current league</span>
          <strong>{userLeague}</strong>
          <small>
            <i />
            {sourceLabel}
          </small>
        </div>
      </aside>

      <div className={`shell-workspace route-${pathname === "/" ? "dashboard" : pathname.slice(1).replaceAll("/", "-")}`}>
        <header className="context-bar">
          <div className="context-heading">
            <span>League Control</span>
            <strong>{currentTitle}</strong>
          </div>
          <div className="context-actions">
            <span className="context-season">
              League Year {authority.leagueYear} · {authority.split.replace(" Split", "")} W{authority.splitWeek}
            </span>
            <span className="context-source">
              <i />
              {sourceLabel}
            </span>
            <span className="context-user" aria-label={`Current user Beckielo, ${userLeague}`}>
              <b>B</b>
              <span>
                <strong>Beckielo</strong>
                <small>{userLeague}</small>
              </span>
            </span>
          </div>
        </header>

        {hydrated && <WorkflowContextNotice />}
        {hydrated && <ManualReviewBanner />}
        <main id="main-content" className="app-main">
          {hydrated
            ? children
            : <div className="authority-loading" role="status">Validating workflow context…</div>}
        </main>
        <footer className="app-footer">
          <span>{sourceLabel}</span>
          <span>Explicit actions only · No guessed fixtures</span>
        </footer>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {mobileItems.map((item) => (
          <NavigationLink key={item.href} item={item} pathname={pathname} compact />
        ))}
        <details className="mobile-more-menu">
          <summary className={mobileMoreItems.some((item) => isActive(pathname, item.href)) ? "active" : ""}>
            <LeagueIcon name="rulebook" />
            <b>More</b>
          </summary>
          <div className="mobile-more-panel">
            <section>
              <p>Competition</p>
              <div>
                {mobileMoreItems.map((item) => (
                  <NavigationLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </section>
          </div>
        </details>
      </nav>
    </div>
  );
}

export function WorkflowContextNotice() {
  const { authority } = useTrackerState();
  const blocking = authority.blockingConflicts;
  const diagnostics = authority.diagnosticNotices;
  if (blocking.length === 0 && diagnostics.length === 0 && authority.confidence === "high") return null;
  const authorityLabel = authority.activeSource === "local"
    ? "Validated local session"
    : authority.activeSource === "app-workbook"
      ? "Validated app checkpoint"
      : "Workbook fallback";

  if (blocking.length === 0 && diagnostics.length > 0 && authority.activeSource !== "workbook-dashboard") {
    return (
      <aside className="workflow-context-diagnostics" aria-label="Context diagnostics">
        <details>
          <summary>{diagnostics.length} context notice{diagnostics.length === 1 ? "" : "s"}</summary>
          <div>
            <strong>{authorityLabel}</strong>
            <p>{diagnostics[0].message}</p>
            <ul>{diagnostics.map((entry) => (
              <li key={`${entry.code}:${entry.message}`}>
                <strong>{entry.code}</strong>
                <span>{entry.message}</span>
              </li>
            ))}</ul>
          </div>
        </details>
      </aside>
    );
  }

  const lead = blocking[0] ?? diagnostics[0];
  const notices = [...blocking, ...diagnostics];
  return (
    <section
      className={`workflow-authority-notice confidence-${authority.confidence}${blocking.length > 0 ? " has-blocking-conflict" : ""}`}
      aria-label="Workflow context authority"
      role={blocking.length > 0 ? "alert" : "status"}
    >
      <div>
        <span>Context authority</span>
        <strong>{authorityLabel}</strong>
        <small>Confidence: {authority.confidence} · {authority.sourceSignature}</small>
      </div>
      {lead && <p>{lead.message} {lead.recommendedAction}</p>}
      {notices.length > 0 && (
        <details>
          <summary>{notices.length} context notice{notices.length === 1 ? "" : "s"}</summary>
          <ul>{notices.map((entry) => (
            <li key={`${entry.code}:${entry.message}`}>
              <strong>{entry.code}</strong>
              <span>{entry.message}</span>
            </li>
          ))}</ul>
        </details>
      )}
    </section>
  );
}
