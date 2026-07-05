import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("workflow context page consistency", () => {
  const dashboard = source("src/components/dashboard-control-center.tsx");
  const standings = source("src/components/live-standings.tsx");
  const schedule = source("src/components/active-schedule.tsx");
  const resultEntry = source("src/components/result-entry-workflow.tsx");
  const simulation = source("src/components/simulation-workflow.tsx");
  const weekReview = source("src/components/week-review.tsx");
  const finals = source("src/components/league-finals.tsx");
  const shell = source("src/components/app-shell.tsx");

  it("uses the shared authority for Year, Split, active Week, and completed Week on all core pages", () => {
    expect(dashboard).toContain("authority.completedThroughYearWeek");
    expect(dashboard).toContain("authority.activeYearWeek");
    expect(standings).toContain("const split = authority.split");
    expect(standings).toContain("authority.completedThroughYearWeek");
    expect(schedule).toContain("const week = authority.activeYearWeek");
    expect(schedule).toContain("match.leagueYear === authority.leagueYear");
    expect(resultEntry).toContain("const workflowBaseline = authority.completedThroughYearWeek");
    expect(resultEntry).toContain("getWeekDisplay(authority.leagueYear, week, authority.split)");
    expect(simulation).toContain("const workflowBaseline = authority.completedThroughYearWeek");
    expect(simulation).toContain("split: authority.split");
    expect(weekReview).toContain("const activeSplit = authority.split");
    expect(weekReview).toContain("leagueYear: authority.leagueYear");
  });

  it("blocks Finals when the shared standings context is stale, invalid, or conflicted", () => {
    expect(finals).toContain('authority.confidence === "conflicted"');
    expect(finals).toContain('authority.finalsReadiness === "stale"');
    expect(finals).toContain('authority.finalsReadiness === "invalid"');
    expect(finals).toContain("contextBlocked");
    expect(finals).toContain("authority.sourceSignature");
    expect(finals).toContain('completedSplitWeek >= 22 ? "Complete through Week 22"');
    expect(finals).toContain('completedSplitWeek < 22 ? "Not reached"');
  });

  it("prevents a visible workbook-to-local context flash during hydration", () => {
    expect(shell).toContain("{hydrated");
    expect(shell).toContain('<div className="authority-loading"');
    expect(shell).toContain("? children");
  });
});
