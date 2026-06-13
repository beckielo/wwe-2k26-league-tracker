import { describe, expect, it } from "vitest";
import { completeWeek, createEmptyTrackerState, unlockWeek, type ConfirmedResult, type TrackerState } from "../tracker-state";
import { detectActiveWeek, getActiveUserLeagueMatches, getWeekProgress } from "../week-progression";
import type { LeagueName, Match } from "../types";

const leagues: LeagueName[] = ["Global League", "Continental League", "National League", "Regional League"];

function scheduledWeek(week: number): Match[] {
  return leagues.flatMap((league, leagueIndex) => Array.from({ length: 6 }, (_, index) => ({
    id: `${week}-${leagueIndex}-${index}`,
    leagueYear: 2,
    split: "Opening Split" as const,
    week,
    roundType: "Rückrunde" as const,
    league,
    showDay: league === "National League" ? "Mittwoch" as const : "Montag" as const,
    matchNumber: index + 1,
    wrestlerA: `${league}-A${index}`,
    wrestlerB: `${league}-B${index}`,
    matchupKey: `${league}-match-${index}`,
    status: "scheduled" as const,
    source: { file: "test.xlsx", sheet: "Schedule_22W" },
  })));
}

function confirmations(matches: Match[]): ConfirmedResult[] {
  return matches.map((match) => ({
    league: match.league,
    week: match.week,
    matchId: match.id,
    wrestlerA: match.wrestlerA,
    wrestlerB: match.wrestlerB,
    resultType: "Winner",
    winner: match.wrestlerA,
    source: match.league === "National League" ? "Manual" : "Simulation",
    confirmedAt: "2026-06-12T12:00:00.000Z",
  }));
}

const allMatches = [...scheduledWeek(14), ...scheduledWeek(15)];

function stateWith(results: ConfirmedResult[]): TrackerState {
  return { ...createEmptyTrackerState(), confirmedResults: results };
}

describe("week progression", () => {
  it("detects the first scheduled workbook week as active", () => {
    expect(detectActiveWeek(createEmptyTrackerState(), allMatches, 13).activeWeek).toBe(14);
  });

  it("detects an incomplete week", () => {
    const progress = getWeekProgress(stateWith(confirmations(scheduledWeek(14)).slice(0, 20)), 14, allMatches, "National League");
    expect(progress).toMatchObject({ status: "incomplete", confirmed: 20, missing: 4, manual: 6, simulation: 14 });
  });

  it("detects a complete but unlocked week", () => {
    const progress = getWeekProgress(stateWith(confirmations(scheduledWeek(14))), 14, allMatches, "National League");
    expect(progress).toMatchObject({ status: "complete-unlocked", confirmed: 24, missing: 0, manual: 6, simulation: 18 });
  });

  it("locks a complete week and progresses to the next scheduled week", () => {
    const ready = stateWith(confirmations(scheduledWeek(14)));
    const locked = completeWeek(ready, 14, allMatches, "National League", "2026-06-12T13:00:00.000Z");
    expect(locked.ok).toBe(true);
    expect(getWeekProgress(locked.state, 14, allMatches, "National League").status).toBe("locked");
    expect(detectActiveWeek(locked.state, allMatches, 13).activeWeek).toBe(15);
  });

  it("returns the unlocked week to the active workflow", () => {
    const lockedState = { ...createEmptyTrackerState(), completedWeeks: [{ week: 14, completedAt: "2026-06-12T13:00:00.000Z" }] };
    expect(detectActiveWeek(lockedState, allMatches, 13).activeWeek).toBe(15);
    expect(detectActiveWeek(unlockWeek(lockedState, 14), allMatches, 13).activeWeek).toBe(14);
  });

  it("reports season complete when every authoritative scheduled week is locked", () => {
    const lockedState = { ...createEmptyTrackerState(), completedWeeks: [
      { week: 14, completedAt: "2026-06-12T13:00:00.000Z" },
      { week: 15, completedAt: "2026-06-12T14:00:00.000Z" },
    ] };
    expect(detectActiveWeek(lockedState, allMatches, 13)).toMatchObject({ activeWeek: null, seasonComplete: true });
  });

  it("focuses Result Entry on the active user-league card", () => {
    const matches = getActiveUserLeagueMatches(createEmptyTrackerState(), allMatches, 13, "National League");
    expect(matches).toHaveLength(6);
    expect(new Set(matches.map((match) => match.week))).toEqual(new Set([14]));
    expect(new Set(matches.map((match) => match.league))).toEqual(new Set(["National League"]));
  });
});
