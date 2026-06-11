import { describe, expect, it } from "vitest";
import { calculateStandings } from "../standings";
import type { Match, MatchResult } from "../types";

const matches: Match[] = [
  {
    id: "national-1-1", leagueYear: 2, split: "Opening Split", week: 1, roundType: "Hinrunde",
    league: "National League", showDay: "Dienstag", matchNumber: 1, wrestlerA: "Alpha", wrestlerB: "Beta",
    matchupKey: "Alpha vs Beta", status: "completed", source: { file: "test.xlsx", sheet: "Schedule" },
  },
  {
    id: "national-2-1", leagueYear: 2, split: "Opening Split", week: 2, roundType: "Hinrunde",
    league: "National League", showDay: "Dienstag", matchNumber: 1, wrestlerA: "Alpha", wrestlerB: "Gamma",
    matchupKey: "Alpha vs Gamma", status: "completed", source: { file: "test.xlsx", sheet: "Schedule" },
  },
];
const results: MatchResult[] = [
  { matchId: "national-1-1", outcome: "decisive", winner: "Alpha", loser: "Beta", resultSource: "User", notes: null, source: { file: "test.xlsx", sheet: "Schedule" } },
  { matchId: "national-2-1", outcome: "decisive", winner: "Gamma", loser: "Alpha", resultSource: "User", notes: null, source: { file: "test.xlsx", sheet: "Schedule" } },
];

describe("calculateStandings", () => {
  it("calculates records and points from entered results", () => {
    const rows = calculateStandings([
      { league: "National League", wrestler: "Alpha", seed: 1 },
      { league: "National League", wrestler: "Beta", seed: 2 },
      { league: "National League", wrestler: "Gamma", seed: 3 },
    ], matches, results);
    expect(rows.find((row) => row.wrestler === "Alpha")).toMatchObject({ matches: 2, wins: 1, losses: 1, points: 3 });
    expect(rows.find((row) => row.wrestler === "Gamma")).toMatchObject({ matches: 1, wins: 1, losses: 0, points: 3 });
    expect(rows.find((row) => row.wrestler === "Beta")).toMatchObject({ matches: 1, wins: 0, losses: 1, points: 0 });
  });
});
