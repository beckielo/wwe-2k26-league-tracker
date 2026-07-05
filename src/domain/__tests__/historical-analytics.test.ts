import { describe, expect, it } from "vitest";
import {
  deriveCurrentHistoricalAnalytics,
  historicalAnalyticsSheetStatus,
} from "../historical-analytics";
import type { Match, MatchResult, StandingRow } from "../types";

function match(
  id: string,
  split: Match["split"],
  week: number,
  wrestlerA = "Alpha",
  wrestlerB = "Bálor",
): Match {
  return {
    id,
    leagueYear: 2,
    split,
    week,
    roundType: "Hinrunde",
    league: "National League",
    showDay: "Dienstag",
    matchNumber: 1,
    wrestlerA,
    wrestlerB,
    matchupKey: [wrestlerA, wrestlerB].sort().join(" vs "),
    status: "completed",
    source: { file: "fixture.xlsx", sheet: "Schedule_22W" },
  };
}

function result(
  matchId: string,
  outcome: MatchResult["outcome"],
  winner: string | null,
): MatchResult {
  return {
    matchId,
    outcome,
    winner,
    loser: winner ? (winner === "Alpha" ? "Bálor" : "Alpha") : null,
    resultSource: "Unknown",
    notes: null,
    source: { file: "fixture.xlsx", sheet: "Schedule_22W" },
  };
}

const standings: StandingRow[] = [
  { league: "National League", rank: 1, wrestler: "Alpha", seed: 1, matches: 2, wins: 1, draws: 1, losses: 0, points: 4, status: "active" },
  { league: "National League", rank: 2, wrestler: "Bálor", seed: 2, matches: 2, wins: 0, draws: 1, losses: 1, points: 1, status: "active" },
];

function derive(matches: Match[], results: MatchResult[], completedThroughYearWeek = 26) {
  return deriveCurrentHistoricalAnalytics({
    matches,
    results,
    standings,
    leagueYear: 2,
    split: "Closing Split",
    completedThroughYearWeek,
    authoritySourceSignature: "validated-closing-checkpoint",
  });
}

describe("current-context historical analytics", () => {
  it("uses validated Closing results without mixing Opening, future, or QA artifacts", () => {
    const matches = [
      match("opening", "Opening Split", 1),
      match("closing-25", "Closing Split", 25),
      match("closing-26", "Closing Split", 26),
      match("stale-46", "Closing Split", 46),
    ];
    const clean = derive(matches, [
      result("closing-25", "decisive", "Alpha"),
      result("closing-26", "draw", null),
    ]);
    const contaminated = derive(matches, [
      result("opening", "decisive", "Alpha"),
      result("closing-25", "decisive", "Alpha"),
      result("closing-26", "draw", null),
      result("stale-46", "decisive", "Alpha"),
      result("qa-browser-result", "decisive", "Alpha"),
    ]);

    expect(contaminated.headToHead).toHaveLength(2);
    expect(contaminated.headToHead.map((row) => row.week)).toEqual([1, 2]);
    expect(contaminated.headToHead[1]).toMatchObject({ winner: "", loser: "" });
    expect(contaminated.context).toMatchObject({
      leagueYear: 2,
      split: "Closing Split",
      completedThroughYearWeek: 26,
      completedThroughSplitWeek: 2,
      resultCount: 2,
      decisiveCount: 1,
      drawCount: 1,
      ignoredContextResultCount: 2,
      rejectedResultCount: 1,
    });
    expect(contaminated.context.sourceSignature).toBe(clean.context.sourceSignature);
    expect(contaminated.streaks.find((row) => row.wrestler === "Alpha")).toMatchObject({
      currentStreak: 0,
      longestWinningStreak: 1,
      lastResult: "D",
    });
  });

  it("keeps a no-contest neutral under the existing streak rule and excludes it from H2H", () => {
    const analytics = derive(
      [
        match("closing-25", "Closing Split", 25),
        match("closing-26", "Closing Split", 26),
      ],
      [
        result("closing-25", "decisive", "Alpha"),
        result("closing-26", "no-contest", null),
      ],
    );

    expect(analytics.headToHead).toHaveLength(1);
    expect(analytics.context.noContestCount).toBe(1);
    expect(analytics.streaks.find((row) => row.wrestler === "Alpha")).toMatchObject({
      currentStreak: 1,
      longestWinningStreak: 1,
      lastResult: "W",
    });
  });

  it("marks stale sheets as reconstructed and matching projections as current", () => {
    const analytics = derive(
      [match("closing-25", "Closing Split", 25)],
      [result("closing-25", "decisive", "Alpha")],
      25,
    );
    const staleStatus = historicalAnalyticsSheetStatus([], [], analytics);
    const currentStatus = historicalAnalyticsSheetStatus(
      analytics.headToHead,
      analytics.streaks,
      analytics,
    );

    expect(staleStatus).toEqual({
      headToHeadSheetStatus: "reconstructed",
      winningStreakSheetStatus: "reconstructed",
    });
    expect(currentStatus).toEqual({
      headToHeadSheetStatus: "current",
      winningStreakSheetStatus: "current",
    });
  });
});
