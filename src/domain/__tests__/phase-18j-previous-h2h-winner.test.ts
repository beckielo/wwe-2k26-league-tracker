import { describe, expect, it } from "vitest";
import { derivePreviousH2HWinner } from "../head-to-head";
import type { HistoricalMatchResult } from "../match-history";

function result(overrides: Partial<HistoricalMatchResult>): HistoricalMatchResult {
  return {
    matchId: "match-1",
    league: "Global League",
    split: "Closing Split",
    leagueYear: 2,
    week: 1,
    matchNumber: 1,
    wrestlerA: "Alpha",
    wrestlerB: "Beta",
    resultType: "Winner",
    winner: "Alpha",
    ...overrides,
  };
}

function winner(results: HistoricalMatchResult[]) {
  return derivePreviousH2HWinner({
    wrestlerA: "Alpha",
    wrestlerB: "Beta",
    leagueYear: 2,
    split: "Closing Split",
    week: 4,
    matchNumber: 3,
    currentMatchId: "current",
    results,
  });
}

describe("Phase 18J previous direct H2H winner", () => {
  it("returns the prior winner for the same pair in the same order", () => {
    expect(winner([result({ winner: "Alpha" })])).toBe("Alpha");
  });

  it("returns the prior winner for the reversed pair", () => {
    expect(winner([result({ wrestlerA: "Beta", wrestlerB: "Alpha", winner: "Beta" })])).toBe("Beta");
  });

  it("returns the most recent previous H2H when multiple exist", () => {
    expect(winner([result({ matchId: "old", week: 1, winner: "Alpha" }), result({ matchId: "new", week: 3, winner: "Beta" })])).toBe("Beta");
  });

  it("returns null for Draw", () => {
    expect(winner([result({ resultType: "Draw", winner: null })])).toBeNull();
  });

  it("returns null for No Contest", () => {
    expect(winner([result({ resultType: "No Contest", winner: null })])).toBeNull();
  });

  it("returns null when no previous H2H exists", () => {
    expect(winner([result({ wrestlerA: "Alpha", wrestlerB: "Gamma", winner: "Alpha" })])).toBeNull();
  });

  it("ignores unconfirmed or future preview-like results outside the active previous context", () => {
    expect(winner([
      result({ matchId: "future", week: 5, winner: "Beta" }),
      result({ matchId: "opening-split", split: "Opening Split", week: 2, winner: "Beta" }),
      result({ matchId: "current", week: 4, matchNumber: 3, winner: "Beta" }),
      result({ matchId: "authoritative-previous", week: 2, winner: "Alpha" }),
    ])).toBe("Alpha");
  });
});
