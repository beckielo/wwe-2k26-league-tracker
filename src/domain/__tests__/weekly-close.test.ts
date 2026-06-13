import { describe, expect, it } from "vitest";
import { createEmptyTrackerState, type ConfirmedResult } from "../tracker-state";
import { buildWeeklyClosePackage, standingsToCsv, weeklyResultsToCsv } from "../weekly-close";
import type { LeagueName, Match, StandingRow } from "../types";

const leagues: LeagueName[] = ["Global League", "Continental League", "National League", "Regional League"];

function scheduledWeek(week = 14): Match[] {
  return leagues.flatMap((league, leagueIndex) => Array.from({ length: 6 }, (_, index) => ({
    id: `${week}-${leagueIndex}-${index}`,
    leagueYear: 2,
    split: "Opening Split" as const,
    week,
    roundType: "Rückrunde" as const,
    league,
    showDay: league === "National League" ? "Dienstag" as const : "Montag" as const,
    matchNumber: index + 1,
    wrestlerA: `${league}-A${index}`,
    wrestlerB: `${league}-B${index}`,
    matchupKey: `${league}-match-${index}`,
    status: "scheduled" as const,
    source: { file: "test.xlsx", sheet: "Schedule_22W" },
  })));
}

function results(matches: Match[]): ConfirmedResult[] {
  return matches.map((match) => ({
    league: match.league,
    week: match.week,
    matchId: match.id,
    wrestlerA: match.wrestlerA,
    wrestlerB: match.wrestlerB,
    resultType: "Winner",
    winner: match.wrestlerA,
    source: match.league === "National League" ? "Manual" : "Simulation",
    confirmedAt: "2026-06-13T10:00:00.000Z",
  }));
}

function standings(matches: Match[]): StandingRow[] {
  return matches.flatMap((match) => [match.wrestlerA, match.wrestlerB]).map((wrestler, index) => ({
    league: matches.find((match) => match.wrestlerA === wrestler || match.wrestlerB === wrestler)!.league,
    rank: index + 1,
    wrestler,
    seed: index + 1,
    matches: 13,
    wins: 6,
    draws: 0,
    losses: 7,
    points: 18,
    status: "baseline",
  }));
}

function build(overrides: Partial<Parameters<typeof buildWeeklyClosePackage>[0]> = {}) {
  const matches = scheduledWeek();
  return buildWeeklyClosePackage({
    week: 14,
    generatedAt: "2026-06-13T12:00:00.000Z",
    scheduledMatches: matches,
    confirmedResults: results(matches),
    workbookCurrentWeek: 13,
    userLeague: "National League",
    baselineStandings: standings(matches),
    completedWeeks: [{ week: 14, completedAt: "2026-06-13T11:00:00.000Z" }],
    ...overrides,
  });
}

describe("weekly close package", () => {
  it("returns exactly 24 matches for a complete locked week", () => {
    const closePackage = build();
    expect(closePackage).toMatchObject({
      week: 14,
      validationStatus: "valid",
      exportable: true,
      missingResultCount: 0,
      latestLockedLocalWeek: 14,
    });
    expect(closePackage.scheduledMatches).toHaveLength(24);
    expect(closePackage.confirmedResults).toHaveLength(24);
  });

  it("includes Manual and Simulation result counts", () => {
    expect(build()).toMatchObject({ manualResultCount: 6, simulationResultCount: 18 });
  });

  it("marks incomplete and unlocked weeks as not exportable", () => {
    const matches = scheduledWeek();
    const incomplete = build({ confirmedResults: results(matches).slice(0, 23) });
    expect(incomplete).toMatchObject({ validationStatus: "incomplete", exportable: false, missingResultCount: 1 });

    const unlocked = build({ completedWeeks: [] });
    expect(unlocked).toMatchObject({ validationStatus: "unlocked", exportable: false });
  });

  it("creates result and standings CSV files with headers and expected rows", () => {
    const closePackage = build();
    const resultCsv = weeklyResultsToCsv(closePackage);
    const standingsCsv = standingsToCsv(closePackage);
    expect(resultCsv.split("\r\n")).toHaveLength(25);
    expect(resultCsv).toContain("\"week\",\"league\",\"matchNumber\",\"matchId\"");
    expect(resultCsv).toContain("\"National League\",\"1\"");
    expect(standingsCsv).toContain("\"week\",\"league\",\"rank\",\"wrestler\"");
    expect(standingsCsv).toContain("\"points\",\"status\"");
  });

  it("does not mutate inputs", () => {
    const matches = scheduledWeek();
    const confirmedResults = results(matches);
    const baselineStandings = standings(matches);
    const completedWeeks = [{ week: 14, completedAt: "2026-06-13T11:00:00.000Z" }];
    const before = structuredClone({ matches, confirmedResults, baselineStandings, completedWeeks });
    buildWeeklyClosePackage({
      week: 14,
      scheduledMatches: matches,
      confirmedResults,
      workbookCurrentWeek: 13,
      userLeague: "National League",
      baselineStandings,
      completedWeeks,
    });
    expect({ matches, confirmedResults, baselineStandings, completedWeeks }).toEqual(before);
  });

  it("includes No Contest while leaving standings unchanged for that match", () => {
    const matches = scheduledWeek();
    const confirmedResults = results(matches);
    confirmedResults[0] = { ...confirmedResults[0], resultType: "No Contest", winner: null };
    const baselineStandings = standings(matches);
    const closePackage = build({ confirmedResults, baselineStandings });
    const noContest = closePackage.confirmedResults.find((result) => result.matchId === matches[0].id);
    const rowA = closePackage.appStateStandings.find((row) => row.wrestler === matches[0].wrestlerA);
    const baselineA = baselineStandings.find((row) => row.wrestler === matches[0].wrestlerA);
    expect(noContest?.resultType).toBe("No Contest");
    expect(rowA).toMatchObject({
      matches: baselineA?.matches,
      wins: baselineA?.wins,
      draws: baselineA?.draws,
      losses: baselineA?.losses,
      points: baselineA?.points,
    });
  });

  it("keeps tracker state version unchanged", () => {
    expect(createEmptyTrackerState().version).toBe(1);
  });
});
