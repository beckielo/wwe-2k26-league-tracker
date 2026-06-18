/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LegacyTable } from "@/components/legacy-table";
import { MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE } from "../legacy-manual-corrections";
import { aggregateEliteCupHistory, applyLegacyHistoryRecords, auditLegacyCompletedSplitSources, legacyProfileEliteCupRecords, summarizeLegacyProfiles } from "../legacy";
import { generateLegacyCommentary, type LegacyProfile } from "../legacy-commentary";
import { LEAGUE_NAMES } from "../types";

const base = (wrestler: string): LegacyProfile => ({
  wrestler,
  currentLeague: "Global League",
  goatStatusTier: null,
  leagueWinsTotal: 0,
  globalChampionWins: 0,
  eliteCupWins: 0,
  doubles: 0,
  invincibleSplits: 0,
  invincibleHinrunden: 0,
  invincibleRueckrunden: 0,
  longestWinStreakOverall: 0,
  sourceCommentary: null,
});

const titles = (leagueYear: number, split: string) => LEAGUE_NAMES.map((league) => ({ leagueYear, split, league, wrestler: `${league} ${leagueYear}` }));

describe("Phase 10.10.5 manual Elite Cup propagation", () => {
  it("uses one canonical deduplicated Elite Cup list for summary, profiles, table rows, and commentary", () => {
    const seedProfiles = [{ ...base("Gunther"), eliteCupWins: 1 }, base("Roman Reigns"), ...LEAGUE_NAMES.flatMap((league) => [base(`${league} 1`), base(`${league} 2`)])];
    const audit = auditLegacyCompletedSplitSources([
      { source: "Legacy_Tracker", completedSplits: ["1:Historical Split"], titleRecords: titles(1, "Historical Split"), eliteCupRecords: legacyProfileEliteCupRecords(seedProfiles) },
      { source: "Post-Finals/final standings", completedSplits: ["2:Opening Split"], titleRecords: titles(2, "Opening Split") },
      MANUAL_LEGACY_COMPLETED_SPLIT_SOURCE,
    ]);
    const profiles = applyLegacyHistoryRecords(seedProfiles.map((profile) => ({ ...profile, eliteCupWins: profile.wrestler === "Gunther" ? 1 : 0 })), audit.leagueTitleRecords, audit.eliteCupRecords);
    const summary = summarizeLegacyProfiles(profiles, audit);
    const roman = profiles.find((profile) => profile.wrestler === "Roman Reigns")!;
    const gunther = profiles.find((profile) => profile.wrestler === "Gunther")!;

    expect(audit.eliteCupRecords.map((record) => record.wrestler).sort()).toEqual(["Gunther", "Roman Reigns"]);
    expect(summary.leagueTitleRecords).toBe(8);
    expect(summary.eliteCupRecords).toBe(2);
    expect(roman.eliteCupWins).toBe(1);
    expect(gunther.eliteCupWins).toBe(1);
    expect(generateLegacyCommentary(roman, profiles).text).not.toMatch(/missing an Elite Cup|lacks an Elite Cup|no title or Elite Cup win|an Elite Cup win is required/i);
    expect(generateLegacyCommentary(roman, profiles).text).toMatch(/Elite Cup/i);

    render(<LegacyTable profiles={profiles} />);
    expect(screen.getByRole("row", { name: /Roman Reigns/ }).textContent).toMatch(/Roman Reigns/);
    expect(screen.queryByText(/Legacy aggregation incomplete/i)).toBeNull();
  });

  it("normalizes equivalent Elite Cup event names and duplicate Roman manual plus automatic records count once", () => {
    const aggregation = aggregateEliteCupHistory([
      { leagueYear: 2, split: "Opening Split", eventName: "League Finals Elite Cup", wrestler: "Roman Reigns", sourceLabel: "League Finals records" },
      { leagueYear: 2, split: "Opening Split", eventName: "Global League Elite Cup", wrestler: " Roman   Reigns ", sourceLabel: "User-confirmed manual historical correction" },
    ], ["2:Opening Split"]);

    expect(aggregation.winnerRecords).toHaveLength(1);
    expect(aggregation.winnerRecords[0]).toMatchObject({ eventName: "Global Elite Cup", wrestler: "Roman Reigns", sourceLabel: "League Finals records" });
  });
});
