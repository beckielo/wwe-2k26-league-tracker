import { describe, expect, it } from "vitest";
import { buildCurrentStandingsFromScheduleComposition, validateCurrentLeagueComposition } from "../current-league-composition";
import { aggregateEliteCupHistory, aggregateLeagueTitleHistory, applyLegacyHistoryRecords, enrichLegacyProfilesWithCompletedSplitChampions, summarizeLegacyProfiles } from "../legacy";
import { generateLegacyCommentary, type LegacyProfile } from "../legacy-commentary";
import { LEAGUE_NAMES, type LeagueName, type Match, type MatchResult, type StandingRow } from "../types";

const names = (league: LeagueName) => Array.from({ length: 12 }, (_, index) => `${league} ${index + 1}`);
const openingNational = "Jey Uso";
const closingContinental = "Jey Uso";

function standings(): StandingRow[] {
  return LEAGUE_NAMES.flatMap((league) => names(league).map((wrestler, index) => ({
    league,
    rank: index + 1,
    wrestler: league === "National League" && index === 0 ? openingNational : wrestler,
    seed: index + 1,
    matches: 22,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    status: index === 0 ? "Champion" : "",
  })));
}

function closingMatches(): Match[] {
  return LEAGUE_NAMES.flatMap((league) => {
    const roster = names(league);
    if (league === "National League") roster[0] = "National League promoted replacement";
    if (league === "Continental League") roster[0] = closingContinental;
    return Array.from({ length: 6 }, (_, index) => ({
      id: `${league}-${index}`,
      leagueYear: 2,
      split: "Closing Split" as const,
      week: 25,
      roundType: "Hinrunde" as const,
      league,
      showDay: "Montag" as const,
      matchNumber: index + 1,
      wrestlerA: roster[index * 2],
      wrestlerB: roster[index * 2 + 1],
      matchupKey: `${roster[index * 2]}::${roster[index * 2 + 1]}`,
      status: "completed" as const,
      source: { file: "test.xlsx", sheet: "App_Accepted_Schedule" },
    }));
  });
}

describe("Phase 10.8.4 current league composition", () => {
  it("moves a promoted wrestler into the current schedule league and calculates Closing Split points there", () => {
    const matches = closingMatches();
    const jeyMatch = matches.find((match) => match.wrestlerA === "Jey Uso" || match.wrestlerB === "Jey Uso")!;
    const results: MatchResult[] = [{ matchId: jeyMatch.id, outcome: "decisive", winner: "Jey Uso", loser: jeyMatch.wrestlerA === "Jey Uso" ? jeyMatch.wrestlerB : jeyMatch.wrestlerA, resultSource: "Simulation", notes: null, source: jeyMatch.source }];

    const current = buildCurrentStandingsFromScheduleComposition(standings(), matches, results, "Closing Split")!;

    expect(current.find((row) => row.wrestler === "Jey Uso")).toMatchObject({ league: "Continental League", matches: 1, wins: 1, points: 3 });
    expect(current).not.toEqual(expect.arrayContaining([expect.objectContaining({ wrestler: "Jey Uso", league: "National League" })]));
    expect(validateCurrentLeagueComposition(current, matches, "Closing Split")).toEqual([]);
    for (const league of LEAGUE_NAMES) expect(current.filter((row) => row.league === league)).toHaveLength(12);
    expect(new Set(current.map((row) => row.wrestler))).toHaveProperty("size", 48);
  });

  it("reports a specific diagnostic when standings and schedule disagree", () => {
    const issues = validateCurrentLeagueComposition(standings(), closingMatches(), "Closing Split");
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ message: "Current league composition mismatch: Jey Uso is scheduled in Continental League but standings roster places him in National League." })]));
  });
});

