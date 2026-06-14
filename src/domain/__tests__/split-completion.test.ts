import { describe, expect, it } from "vitest";
import { deriveSplitCompletionReview } from "../split-completion";
import type { Match, MatchResult, StandingRow } from "../types";

function standing(wrestler: string, rank: number, points: number, seed = rank): StandingRow {
  return {
    league: "National League",
    rank,
    wrestler,
    seed,
    matches: 22,
    wins: 7,
    draws: 0,
    losses: 15,
    points,
    status: "provisional source zone",
  };
}

function match(week: number, wrestlerA: string, wrestlerB: string): Match {
  return {
    id: `match-${week}-${wrestlerA}-${wrestlerB}`,
    leagueYear: 2,
    split: "Opening Split",
    week,
    roundType: week <= 11 ? "Hinrunde" : "Rückrunde",
    league: "National League",
    showDay: "Dienstag",
    matchNumber: week,
    wrestlerA,
    wrestlerB,
    matchupKey: [wrestlerA, wrestlerB].sort().join(" vs "),
    status: "completed",
    source: { file: "test.xlsx", sheet: "Schedule_22W" },
  };
}

function result(matchRow: Match, winner: string | null, outcome: MatchResult["outcome"] = "decisive"): MatchResult {
  return {
    matchId: matchRow.id,
    outcome,
    winner,
    loser: winner ? (winner === matchRow.wrestlerA ? matchRow.wrestlerB : matchRow.wrestlerA) : null,
    resultSource: "User",
    notes: null,
    source: matchRow.source,
  };
}

function review(
  completedThroughWeek: number,
  standings: StandingRow[],
  matches: Match[] = [],
  results: MatchResult[] = [],
) {
  return deriveSplitCompletionReview({
    leagueYear: 2,
    split: "Opening Split",
    completedThroughWeek,
    standings,
    matches,
    results,
    matchupReference: [],
    hasLeagueFinalsTemplate: true,
  });
}

describe("Opening Split completion", () => {
  it("keeps Week 21 and earlier in the regular-week workflow", () => {
    expect(review(21, []).nextPhase).toBe("Regular Week");
    expect(review(21, []).nextRegularWeek).toBe(22);
    expect(review(21, []).regularPhaseComplete).toBe(false);
  });

  it("moves completed Week 22 to Tiebreaker Review without inventing Week 23 fixtures", () => {
    const completion = review(22, []);
    expect(completion.nextPhase).toBe("Tiebreaker Review");
    expect(completion.nextRegularWeek).toBeNull();
    expect(completion.hasAuthoritativeWeek23Schedule).toBe(false);
    expect(completion.sourceWarnings[0]).toContain("do not generate fixtures");
  });

  it("does not invent Week 25 after the Opening Split", () => {
    const completion = review(24, []);
    expect(completion.nextPhase).toBe("No Authoritative Next Phase");
    expect(completion.nextRegularWeek).toBeNull();
    expect(completion.sourceWarnings.join(" ")).toContain("Week 25 belongs to the Closing Split");
  });
});

