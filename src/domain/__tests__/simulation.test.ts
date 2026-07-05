import { describe, expect, it } from "vitest";
import {
  buildSimulationCandidates,
  calculateFavoriteProbability,
  resolveSimulationScheduleSource,
  simulateMatch,
  simulateMatches,
  validateSimulatedResults,
  type SimulationCandidate,
} from "../simulation";
import type { League, Match, MatchupReferenceRow, StandingRow, StreakRecord } from "../types";
import { acceptedScheduleMatches, generateSchedule } from "../schedule-setup";
import { LEAGUE_NAMES } from "../types";

function match(league: Match["league"], week = 14, matchNumber = 1, wrestlerA = "Alpha", wrestlerB = "Beta"): Match {
  return { id: `${league}-${week}-${matchNumber}`, leagueYear: 2, split: "Opening Split", week, roundType: "Rückrunde", league, showDay: league === "Regional League" ? "Montag" : league === "Continental League" ? "Mittwoch" : league === "Global League" ? "Freitag" : "Dienstag", matchNumber, wrestlerA, wrestlerB, matchupKey: [wrestlerA, wrestlerB].sort().join(" vs "), status: "scheduled", source: { file: "test.xlsx", sheet: "Schedule_22W" } };
}

function reference(source: Match): MatchupReferenceRow {
  return { week: source.week, roundType: source.roundType, league: source.league, showDay: source.showDay, matchNumber: source.matchNumber, wrestlerA: source.wrestlerA, wrestlerB: source.wrestlerB, matchupKey: source.matchupKey, sourceLabel: "Schedule_22W verified", status: "Open" };
}

function league(source: Match): League {
  return { id: source.league, name: source.league, showDay: source.showDay, wrestlers: [
    { wrestler: { id: source.wrestlerA, name: source.wrestlerA }, seed: 1, startStatus: null },
    { wrestler: { id: source.wrestlerB, name: source.wrestlerB }, seed: 12, startStatus: null },
  ] };
}

function standing(source: Match, wrestler: string, rank: number, points: number): StandingRow {
  return { league: source.league, rank, wrestler, seed: rank, matches: 13, wins: Math.floor(points / 3), draws: 0, losses: 13 - Math.floor(points / 3), points, status: "source zone" };
}

function streak(source: Match, wrestler: string, current: number, longest: number): StreakRecord {
  return { league: source.league, wrestler, seed: wrestler === source.wrestlerA ? 1 : 12, currentStreak: current, longestWinningStreak: longest, lastResult: current ? "W" : "L", notes: null };
}

function candidate(): SimulationCandidate {
  const source = match("Global League");
  return {
    match: source,
    wrestlerA: { wrestler: "Alpha", seed: 1, standingRank: 1, points: 39, currentWinningStreak: 13, longestWinningStreak: 13 },
    wrestlerB: { wrestler: "Beta", seed: 12, standingRank: 12, points: 0, currentWinningStreak: 0, longestWinningStreak: 0 },
  };
}

