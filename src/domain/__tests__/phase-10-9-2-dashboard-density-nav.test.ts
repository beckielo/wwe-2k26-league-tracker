import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Phase 10.9.2 dashboard density and live table navigation cleanup", () => {
  it("removes the standalone Open Live Table card while preserving legacy navigation", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");
    expect(dashboard).not.toContain("live-table-quick-link");
    expect(dashboard).not.toContain("Open Live Table");
    expect(dashboard).toContain("Open Legacy Table");
  });

  it("keeps the live standings link inside the Current User League Live Table panel", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");
    expect(dashboard).toContain("Current user table");
    expect(dashboard).toContain('<Link href="/live-standings">Full Live Standings');
  });

  it("keeps the current show as a compact six-bout prediction card", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");
    expect(dashboard).toContain('className="fight-card-list fight-card-list-compact"');
    expect(dashboard).toContain('className="fight-card-bout-compact"');
    expect(dashboard).toContain("card.length || 6");
    expect(dashboard).toContain("PredictionStrip");
    expect(dashboard).toContain("prediction-bars");
    expect(dashboard).not.toContain("Prediction · Win Chance");
    expect(dashboard).not.toContain("StatusBadge tone={recorded ? \"completed\" : \"ready\"}");
  });

  it("uses compact no-scroll live table structure for normal dashboard layout", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");
    const css = source("src/app/globals.css");
    expect(dashboard).toContain("dashboard-live-table-wrap dashboard-live-table-wrap-compact");
    expect(dashboard).toContain('className="dashboard-live-table-compact"');
    expect(css).toContain(".dashboard-live-table-wrap{overflow:visible");
    expect(css).not.toContain(".dashboard-live-table-wrap{overflow:auto");
    expect(css).toContain("table-layout:fixed");
    expect(css).toContain(".dashboard-live-table .zone-pill{display:inline-block");
  });

  it("keeps social feed rendered below the paired dashboard panels", () => {
    const dashboard = source("src/components/dashboard-control-center.tsx");
    expect(dashboard.indexOf('<div className="dashboard-primary-grid dashboard-equal-panels">')).toBeGreaterThan(-1);
    expect(dashboard.indexOf("<SocialFeed comments={socialFeed} />")).toBeGreaterThan(dashboard.indexOf("</div>\n    <SocialFeed comments={socialFeed} />"));
  });
});
