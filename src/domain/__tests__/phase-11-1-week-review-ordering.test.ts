import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Phase 11.1 Week Review ordering and mini standings", () => {
  const weekReview = source("src/components/week-review.tsx");
  const workflowBanner = source("src/components/workflow-summary-banner.tsx");

  it("renders the active workflow first, followed by the current week and stat cards", () => {
    expect(weekReview.indexOf("<WorkflowSummaryBanner")).toBeLessThan(weekReview.indexOf("Current week"));
    expect(weekReview.indexOf("Current week")).toBeLessThan(weekReview.indexOf('label="Scheduled"'));
    expect(weekReview.indexOf('label="Scheduled"')).toBeLessThan(weekReview.indexOf('label="Manual"'));
    expect(weekReview.indexOf('label="Manual"')).toBeLessThan(weekReview.indexOf('label="Simulation"'));
    expect(weekReview.indexOf('label="Simulation"')).toBeLessThan(weekReview.indexOf('label="State"'));
  });

  it("keeps the lock, close week, promotion, and mini standings workflow order", () => {
    expect(weekReview.indexOf('label="State"')).toBeLessThan(weekReview.indexOf("is complete and locked"));
    expect(weekReview.indexOf("is complete and locked")).toBeLessThan(weekReview.indexOf("Close Week {week}"));
    expect(weekReview.indexOf("Close Week {week}")).toBeLessThan(weekReview.indexOf("<PromoteCurrentMaster"));
    expect(weekReview.indexOf("<PromoteCurrentMaster")).toBeLessThan(weekReview.indexOf("promptPreview={<MiniLiveStandingsPreview"));
  });

  it("always renders mini standings from the shared workflow authority through its completed week", () => {
    expect(weekReview).toContain("const miniStandingsCompletedThroughWeek = authority.completedThroughYearWeek");
    expect(weekReview).toContain("const activeSplit = authority.split");
    expect(weekReview).toContain("reconstructActiveSplitLiveStandings");
    expect(weekReview).toContain("localResults: state.confirmedResults.filter((result) => result.week <= miniStandingsCompletedThroughWeek)");
    expect(weekReview).toContain("completedThroughWeek: miniStandingsCompletedThroughWeek");
    expect(weekReview).toContain("promptPreview={<MiniLiveStandingsPreview standings={updatedStandings}");
  });

  it("renders the mini standings preview as four readable league cards in a responsive 2x2 desktop grid", () => {
    expect(weekReview).toContain('className="mini-standings-grid mt-5 grid gap-5 lg:grid-cols-2"');
    expect(weekReview).not.toContain('className="mt-4 grid gap-4 xl:grid-cols-4"');
    expect(weekReview).toContain('className="mini-standings-card border border-white/10 bg-[#111722]"');
    expect(weekReview).toContain('LEAGUE_NAMES.map((league)');
    expect(weekReview).toContain('<h3 className="text-sm font-black uppercase tracking-[.14em] text-white">{league}</h3>');
  });

  it("standardizes mini standings card columns to rank, wrestler, points, and status only", () => {
    expect(weekReview).toContain('<thead><tr><th>#</th><th>Wrestler</th><th>Pts</th><th>Status</th></tr></thead>');
    expect(weekReview).not.toContain('<th>P</th>');
    expect(weekReview).toContain('className="mini-standings-wrestler"');
    expect(weekReview).toContain('className="mini-standings-zone-pill zone-pill"');
  });

  it("rounds workflow navigation buttons across pages that share the banner", () => {
    expect(workflowBanner).toContain('className="rounded-lg bg-red-500');
    expect(workflowBanner).toContain('className="rounded-lg border border-white/15');
    expect(workflowBanner).toContain('className="rounded-lg border border-emerald-400/30');
  });
});
