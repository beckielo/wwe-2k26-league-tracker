/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LegacyTable } from "@/components/legacy-table";
import { aggregateEliteCupHistory, applyLegacyHistoryRecords, auditLegacyCompletedSplitSources, extractCompletedEliteCupRecordsFromFinalStandings, summarizeLegacyProfiles } from "../legacy";
import { comparativeSignals, generateLegacyCommentary, sortLegacyProfiles, type LegacyProfile } from "../legacy-commentary";
import { LEAGUE_NAMES, type StandingRow } from "../types";

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

describe("Phase 10.10.3 Elite Cup recovery", () => {
  it("keeps two completed splits at eight league titles and recovers two Elite Cup records from fallback history", () => {
    const audit = auditLegacyCompletedSplitSources([
      { source: "Legacy_Tracker", completedSplits: ["1:Historical Split"], titleRecords: titles(1, "Historical Split"), eliteCupRecords: [{ leagueYear: 1, split: "Historical Split", eventName: "Global Elite Cup", wrestler: "Gunther" }] },
      { source: "Post-Finals/final standings", completedSplits: ["2:Opening Split"], titleRecords: titles(2, "Opening Split") },
      { source: "League Finals records", completedSplits: ["2:Opening Split"], eliteCupRecords: [{ leagueYear: 2, split: "Opening Split", eventName: "Global Elite Cup", wrestler: "Recovered Winner" }] },
    ]);

    const profiles = applyLegacyHistoryRecords([base("Gunther"), base("Recovered Winner"), ...LEAGUE_NAMES.flatMap((league) => [base(`${league} 1`), base(`${league} 2`)])], audit.leagueTitleRecords, audit.eliteCupRecords);
    const summary = summarizeLegacyProfiles(profiles, audit);

    expect(summary.leagueTitleRecords).toBe(8);
    expect(summary.eliteCupRecords).toBe(2);
    expect(profiles.find((profile) => profile.wrestler === "Recovered Winner")?.eliteCupWins).toBe(1);
    expect(summary.diagnostics.join(" ")).not.toContain("Elite Cup aggregation incomplete");
  });

  it("deduplicates duplicate Elite Cup records and ignores active split records not marked completed", () => {
    const aggregation = aggregateEliteCupHistory([
      { leagueYear: 1, split: "Historical Split", eventName: "Global Elite Cup", wrestler: "Gunther", sourceLabel: "Legacy_Tracker" },
      { leagueYear: 1, split: "Historical Split", eventName: "Global Elite Cup", wrestler: "Gunther", sourceLabel: "League Finals records" },
      { leagueYear: 2, split: "Closing Split", eventName: "Global Elite Cup", wrestler: "Active Winner" },
    ], ["1:Historical Split"]);

    expect(aggregation.winnerRecords).toHaveLength(1);
    expect(aggregation.winnerRecords[0].wrestler).toBe("Gunther");
  });

  it("extracts a completed Elite Cup winner from finalized Global Champion plus Elite Cup status", () => {
    const standings = LEAGUE_NAMES.flatMap((league): StandingRow[] => [{ league, rank: 1, wrestler: `${league} Champ`, seed: 1, matches: 22, wins: 22, draws: 0, losses: 0, points: 66, status: league === "Global League" ? "Champion + Elite Cup" : "Champion" }]);
    const recovered = extractCompletedEliteCupRecordsFromFinalStandings(standings, 2, "Opening Split", "Post-Finals status");
    expect(recovered.eliteCupRecords).toEqual([{ leagueYear: 2, split: "Opening Split", eventName: "Global Elite Cup", wrestler: "Global League Champ", sourceLabel: "Post-Finals status" }]);
  });
});

