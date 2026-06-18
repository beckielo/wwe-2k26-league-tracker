import { describe, expect, it } from "vitest";
import { auditLegacyCompletedSplitSources, aggregateEliteCupHistory, aggregateLeagueTitleHistory } from "../legacy";
import { generateLegacyCommentary, type LegacyProfile } from "../legacy-commentary";
import { LEAGUE_NAMES } from "../types";

const base: LegacyProfile = {
  wrestler: "Test Wrestler",
  currentLeague: "Global League",
  goatStatusTier: null,
  leagueWinsTotal: 1,
  globalChampionWins: 0,
  eliteCupWins: 0,
  doubles: 0,
  invincibleSplits: 0,
  invincibleHinrunden: 0,
  invincibleRueckrunden: 0,
  longestWinStreakOverall: 7,
  sourceCommentary: null,
};

function titles(leagueYear: number, split: string, sourceLabel: string) {
  return LEAGUE_NAMES.map((league) => ({ leagueYear, split, league, wrestler: `${split} ${league} Champion`, sourceLabel }));
}

describe("Phase 10.10.2 legacy completed split audit", () => {
  it("does not rely only on Legacy_Tracker when Post-Finals completed split records exist", () => {
    const audit = auditLegacyCompletedSplitSources([
      { source: "Legacy_Tracker", completedSplits: ["1:Historical Split"], titleRecords: titles(1, "Historical Split", "Legacy_Tracker"), eliteCupRecords: [{ leagueYear: 1, split: "Historical Split", eventName: "Global Elite Cup", wrestler: "Cup 1" }] },
      { source: "Post-Finals final standings", completedSplits: ["2:Opening Split"], titleRecords: titles(2, "Opening Split", "Post-Finals") },
      { source: "League Finals records", completedSplits: ["2:Opening Split"], eliteCupRecords: [{ leagueYear: 2, split: "Opening Split", eventName: "Global Elite Cup", wrestler: "Cup 2" }] },
    ]);
    expect(audit.leagueTitleRecords).toHaveLength(8);
    expect(audit.eliteCupRecords).toHaveLength(2);
    expect(audit.diagnostics).toEqual([]);
  });

  it("deduplicates overlap, excludes active Closing Split, and diagnoses incomplete completed sources", () => {
    const opening = titles(2, "Opening Split", "Post-Finals");
    const audit = auditLegacyCompletedSplitSources([
      { source: "Legacy_Tracker", completedSplits: ["1:Historical Split"], titleRecords: titles(1, "Historical Split", "Legacy_Tracker"), eliteCupRecords: [{ leagueYear: 1, split: "Historical Split", eventName: "Global Elite Cup", wrestler: "Cup 1" }] },
      { source: "Post-Finals", completedSplits: ["2:Opening Split"], titleRecords: opening },
      { source: "Final standings duplicate", titleRecords: opening },
      { source: "Active Closing Split", completedSplits: [], titleRecords: titles(2, "Closing Split", "Active") },
    ]);
    expect(aggregateLeagueTitleHistory([...titles(1, "Historical Split", "Legacy"), ...opening]).titleRecords).toHaveLength(8);
    expect(aggregateEliteCupHistory([{ leagueYear: 1, split: "Historical Split", wrestler: "Cup 1" }], ["1:Historical Split", "2:Opening Split"]).winnerRecords).toHaveLength(1);
    expect(audit.duplicateRecordsRemoved).toBeGreaterThan(0);
    expect(audit.diagnostics.join(" ")).toContain("expected 8 league title records and 2 Elite Cup records");
  });
});

describe("Phase 10.10.2 Tier B commentary diversity", () => {
  it("varies deterministic journalist profiles and updates when stats change", () => {
    const one = generateLegacyCommentary({ ...base, wrestler: "Alpha" });
    const two = generateLegacyCommentary({ ...base, wrestler: "Bravo", currentLeague: "National League" });
    const upgraded = generateLegacyCommentary({ ...base, wrestler: "Alpha", eliteCupWins: 1 });
    expect(one.feature).toBe(false);
    expect(one.text).toMatch(/Tier B|Tier A|Tier S/i);
    expect(one.text).toMatch(/Global League title|Elite Cup win|invincible split|repeated title-level/i);
    expect(one.text).not.toContain("What is missing for Tier A or Tier S is");
    expect(one.text).not.toBe(two.text);
    expect(upgraded.text).not.toBe(one.text);
    expect(upgraded.evidenceTags).toContain("1 Elite Cup Win");
  });

  it("keeps S/A feature commentary and C/D compact", () => {
    expect(generateLegacyCommentary({ ...base, globalChampionWins: 1 }).feature).toBe(true);
    expect(generateLegacyCommentary({ ...base, leagueWinsTotal: 0, longestWinStreakOverall: 1 }).feature).toBe(false);
  });
});
