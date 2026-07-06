import { describe, expect, it } from "vitest";
import type { ConfirmedResult } from "@/domain/tracker-state";
import { LEAGUE_NAMES, type LeagueName, type Match, type MatchResult, type SplitName } from "@/domain/types";
import { buildCurrentSplitCalendar } from "./current-split-calendar-model";

function match(id: string, league: LeagueName, week: number, split: SplitName = "Closing Split"): Match {
  return {
    id,
    leagueYear: 2,
    split,
    week,
    roundType: week - (split === "Closing Split" ? 24 : 0) <= 11 ? "Hinrunde" : "Rückrunde",
    league,
    showDay: league === "Global League" ? "Freitag" : league === "Continental League" ? "Mittwoch" : league === "National League" ? "Dienstag" : "Montag",
    matchNumber: 1,
    wrestlerA: `${league} A`,
    wrestlerB: `${league} B`,
    matchupKey: `${league}:${week}`,
    status: "scheduled",
    source: { file: "test", sheet: "schedule" },
  };
}

function workbookResult(source: Match, resultSource: MatchResult["resultSource"] = "Simulation"): MatchResult {
  return {
    matchId: source.id,
    outcome: "decisive",
    winner: source.wrestlerA,
    loser: source.wrestlerB,
    resultSource,
    notes: null,
    source: { file: "test", sheet: "results" },
  };
}

function localResult(source: Match, resultSource: ConfirmedResult["source"]): ConfirmedResult {
  return {
    league: source.league,
    week: source.week,
    matchId: source.id,
    wrestlerA: source.wrestlerA,
    wrestlerB: source.wrestlerB,
    resultType: "Winner",
    winner: source.wrestlerA,
    source: resultSource,
    confirmedAt: "2026-07-06T12:00:00.000Z",
  };
}

function week(weekNumber: number): Match[] {
  return LEAGUE_NAMES.map((league) => match(`${league}-${weekNumber}`, league, weekNumber));
}

describe("current split calendar view model", () => {
  const week25 = week(25);
  const week26 = week(26);
  const week27 = week(27);
  const opening = match("opening-result", "Global League", 1, "Opening Split");

  it("shows only confirmed results from the current split and omits future result-less weeks", () => {
    const calendar = buildCurrentSplitCalendar({
      matches: [...week25, ...week26, ...week27, opening],
      workbookResults: [...week25.map((entry) => workbookResult(entry)), workbookResult(opening)],
      localResults: [
        localResult(week26.find((entry) => entry.league === "National League")!, "Manual"),
        localResult(week26.find((entry) => entry.league === "Global League")!, "Simulation"),
      ],
      completedWeeks: [],
      workbookCompletedThroughWeek: 25,
      leagueYear: 2,
      split: "Closing Split",
      userLeague: "National League",
    });

    expect(calendar.weeks.map((entry) => entry.yearWeek)).toEqual([25, 26]);
    expect(calendar.weeks[0]).toMatchObject({ splitWeek: 1, state: "completed", confirmedCount: 4, scheduledCount: 4 });
    expect(calendar.weeks[1]).toMatchObject({ splitWeek: 2, state: "partial", confirmedCount: 2, scheduledCount: 4 });
    expect(calendar.weeks.flatMap((entry) => entry.matches).some((entry) => entry.matchId === opening.id)).toBe(false);
    expect(calendar.weeks.some((entry) => entry.yearWeek === 27)).toBe(false);
  });

  it("keeps manual user results and confirmed simulation results visibly distinct", () => {
    const national = week26.find((entry) => entry.league === "National League")!;
    const global = week26.find((entry) => entry.league === "Global League")!;
    const calendar = buildCurrentSplitCalendar({
      matches: week26,
      workbookResults: [],
      localResults: [localResult(national, "Manual"), localResult(global, "Simulation")],
      completedWeeks: [],
      workbookCompletedThroughWeek: 25,
      leagueYear: 2,
      split: "Closing Split",
      userLeague: "National League",
    });
    const matches = calendar.weeks[0].matches;

    expect(matches.find((entry) => entry.matchId === national.id)).toMatchObject({
      origin: "manual",
      sourceLabel: "Manual result",
      isUserLeague: true,
    });
    expect(matches.find((entry) => entry.matchId === global.id)).toMatchObject({
      origin: "simulation",
      sourceLabel: "Simulated result",
      isUserLeague: false,
    });
  });

  it("marks a fully confirmed local week completed only when its Week Review lock exists", () => {
    const localResults = week26.map((entry) => localResult(
      entry,
      entry.league === "National League" ? "Manual" : "Simulation",
    ));
    const unlocked = buildCurrentSplitCalendar({
      matches: week26,
      workbookResults: [],
      localResults,
      completedWeeks: [],
      workbookCompletedThroughWeek: 25,
      leagueYear: 2,
      split: "Closing Split",
      userLeague: "National League",
    });
    const locked = buildCurrentSplitCalendar({
      matches: week26,
      workbookResults: [],
      localResults,
      completedWeeks: [{ week: 26, completedAt: "2026-07-06T13:00:00.000Z" }],
      workbookCompletedThroughWeek: 25,
      leagueYear: 2,
      split: "Closing Split",
      userLeague: "National League",
    });

    expect(unlocked.weeks[0].state).toBe("confirmed");
    expect(locked.weeks[0].state).toBe("completed");
    expect(locked.weeks[0].matches.every((entry) => entry.isWeekCompleted)).toBe(true);
  });

  it("does not treat an unconfirmed simulation preview as a result", () => {
    const previewOnlyMatch = week26[0];
    const unconfirmedPreview = {
      matchId: previewOnlyMatch.id,
      outcome: "decisive",
      winner: previewOnlyMatch.wrestlerA,
    };
    const calendar = buildCurrentSplitCalendar({
      matches: week26,
      workbookResults: [],
      localResults: [],
      completedWeeks: [],
      workbookCompletedThroughWeek: 25,
      leagueYear: 2,
      split: "Closing Split",
      userLeague: "National League",
    });

    expect(unconfirmedPreview.matchId).toBe(previewOnlyMatch.id);
    expect(calendar.weeks).toEqual([]);
    expect(calendar.confirmedResultCount).toBe(0);
  });

  it("rejects local results whose saved matchup identity does not match the current schedule", () => {
    const contaminated = {
      ...localResult(week26[0], "Simulation"),
      wrestlerA: "Wrong wrestler",
    };
    const calendar = buildCurrentSplitCalendar({
      matches: week26,
      workbookResults: [],
      localResults: [contaminated],
      completedWeeks: [],
      workbookCompletedThroughWeek: 25,
      leagueYear: 2,
      split: "Closing Split",
      userLeague: "National League",
    });

    expect(calendar.weeks).toEqual([]);
  });
});