describe("simulation eligibility", () => {
  it("uses accepted-snapshot eligibility for a validated App checkpoint", () => {
    expect(resolveSimulationScheduleSource({
      activeSource: "app-workbook",
      scheduleSource: "App_Accepted_Schedule / authoritative workbook schedule",
      hasAcceptedSchedule: false,
    })).toBe("accepted-snapshot");
    expect(resolveSimulationScheduleSource({
      activeSource: "workbook-dashboard",
      scheduleSource: "Workbook Dashboard + Schedule_22W",
      hasAcceptedSchedule: false,
    })).toBe("workbook");
  });

  it("loads all six Closing Split Week 1 matches for each non-user league from an accepted snapshot", () => {
    const seeds = Object.fromEntries(LEAGUE_NAMES.map((leagueName) => [
      leagueName,
      Array.from({ length: 12 }, (_, index) => ({ seed: index + 1, wrestler: `${leagueName} Wrestler ${index + 1}` })),
    ])) as Parameters<typeof generateSchedule>[0]["seeds"];
    const generated = generateSchedule({
      leagueYear: 2,
      split: "Closing Split",
      yearWeekStart: 25,
      seeds,
      generatedAt: "2026-06-15T00:00:00.000Z",
    });
    const activeMatches = acceptedScheduleMatches({
      matches: generated,
      acceptedAt: "2026-06-15T00:00:00.000Z",
      acceptedBy: "local user workflow",
      source: "Generated",
      leagueYear: 2,
      split: "Closing Split",
      seedSource: "test",
      rosterSource: "test",
      validation: { valid: true, status: "Valid", errors: [], warnings: [], totalMatches: generated.length },
    });
    const leagues: League[] = LEAGUE_NAMES.map((leagueName) => ({
      id: leagueName,
      name: leagueName,
      showDay: activeMatches.find((entry) => entry.league === leagueName)!.showDay,
      wrestlers: seeds[leagueName].map((entry) => ({
        wrestler: { id: entry.wrestler, name: entry.wrestler },
        seed: entry.seed,
        startStatus: null,
      })),
    }));
    const standings: StandingRow[] = leagues.flatMap((entry) => entry.wrestlers.map((membership) => ({
      league: entry.name,
      rank: membership.seed,
      wrestler: membership.wrestler.name,
      seed: membership.seed,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      status: "Closing Split start",
    })));
    const streaks: StreakRecord[] = standings.map((entry) => ({
      league: entry.league,
      wrestler: entry.wrestler,
      seed: entry.seed,
      currentStreak: 0,
      longestWinningStreak: 0,
      lastResult: "",
      notes: null,
    }));

    const result = buildSimulationCandidates({
      matches: activeMatches,
      matchupReference: [],
      leagues,
      standings,
      streaks,
      existingResults: [],
      userLeague: "National League",
      targetWeek: 25,
      scheduleSource: "accepted-snapshot",
    });

    expect(result.candidates).toHaveLength(18);
    expect(result.candidates.some((entry) => entry.match.league === "National League")).toBe(false);
    for (const leagueName of LEAGUE_NAMES.filter((entry) => entry !== "National League")) {
      expect(result.candidates.filter((entry) => entry.match.league === leagueName)).toHaveLength(6);
    }
  });

  it("excludes the user-controlled league", () => {
    const national = match("National League");
    const regional = match("Regional League");
    const inputMatches = [national, regional];
    const result = buildSimulationCandidates({
      matches: inputMatches,
      matchupReference: inputMatches.map(reference),
      leagues: inputMatches.map(league),
      standings: inputMatches.flatMap((source) => [standing(source, source.wrestlerA, 1, 30), standing(source, source.wrestlerB, 2, 27)]),
      streaks: inputMatches.flatMap((source) => [streak(source, source.wrestlerA, 2, 5), streak(source, source.wrestlerB, 1, 3)]),
      existingResults: [],
      userLeague: "National League",
    });
    expect(result.candidates.map((entry) => entry.match.league)).toEqual(["Regional League"]);
  });

it("excludes browser-confirmed matches from an explicitly targeted active week", () => {
const regional = match("Regional League");
const result = buildSimulationCandidates({
matches: [regional],
matchupReference: [reference(regional)],
leagues: [league(regional)],
standings: [
standing(regional, "Alpha", 1, 30),
standing(regional, "Beta", 2, 27),
],
streaks: [
streak(regional, "Alpha", 2, 5),
streak(regional, "Beta", 1, 3),
],
existingResults: [],
userLeague: "National League",
targetWeek: 14,
confirmedMatchIds: [regional.id],
});

expect(result.candidates).toEqual([]);

});
  it("simulates scheduled matches only when Matchup_Reference agrees", () => {
    const regional = match("Regional League");
    const result = buildSimulationCandidates({
      matches: [regional],
      matchupReference: [{ ...reference(regional), matchupKey: "Wrong vs Pair" }],
      leagues: [league(regional)],
      standings: [standing(regional, "Alpha", 1, 30), standing(regional, "Beta", 2, 27)],
      streaks: [streak(regional, "Alpha", 2, 5), streak(regional, "Beta", 1, 3)],
      existingResults: [],
      userLeague: "National League",
    });
    expect(result.candidates).toEqual([]);
  });

  it("reports missing wrestler inputs without throwing or exposing sheet details", () => {
    const regional = match("Regional League");
    const result = buildSimulationCandidates({
      matches: [regional],
      matchupReference: [reference(regional)],
      leagues: [league(regional)],
      standings: [standing(regional, "Alpha", 1, 30)],
      streaks: [streak(regional, "Alpha", 2, 5), streak(regional, "Beta", 1, 3)],
      existingResults: [],
      userLeague: "National League",
    });

    expect(result.candidates).toEqual([]);
    expect(result.errors).toEqual([
      "Prediction data is missing for Beta in Regional League: current standing.",
    ]);
    expect(result.errors.join(" ")).not.toMatch(/Workbook|App_|Standings_Current/);
  });
});

describe("weighted simulation", () => {
  it("keeps a clear favorite in the guided 70–80% range", () => {
    const probability = calculateFavoriteProbability(100, 20);
    expect(probability).toBeGreaterThanOrEqual(0.7);
    expect(probability).toBeLessThanOrEqual(0.8);
  });

  it("allows a plausible upset", () => {
    const rolls = [0.5, 0.99];
    const preview = simulateMatch(candidate(), () => rolls.shift() ?? 0.5);
    expect(preview.favorite).toBe("Alpha");
    expect(preview.winner).toBe("Beta");
    expect(preview.upset).toBe(true);
  });

  it("handles the very rare draw outcome", () => {
    const preview = simulateMatch(candidate(), () => 0);
    expect(preview).toMatchObject({ outcome: "draw", winner: null, upset: false });
  });
});

describe("simulation validation", () => {
  it("rejects an invalid simulated winner", () => {
    const source = match("Global League");
    const result = validateSimulatedResults({ results: [{ matchId: source.id, outcome: "decisive", winner: "Outsider" }], scheduledMatches: [source], existingResults: [], userLeague: "National League" });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("winner must be one of the scheduled wrestlers");
  });

  it("rejects duplicate simulated results", () => {
    const source = match("Global League");
    const duplicate = { matchId: source.id, outcome: "decisive" as const, winner: source.wrestlerA };
    const result = validateSimulatedResults({ results: [duplicate, duplicate], scheduledMatches: [source], existingResults: [], userLeague: "National League" });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("duplicate simulated result");
  });

  it("does not mutate workbook-derived input data", () => {
    const source = candidate();
    const before = structuredClone(source);
    simulateMatches([source], () => 0.5);
    expect(source).toEqual(before);
  });
});
