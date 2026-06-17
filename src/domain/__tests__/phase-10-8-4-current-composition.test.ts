import { describe, expect, it } from "vitest";
import { buildCurrentStandingsFromScheduleComposition, validateCurrentLeagueComposition } from "../current-league-composition";
import { aggregateLeagueTitleHistory, enrichLegacyProfilesWithCompletedSplitChampions } from "../legacy";
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
  it("enforces completedSplits times four league title records", () => {
    const records = ["Opening", "Closing"].flatMap((split) => LEAGUE_NAMES.map((league) => ({ split, league, wrestler: `${split} ${league} Winner` })));
    const aggregation = aggregateLeagueTitleHistory(records);
    expect(aggregation.completedSplits).toBe(2);
    expect(aggregation.expectedLeagueTitleRecords).toBe(8);
    expect(aggregation.titleRecords).toHaveLength(8);
  });

  it("does not count incomplete split winners and emits the source warning", () => {
    const aggregation = aggregateLeagueTitleHistory(LEAGUE_NAMES.slice(0, 3).map((league) => ({ split: "Opening", league, wrestler: `${league} Winner` })));
    expect(aggregation.completedSplits).toBe(0);
    expect(aggregation.titleRecords).toHaveLength(0);
    expect(aggregation.warnings.join(" ")).toContain("Completed split has incomplete league winner records: expected 4, found 3.");
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