describe("Phase 10.10.3 comparative commentary", () => {
  it("recognizes best streak and standout Tier B value without inventing titles", () => {
    const leader = { ...base("Streak Leader"), longestWinStreakOverall: 9 };
    const field = sortLegacyProfiles([leader, { ...base("Champion Peer"), leagueWinsTotal: 1, longestWinStreakOverall: 3 }, { ...base("Cup Peer"), eliteCupWins: 1 }]);
    const commentary = generateLegacyCommentary(leader, [leader, ...field.filter((profile) => profile.wrestler !== leader.wrestler)]);

    expect(commentary.text).toMatch(/best recorded run|top band|strongest peer-relative|under-accomplished/i);
    expect(commentary.text).toMatch(/not counted as silverware|no title or Elite Cup win/);
    expect(commentary.evidenceTags.join(" ")).not.toMatch(/Elite Cup Win|Global Title|League Title/);
  });

  it("changes when peer context makes the same row relatively stronger or weaker", () => {
    const target = { ...base("Comparator"), longestWinStreakOverall: 8 };
    const weakerField = [target, { ...base("Peer"), longestWinStreakOverall: 4 }];
    const strongerField = [target, { ...base("Peer"), longestWinStreakOverall: 12 }];

    expect(generateLegacyCommentary(target, weakerField).text).not.toBe(generateLegacyCommentary(target, strongerField).text);
    expect(comparativeSignals(target, weakerField).tiedBestLongestStreak).toBe(true);
    expect(comparativeSignals(target, strongerField).tiedBestLongestStreak).toBe(false);
  });

  it("keeps diagnostics and removed controls out of the standard Legacy table UI", () => {
    render(<LegacyTable profiles={[base("A"), { ...base("B"), leagueWinsTotal: 1 }]} />);
    expect(screen.queryByText(/Legacy aggregation incomplete/i)).toBeNull();
    expect(screen.queryByText(/Journalist View/i)).toBeNull();
    expect(screen.queryByRole("columnheader", { name: /Rank/i })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: /Commentary/i })).toBeNull();
  });
});

describe("Phase 10.10.4 manual Elite Cup history correction", () => {
  it("adds the user-confirmed Roman Reigns LY2 Opening Split Elite Cup correction without changing league titles", () => {
    const audit = auditLegacyCompletedSplitSources([
      { source: "Legacy_Tracker", completedSplits: ["1:Historical Split"], titleRecords: titles(1, "Historical Split"), eliteCupRecords: [{ leagueYear: 1, split: "Historical Split", eventName: "Global Elite Cup", wrestler: "Gunther" }] },
      { source: "Post-Finals/final standings", completedSplits: ["2:Opening Split"], titleRecords: titles(2, "Opening Split") },
      { source: "User-confirmed manual historical correction", completedSplits: ["2:Opening Split"], eliteCupRecords: [{ leagueYear: 2, split: "Opening Split", eventName: "Global Elite Cup", wrestler: "Roman Reigns", sourceLabel: "User-confirmed manual correction" }] },
    ]);

    const profiles = applyLegacyHistoryRecords([base("Gunther"), base("Roman Reigns"), ...LEAGUE_NAMES.flatMap((league) => [base(`${league} 1`), base(`${league} 2`)])], audit.leagueTitleRecords, audit.eliteCupRecords);
    const summary = summarizeLegacyProfiles(profiles, audit);
    const roman = profiles.find((profile) => profile.wrestler === "Roman Reigns");

    expect(summary.leagueTitleRecords).toBe(8);
    expect(summary.eliteCupRecords).toBe(2);
    expect(roman?.eliteCupWins).toBe(1);
    expect(generateLegacyCommentary(roman!, profiles).text).toMatch(/Elite Cup/i);
  });

  it("counts duplicate automatic and manual Roman LY2 Opening Split Elite Cup records only once", () => {
    const aggregation = aggregateEliteCupHistory([
      { leagueYear: 2, split: "Opening Split", eventName: "Global Elite Cup", wrestler: "Roman Reigns", sourceLabel: "League Finals records" },
      { leagueYear: 2, split: "Opening Split", eventName: "Global Elite Cup", wrestler: "Roman Reigns", sourceLabel: "User-confirmed manual historical correction" },
    ], ["2:Opening Split"]);

    expect(aggregation.winnerRecords).toHaveLength(1);
    expect(aggregation.winnerRecords[0]).toMatchObject({ wrestler: "Roman Reigns", sourceLabel: "League Finals records" });
  });
});
