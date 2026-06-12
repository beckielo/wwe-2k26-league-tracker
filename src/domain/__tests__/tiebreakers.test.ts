import { describe, expect, it } from "vitest";
import {
  calculateHeadToHead,
  calculateWinningStreaks,
  decideTwoWrestlerTiebreak,
  detectPointTies,
} from "../tiebreakers";
import type { HeadToHeadRecord, Match, MatchResult, StandingRow, StreakRecord } from "../types";

function h2h(week: number, winner: string, loser: string): HeadToHeadRecord {
  return { league: "National League", week, roundType: week <= 11 ? "Hinrunde" : "Rückrunde", wrestlerA: winner, wrestlerB: loser, winner, loser };
}

function match(week: number, wrestlerA: string, wrestlerB: string): Match {
  return { id: `national-${week}-1`, leagueYear: 2, split: "Opening Split", week, roundType: week <= 11 ? "Hinrunde" : "Rückrunde", league: "National League", showDay: "Dienstag", matchNumber: 1, wrestlerA, wrestlerB, matchupKey: [wrestlerA, wrestlerB].sort().join(" vs "), status: "completed", source: { file: "test.xlsx", sheet: "Schedule_22W" } };
}

function result(week: number, winner: string, loser: string): MatchResult {
  return { matchId: `national-${week}-1`, outcome: "decisive", winner, loser, resultSource: "User", notes: null, source: { file: "test.xlsx", sheet: "Schedule_22W" } };
}

function standing(wrestler: string, rank: number, points = 21, seed = rank): StandingRow {
  return { league: "National League", rank, wrestler, seed, matches: 10, wins: 7, draws: 0, losses: 3, points, status: "source zone" };
}

function streak(wrestler: string, longest: number): StreakRecord {
  return { league: "National League", wrestler, seed: 1, currentStreak: 0, longestWinningStreak: longest, lastResult: "L", notes: null };
}

describe("head-to-head calculation", () => {
  it("calculates the leader between two tied wrestlers", () => {
    const summary = calculateHeadToHead("Alpha", "Beta", [h2h(1, "Alpha", "Beta")]);
    expect(summary).toMatchObject({ meetings: 1, winsA: 1, winsB: 0, leader: "Alpha", isTied: false });
  });

  it("detects a 1–1 head-to-head tie", () => {
    const summary = calculateHeadToHead("Alpha", "Beta", [h2h(1, "Alpha", "Beta"), h2h(12, "Beta", "Alpha")]);
    expect(summary).toMatchObject({ meetings: 2, winsA: 1, winsB: 1, leader: null, isTied: true, isOneToOne: true });
  });
});

describe("winning streak calculation", () => {
  const matches = [
    match(1, "Alpha", "Beta"),
    match(2, "Alpha", "Gamma"),
    match(3, "Alpha", "Delta"),
    match(4, "Alpha", "Echo"),
  ];
  const results = [
    result(1, "Alpha", "Beta"),
    result(2, "Alpha", "Gamma"),
    result(3, "Delta", "Alpha"),
    result(4, "Alpha", "Echo"),
  ];

  it("calculates the longest winning streak", () => {
    const alpha = calculateWinningStreaks(matches, results).find((row) => row.wrestler === "Alpha");
    expect(alpha?.longestWinningStreak).toBe(2);
  });

  it("calculates the current winning streak", () => {
    const alpha = calculateWinningStreaks(matches, results).find((row) => row.wrestler === "Alpha");
    expect(alpha?.currentWinningStreak).toBe(1);
  });
});

describe("tie relevance", () => {
  it("detects a relevant tie crossing a qualification boundary", () => {
    const [tie] = detectPointTies([standing("Alpha", 4), standing("Beta", 5)]);
    expect(tie.relevant).toBe(true);
    expect(tie.explanation).toContain("promotion playoff qualification");
    expect(tie.explanation).toContain("same safe/status-neutral zone");
  });

  it("detects an irrelevant tie inside the same status zone", () => {
    const [tie] = detectPointTies([standing("Alpha", 6), standing("Beta", 7)]);
    expect(tie.relevant).toBe(false);
    expect(tie.explanation).toContain("every tied wrestler remains");
  });
});

describe("tiebreak decision order", () => {
  it("requires a tiebreaker match when points, 1–1 H2H, and longest streak are tied", () => {
    const decision = decideTwoWrestlerTiebreak(
      standing("Alpha", 1, 30, 1),
      standing("Beta", 2, 30, 12),
      [h2h(1, "Alpha", "Beta"), h2h(12, "Beta", "Alpha")],
      [streak("Alpha", 6), streak("Beta", 6)],
    );
    expect(decision).toMatchObject({ winner: null, criterion: "tiebreaker-match", matchRequired: true });
  });

  it("does not use seed as an automatic tiebreaker", () => {
    const decision = decideTwoWrestlerTiebreak(
      standing("High Seed", 6, 18, 1),
      standing("Low Seed", 7, 18, 12),
      [],
      [streak("High Seed", 3), streak("Low Seed", 3)],
    );
    expect(decision.winner).toBeNull();
    expect(decision.matchRequired).toBe(true);
    expect(decision.criterion).toBe("tiebreaker-match");
  });
});
