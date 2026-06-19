import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Phase 11.1 Week Review ordering and mini standings", () => {
  const weekReview = source("src/components/week-review.tsx");
  const workflowBanner = source("src/components/workflow-summary-banner.tsx");

  it("renders Active browser-local workflow first, followed by current app week and stat cards", () => {
    expect(weekReview.indexOf("<WorkflowSummaryBanner")).toBeLessThan(weekReview.indexOf("Current active app week"));
    expect(weekReview.indexOf("Current active app week")).toBeLessThan(weekReview.indexOf('label="Scheduled"'));
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

  it("always renders mini standings from the Live Standings source through the latest locked or workbook week", () => {
    expect(weekReview).toContain("const miniStandingsCompletedThroughWeek = latestLockedWeek ?? workbookCurrentWeek");
    expect(weekReview).toContain("reconstructActiveSplitLiveStandings");
    expect(weekReview).toContain("localResults: state.confirmedResults.filter((result) => result.week <= miniStandingsCompletedThroughWeek)");
    expect(weekReview).toContain("completedThroughWeek: miniStandingsCompletedThroughWeek");
    expect(weekReview).toContain("promptPreview={<MiniLiveStandingsPreview standings={updatedStandings}");
  });

  it("rounds workflow navigation buttons across pages that share the banner", () => {
    expect(workflowBanner).toContain('className="rounded-lg bg-red-500');
    expect(workflowBanner).toContain('className="rounded-lg border border-white/15');
    expect(workflowBanner).toContain('className="rounded-lg border border-emerald-400/30');
  });
});