describe("Phase 10.8.4 legacy title aggregation", () => {
  it("enforces one completed split as four league title records", () => {
    const aggregation = aggregateLeagueTitleHistory(LEAGUE_NAMES.map((league) => ({ split: "Opening", league, wrestler: `${league} Winner` })));
    expect(aggregation.completedSplits).toBe(1);
    expect(aggregation.expectedLeagueTitleRecords).toBe(4);
    expect(aggregation.titleRecords).toHaveLength(4);
  });

  it("enforces completedSplits times four league title records", () => {
    const records = ["Opening", "Closing"].flatMap((split) => LEAGUE_NAMES.map((league) => ({ leagueYear: split === "Opening" ? 1 : 2, split, league, wrestler: `${split} ${league} Winner` })));
    const aggregation = aggregateLeagueTitleHistory(records);
    expect(aggregation.completedSplits).toBe(2);
    expect(aggregation.expectedLeagueTitleRecords).toBe(8);
    expect(aggregation.titleRecords).toHaveLength(8);
  });

  it("includes Year 1 and LY2 Opening Split title and Elite Cup records without hardcoded totals", () => {
    const titleRecords = [1, 2].flatMap((leagueYear) => LEAGUE_NAMES.map((league) => ({
      leagueYear,
      split: leagueYear === 1 ? "Closing Split" : "Opening Split",
      league,
      wrestler: `${leagueYear} ${league} Winner`,
      sourceLabel: leagueYear === 1 ? "Legacy history" : "Post-Finals final table",
    })));
    const cupRecords = [1, 2].map((leagueYear) => ({
      leagueYear,
      split: leagueYear === 1 ? "Closing Split" : "Opening Split",
      eventName: "Global Elite Cup",
      wrestler: `Cup ${leagueYear}`,
      sourceLabel: leagueYear === 1 ? "Legacy history" : "League Finals completed event",
    }));
    expect(aggregateLeagueTitleHistory(titleRecords).titleRecords).toHaveLength(8);
    expect(aggregateEliteCupHistory(cupRecords).winnerRecords).toHaveLength(2);
  });

  it("deduplicates duplicate title and Elite Cup records from multiple completed sources", () => {
    const duplicateTitle = { leagueYear: 2, split: "Opening Split", league: "Global League" as const, wrestler: "Gunther" };
    const titleRecords = [duplicateTitle, { ...duplicateTitle, sourceLabel: "Post-Finals transition" }, ...LEAGUE_NAMES.filter((league) => league !== "Global League").map((league) => ({ leagueYear: 2, split: "Opening Split", league, wrestler: `${league} Champion` }))];
    const duplicateCup = { leagueYear: 2, split: "Opening Split", eventName: "Global Elite Cup", wrestler: "Gunther" };
    expect(aggregateLeagueTitleHistory(titleRecords).titleRecords).toHaveLength(4);
    expect(aggregateEliteCupHistory([duplicateCup, { ...duplicateCup, sourceLabel: "League Finals event" }]).winnerRecords).toHaveLength(1);
  });

  it("aggregates Elite Cup records once per completed split", () => {
    expect(aggregateEliteCupHistory([{ split: "Opening", wrestler: "Cup A" }])).toMatchObject({ completedSplits: 1, expectedEliteCupRecords: 1, winnerRecords: [{ split: "Opening", wrestler: "Cup A" }] });
    expect(aggregateEliteCupHistory([{ split: "Opening", wrestler: "Cup A" }, { split: "Closing", wrestler: "Cup B" }])).toMatchObject({ completedSplits: 2, expectedEliteCupRecords: 2 });
  });

  it("does not count incomplete active split cup records and reports missing completed split cup winners", () => {
    const aggregation = aggregateEliteCupHistory([{ split: "Opening", wrestler: "Cup A" }], ["Opening", "Closing"]);
    expect(aggregation.winnerRecords).toHaveLength(1);
    expect(aggregation.warnings.join(" ")).toContain("Completed split Elite Cup aggregation incomplete: expected 2 Elite Cup winner records, found 1.");
  });

  it("summarizes record totals and emits diagnostics instead of inventing missing winners", () => {
    const summary = summarizeLegacyProfiles([{ ...({} as LegacyProfile), wrestler: "A", currentLeague: "Global League", goatStatusTier: null, leagueWinsTotal: 7, globalChampionWins: 1, eliteCupWins: 1, doubles: 0, invincibleSplits: 0, invincibleHinrunden: 0, invincibleRueckrunden: 0, longestWinStreakOverall: 0, sourceCommentary: null, legacyTier: "A" }]);
    expect(summary.leagueTitleRecords).toBe(7);
    expect(summary.eliteCupRecords).toBe(1);
    expect(summary.diagnostics).toContain("Completed split title aggregation incomplete: expected 8 league title records, found 7.");
  });

  it("does not count incomplete split winners and emits the source warning", () => {
    const aggregation = aggregateLeagueTitleHistory(LEAGUE_NAMES.slice(0, 3).map((league) => ({ split: "Opening", league, wrestler: `${league} Winner` })));
    expect(aggregation.completedSplits).toBe(0);
    expect(aggregation.titleRecords).toHaveLength(0);
    expect(aggregation.warnings.join(" ")).toContain("Completed split title aggregation incomplete: expected 4 league title records, found 3.");
  });

  it("updates legacy profile totals from completed history records while preserving record totals", () => {
    const base: LegacyProfile = { wrestler: "Gunther", currentLeague: "Global League", goatStatusTier: null, leagueWinsTotal: 1, globalChampionWins: 1, eliteCupWins: 1, doubles: 0, invincibleSplits: 0, invincibleHinrunden: 0, invincibleRueckrunden: 0, longestWinStreakOverall: 10, sourceCommentary: null };
    const enriched = applyLegacyHistoryRecords([base], [1, 2].flatMap((leagueYear) => LEAGUE_NAMES.map((league) => ({
      leagueYear,
      split: leagueYear === 1 ? "Closing Split" : "Opening Split",
      league,
      wrestler: league === "Global League" ? "Gunther" : `${leagueYear} ${league} Winner`,
    }))), [
      { leagueYear: 1, split: "Closing Split", eventName: "Global Elite Cup", wrestler: "Gunther" },
      { leagueYear: 2, split: "Opening Split", eventName: "Global Elite Cup", wrestler: "Gunther" },
    ]);
    expect(enriched[0]).toMatchObject({ leagueWinsTotal: 2, globalChampionWins: 2, eliteCupWins: 2 });
  });

  it("refreshes GOAT commentary after a new league title and current league change", () => {
    const base: LegacyProfile = { wrestler: "Jey Uso", currentLeague: "National League", goatStatusTier: null, leagueWinsTotal: 0, globalChampionWins: 0, eliteCupWins: 0, doubles: 0, invincibleSplits: 0, invincibleHinrunden: 0, invincibleRueckrunden: 0, longestWinStreakOverall: 0, sourceCommentary: null };
    const [updated] = enrichLegacyProfilesWithCompletedSplitChampions([{ ...base, currentLeague: "Continental League" }], [{ league: "Continental League", rank: 1, wrestler: "Jey Uso", seed: 12, matches: 22, wins: 20, draws: 0, losses: 2, points: 60, status: "Champion" } as StandingRow, ...LEAGUE_NAMES.filter((league) => league !== "Continental League").map((league) => ({ league, rank: 1, wrestler: `${league} Champ`, seed: 1, matches: 22, wins: 1, draws: 0, losses: 0, points: 3, status: "Champion" as const }))]);
    const commentary = generateLegacyCommentary(updated);
    expect(updated).toMatchObject({ currentLeague: "Continental League", leagueWinsTotal: 1 });
    expect(commentary.category).toBe("League Title Standard");
    expect(commentary.text).not.toContain("National League");
  });
});
