import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Phase 10.9.3 dashboard show density and header cleanup", () => {
  it("removes the top dashboard metadata/stat card grid while preserving the main League Control card", () => {
    const page = source("src/app/page.tsx");
    const dashboard = source("src/components/dashboard-control-center.tsx");

    expect(page).not.toContain("dashboard-stats");
    expect(page).not.toContain("Completed baseline");
    expect(page).not.toContain("User brand");
    expect(page).not.toContain("Control status");
    expect(dashboard).toContain("Live league control");
    expect(dashboard).toContain("command-deck");
  });

  it("keeps the current user-controlled show as six compact scheduled bouts without ready badges", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");

    expect(dashboard).toContain("Current user-controlled show");
    expect(dashboard).toContain("card.length || 6");
    expect(dashboard).toContain("fight-card-list fight-card-list-compact");
    expect(dashboard).toContain("fight-card-bout-compact");
    expect(dashboard).not.toContain("Ready</StatusBadge>");
    expect(dashboard).not.toContain("Recorded</StatusBadge>");
  });

  it("shows only essential prediction UI in dashboard match rows", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");

    expect(dashboard).toContain("PredictionStrip");
    expect(dashboard).toContain("prediction-bars");
    expect(dashboard).toContain("prediction.probabilityA}%");
    expect(dashboard).toContain("prediction.probabilityB}%");
    expect(dashboard).not.toContain("Prediction · Win Chance");
    expect(dashboard).not.toContain("confidence</strong>");
    expect(dashboard).not.toContain("Medium Confidence");
    expect(dashboard).not.toContain("Form edge:");
    expect(dashboard).not.toContain("prediction.explanation");
  });

  it("preserves the live table link and social feed below the paired panels", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");

    expect(dashboard).toContain("Current user league live table");
    expect(dashboard).toContain('<Link href="/live-standings">Full Live Standings');
    expect(dashboard).toContain("League Social Feed");
    expect(dashboard.indexOf('<div className="dashboard-primary-grid dashboard-equal-panels">')).toBeGreaterThan(-1);
    expect(dashboard.indexOf("<SocialFeed comments={socialFeed} />")).toBeGreaterThan(dashboard.indexOf("<UserLeagueLiveTable league={userLeague} rows={userLeagueRows} />"));
  });
});
