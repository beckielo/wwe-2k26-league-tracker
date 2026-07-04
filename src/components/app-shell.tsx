"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ManualReviewBanner } from "./manual-review-banner";
import { LeagueIcon, type LeagueIconName } from "./league-icon";

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
          <strong>National League</strong>
          <small>
            <i />
            Workbook connected
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
            <span className="context-season">League Year 2</span>
            <span className="context-source">
              <i />
              Workbook connected
            </span>
            <span className="context-user" aria-label="Current user Beckielo, National League">
              <b>B</b>
              <span>
                <strong>Beckielo</strong>
                <small>National League</small>
              </span>
            </span>
          </div>
        </header>

        <ManualReviewBanner />
        <main id="main-content" className="app-main">
          {children}
        </main>
        <footer className="app-footer">
          <span>Workbook authoritative</span>
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
