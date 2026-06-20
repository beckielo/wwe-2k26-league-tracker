import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Phase 13 root dashboard route regression guard", () => {
  it("keeps the app root wired directly to the League Command Center dashboard", () => {
    const page = readFileSync("src/app/page.tsx", "utf8");

    expect(page).toContain("export default function HomePage");
    expect(page).toContain("<LeagueCommandCenterDashboard />");
    expect(page).toContain("title=\"League Command Center\"");
    expect(page).toContain("<DashboardControlCenter");
    expect(page).not.toContain("redirect(");
    expect(page).not.toContain("notFound(");
    expect(page).not.toContain('href="/dashboard"');
  });

  it("keeps dashboard navigation and manual draft controls on the root dashboard instead of a dashboard-only route", () => {
    const shell = readFileSync("src/components/app-shell.tsx", "utf8");
    const dashboard = readFileSync("src/components/dashboard-control-center.tsx", "utf8");

    expect(shell).toContain('["Dashboard", "/", "shield"]');
    expect(dashboard).toContain("<CurrentUserSwitcher standings={live.composition} />");
    expect(dashboard).toContain("<ReplaceWrestlerControl");
    expect(dashboard.indexOf("<ReplaceWrestlerControl")).toBeGreaterThan(dashboard.indexOf("<SocialFeed comments={socialFeed} />"));
  });
});