describe("consequential tiebreaker review", () => {
  it("resolves a two-wrestler boundary tie by unambiguous head-to-head", () => {
    const h2h = match(1, "Alpha", "Beta");
    const tie = review(22, [standing("Alpha", 4, 30), standing("Beta", 5, 30)], [h2h], [result(h2h, "Alpha")])
      .consequentialTies[0];
    expect(tie).toMatchObject({ status: "Resolved by Head-to-Head", winner: "Alpha" });
  });

  it("advances a 1–1 head-to-head to longest winning streak", () => {
    const first = match(1, "Alpha", "Beta");
    const second = match(12, "Alpha", "Beta");
    const alphaExtra = match(13, "Alpha", "Gamma");
    const alphaExtraTwo = match(14, "Alpha", "Delta");
    const tie = review(
      22,
      [standing("Alpha", 4, 30), standing("Beta", 5, 30)],
      [first, second, alphaExtra, alphaExtraTwo],
      [result(first, "Alpha"), result(second, "Beta"), result(alphaExtra, "Alpha"), result(alphaExtraTwo, "Alpha")],
    ).consequentialTies[0];
    expect(tie).toMatchObject({ status: "Resolved by Winning Streak", winner: "Alpha" });
  });

  it("requires a tiebreaker match when head-to-head and longest streak remain tied", () => {
    const first = match(1, "Alpha", "Beta");
    const second = match(12, "Alpha", "Beta");
    const tie = review(
      22,
      [standing("Alpha", 4, 30, 1), standing("Beta", 5, 30, 12)],
      [first, second],
      [result(first, "Alpha"), result(second, "Beta")],
    ).consequentialTies[0];
    expect(tie).toMatchObject({ status: "Tiebreaker Match Required", winner: null });
  });

  it("does not use seed to resolve an otherwise tied review", () => {
    const tie = review(22, [standing("Alpha", 4, 30, 1), standing("Beta", 5, 30, 12)])
      .consequentialTies[0];
    expect(tie).toMatchObject({ status: "Tiebreaker Match Required", winner: null });
  });

  it("marks an unresolved three-wrestler tie for a Triple Threat Tiebreaker", () => {
    const tie = review(22, [
      standing("Alpha", 3, 30),
      standing("Beta", 4, 30),
      standing("Gamma", 5, 30),
    ]).consequentialTies[0];
    expect(tie).toMatchObject({
      status: "Tiebreaker Match Required",
      recommendedFormat: "Triple Threat Tiebreaker",
      winner: null,
    });
    expect(tie.explanation).toContain("mini-table formulas are not used");
  });

  it("does not force review for a harmless tie inside one zone", () => {
    expect(review(22, [standing("Alpha", 6, 24), standing("Beta", 7, 24)]).consequentialTies)
      .toHaveLength(0);
  });

  it("treats a draw as ending a winning streak", () => {
    const win = match(1, "Alpha", "Gamma");
    const draw = match(2, "Alpha", "Delta");
    const first = match(3, "Alpha", "Beta");
    const second = match(12, "Alpha", "Beta");
    const tie = review(
      22,
      [standing("Alpha", 4, 30), standing("Beta", 5, 30)],
      [win, draw, first, second],
      [result(win, "Alpha"), result(draw, null, "draw"), result(first, "Alpha"), result(second, "Beta")],
    ).consequentialTies[0];
    expect(tie.status).toBe("Tiebreaker Match Required");
  });

  it("resolves three different longest winning streaks without using seed", () => {
    const matches = [
      match(1, "Alpha", "Delta"),
      match(2, "Alpha", "Epsilon"),
      match(3, "Alpha", "Zeta"),
      match(4, "Beta", "Delta"),
      match(5, "Beta", "Epsilon"),
      match(6, "Gamma", "Delta"),
    ];
    const tie = review(
      22,
      [standing("Alpha", 3, 30, 12), standing("Beta", 4, 30, 1), standing("Gamma", 5, 30, 2)],
      matches,
      matches.map((row) => result(row, row.wrestlerA)),
    ).consequentialTies[0];
    expect(tie).toMatchObject({ status: "Resolved by Winning Streak", winner: "Alpha", recommendedFormat: null });
  });

  it.each([
    { count: 4, format: "Mini-Tournament", status: "Tiebreaker Match Required" },
    { count: 5, format: "Fatal 5-Way Tiebreaker", status: "Tiebreaker Match Required" },
    { count: 6, format: "Review Required", status: "Review Required" },
  ])("recommends $format for an unresolved $count-wrestler tie", ({ count, format, status }) => {
    const names = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"].slice(0, count);
    const tie = review(22, names.map((name, index) => standing(name, index + 1, 30, count - index)))
      .consequentialTies[0];
    expect(tie).toMatchObject({ status, recommendedFormat: format, winner: null });
  });

  it("does not use aggregate head-to-head to resolve a three-wrestler subgroup", () => {
    const alphaBeta = match(1, "Alpha", "Beta");
    const betaGamma = match(2, "Beta", "Gamma");
    const gammaAlpha = match(3, "Gamma", "Alpha");
    const tie = review(
      22,
      [standing("Alpha", 3, 30), standing("Beta", 4, 30), standing("Gamma", 5, 30)],
      [alphaBeta, betaGamma, gammaAlpha],
      [result(alphaBeta, "Alpha"), result(betaGamma, "Beta"), result(gammaAlpha, "Gamma")],
    ).consequentialTies[0];
    expect(tie).toMatchObject({ status: "Tiebreaker Match Required", winner: null });
    expect(tie.explanation).toContain("mini-table formulas are not used");
  });
});
