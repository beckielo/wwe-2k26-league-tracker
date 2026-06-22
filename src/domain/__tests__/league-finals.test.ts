import { describe, expect, it } from "vitest";
import {
  buildLeagueFinalsMatchIdentity,
  deriveLeagueFinalsReview,
  relegationHigherLeagueWrestler,
  normalizeLeagueFinalsResults,
  sanitizeLeagueFinalsResults,
  validateFinalsNightCompletion,
  validateLeagueFinalsMatchSource,
  validateLeagueFinalsResult,
  type LeagueFinalsMatch,
  type LeagueFinalsResult,
} from "../league-finals";
import type { ConsequentialTieReview } from "../split-completion";
import { LEAGUE_NAMES, type StandingRow } from "../types";

const standings: StandingRow[] = LEAGUE_NAMES.flatMap((league) =>
  Array.from({ length: 12 }, (_, index) => ({
    league,
    rank: index + 1,
    wrestler: `${league.split(" ")[0]} ${index + 1}`,
    seed: index + 1,
    matches: 22,
    wins: 22 - index,
    draws: 0,
    losses: index,
    points: (22 - index) * 3,
    status: "",
  })),
);

const phase19gPlacements: Record<string, Record<number, string>> = {
  "Global League": {
    1: "Gunther",
    2: "Roman Reigns",
    3: "Drew McIntyre",
    4: "Cody Rhodes",
    9: "John Cena",
    10: "CM Punk",
    11: "AJ Styles",
    12: "Triple H",
  },
  "Continental League": {
    1: "Randy Orton",
    2: "Jacob Fatu",
    3: "Bronson Reed",
    4: "Shawn Michaels",
    9: "Ilja Dragunov",
    10: "Damian Priest",
    11: "Kevin Owens",
    12: "Undertaker",
  },
  "National League": {
    1: "LA Knight",
    2: "The Rock",
    3: "Carmelo Hayes",
    4: "Chad Gable",
    9: "Shinsuke Nakamura",
    10: "Pete Dunne",
    11: "Penta",
    12: "Rey Mysterio",
  },
  "Regional League": {
    1: "Dragon Lee",
    2: "The Miz",
    3: "Trick Williams",
    4: "Kofi Kingston",
    9: "Johnny Gargano",
    10: "Xavier Woods",
    11: "Montez Ford",
    12: "Axiom",
  },
};

const phase19gStandings: StandingRow[] = standings.map((row) => ({
  ...row,
  wrestler: phase19gPlacements[row.league]?.[row.rank] ?? `${row.league.split(" ")[0]} Reserve ${row.rank}`,
}));

function derive(options?: {
  week?: number;
  ties?: ConsequentialTieReview[];
  template?: boolean;
}) {
  return deriveLeagueFinalsReview({
    completedThroughWeek: options?.week ?? 22,
    standings,
    consequentialTies: options?.ties ?? [],
    hasLeagueFinalsTemplate: options?.template ?? true,
  });
}

describe("League Finals readiness", () => {
  it("is available after completed Week 22 with no unresolved tiebreakers", () => {
    expect(derive()).toMatchObject({ ready: true, readinessLabel: "Ready" });
  });

  it("treats reviewed tiebreaker state with valid final standings as ready", () => {
    const tie: ConsequentialTieReview = {
      league: "Global League",
      points: 30,
      placements: [4, 5],
      wrestlers: ["Global 4", "Global 5"],
      status: "Review Required",
      winner: null,
      recommendedFormat: null,
      explanation: "Reviewed standings already reflect the final order.",
    };
    const review = derive({ ties: [tie] });
    expect(review).toMatchObject({ ready: true, readinessLabel: "Ready" });
    expect(review.readinessReasons.join(" ")).not.toContain("consequential tiebreaker");
    expect([...review.nightOne, ...review.nightTwo]).toHaveLength(12);
  });

  it("keeps cards renderable when an unresolved tiebreaker warning blocks readiness", () => {
    const tie: ConsequentialTieReview = {
      league: "Global League",
      points: 30,
      placements: [4, 5],
      wrestlers: ["Global 4", "Global 5"],
      status: "Tiebreaker Match Required",
      winner: null,
      recommendedFormat: null,
      explanation: "Still tied.",
    };
    const review = derive({ ties: [tie] });
    expect(review).toMatchObject({ ready: false, readinessLabel: "Blocked" });
    expect(review.readinessReasons).toContain("1 consequential tiebreaker group(s) remain unresolved.");
    expect(review.cardRenderability.renderable).toBe(true);
    expect(review.cardRenderability.nightOneGeneratedCount).toBe(6);
    expect(review.cardRenderability.nightTwoGeneratedCount).toBe(6);
    expect([...review.nightOne, ...review.nightTwo]).toHaveLength(12);
  });

  it("does not become ready before Week 22", () => {
    expect(derive({ week: 21 }).ready).toBe(false);
  });
});

describe("League Finals outcomes and cards", () => {

  it("derives every league champion from the supplied final rank #1 standings", () => {
    const current = standings.map((row) => row.rank === 1 ? { ...row, wrestler: `Current ${row.league}` } : row);
    expect(deriveLeagueFinalsReview({
      completedThroughWeek: 22,
      standings: current,
      consequentialTies: [],
      hasLeagueFinalsTemplate: true,
    }).champions).toEqual(LEAGUE_NAMES.map((league) => ({ league, wrestler: `Current ${league}` })));
  });

  it("uses current National League #1 instead of a stale previous champion", () => {
    const current = standings.map((row) => row.league === "National League" && row.rank === 1 ? { ...row, wrestler: "Current National Champion" } : row);
    const review = deriveLeagueFinalsReview({ completedThroughWeek: 22, standings: current, consequentialTies: [], hasLeagueFinalsTemplate: true });
    expect(review.champions.find((champion) => champion.league === "National League")?.wrestler).toBe("Current National Champion");
  });

  it("prefers tiebreaker-reviewed standings supplied after review over pre-review order", () => {
    const reviewed = standings.map((row) => {
      if (row.league === "Global League" && row.rank === 1) return { ...row, wrestler: "Reviewed Global #1" };
      if (row.league === "Global League" && row.rank === 4) return { ...row, wrestler: "Reviewed Global #4" };
      return row;
    });
    const review = deriveLeagueFinalsReview({ completedThroughWeek: 22, standings: reviewed, consequentialTies: [], hasLeagueFinalsTemplate: true });
    expect(review.champions[0]).toEqual({ league: "Global League", wrestler: "Reviewed Global #1" });
    expect(review.nightTwo.find((match) => match.kind === "Elite Cup Semifinal" && match.matchNumber === 4)).toMatchObject({ wrestlerA: "Reviewed Global #1", wrestlerB: "Reviewed Global #4" });
  });
  it("derives direct promotions from lower-league #1 wrestlers", () => {
    expect(derive().directMovements.filter((movement) => movement.reason === "Direct promotion"))
      .toEqual([
        expect.objectContaining({ wrestler: "Continental 1", toLeague: "Global League" }),
        expect.objectContaining({ wrestler: "National 1", toLeague: "Continental League" }),
        expect.objectContaining({ wrestler: "Regional 1", toLeague: "National League" }),
      ]);
  });

  it("derives direct relegations from upper-league #12 wrestlers", () => {
    expect(derive().directMovements.filter((movement) => movement.reason === "Direct relegation"))
      .toEqual([
        expect.objectContaining({ wrestler: "Global 12", toLeague: "Continental League" }),
        expect.objectContaining({ wrestler: "Continental 12", toLeague: "National League" }),
        expect.objectContaining({ wrestler: "National 12", toLeague: "Regional League" }),
      ]);
  });

  it.each([
    ["Global League", "Continental League", "Night Two"],
    ["Continental League", "National League", "Night One"],
    ["National League", "Regional League", "Night One"],
  ] as const)("pairs %s #11/#10/#9 against %s #2/#3/#4", (higher, lower, night) => {
    const matches = derive().relegationMatches.filter((match) => match.higherLeague === higher);
    expect(matches).toHaveLength(3);
    expect(matches.map((match) => [match.wrestlerA, match.wrestlerB, match.night])).toEqual([
      [`${higher.split(" ")[0]} 11`, `${lower.split(" ")[0]} 2`, night],
      [`${higher.split(" ")[0]} 10`, `${lower.split(" ")[0]} 3`, night],
      [`${higher.split(" ")[0]} 9`, `${lower.split(" ")[0]} 4`, night],
    ]);
  });

  it("keeps Global #1 as champion and independently lists the Global Top 4 for the Elite Cup", () => {
    const review = derive();
    expect(review.champions[0]).toEqual({ league: "Global League", wrestler: "Global 1" });
    expect(review.eliteCupQualifiers.map((row) => row.wrestler)).toEqual(["Global 1", "Global 2", "Global 3", "Global 4"]);
  });

  it("derives Elite Cup semifinal pairings directly from final Global standings", () => {
    const semifinals = derive().nightTwo.filter((match) => match.kind === "Elite Cup Semifinal");
    expect(semifinals.map((match) => [match.wrestlerA, match.wrestlerB])).toEqual([
      ["Global 1", "Global 4"],
      ["Global 2", "Global 3"],
    ]);
    expect(semifinals.every((match) => match.sourceLabel.startsWith("Final live standings after Week 22 lock"))).toBe(true);
  });

  it("does not use a missing old template to block final-standings Elite Cup semifinals", () => {
    const review = derive({ template: false });
    expect(review.nightTwo.filter((match) => match.kind === "Elite Cup Semifinal")).toHaveLength(2);
    expect(review.reviewRequired.join(" ")).not.toContain("no authoritative source template");
    expect(review.eliteCupQualifiers).toHaveLength(4);
  });


  it("uses stable canonical slot IDs for all League Finals matches", () => {
    const review = derive();
    expect(review.nightOne.map((match) => match.id)).toEqual([
      "league-finals:night-one:match-1",
      "league-finals:night-one:match-2",
      "league-finals:night-one:match-3",
      "league-finals:night-one:match-4",
      "league-finals:night-one:match-5",
      "league-finals:night-one:match-6",
    ]);
    expect(review.nightTwo.map((match) => match.id)).toEqual([
      "league-finals:night-two:match-1",
      "league-finals:night-two:match-2",
      "league-finals:night-two:match-3",
      "league-finals:night-two:match-4",
      "league-finals:night-two:match-5",
      "league-finals:night-two:match-6",
    ]);
  });

  it("migrates legacy participant-based League Finals result keys without dropping outcomes", () => {
    const review = derive();
    const match = review.nightOne[0];
    const legacyKey = buildLeagueFinalsMatchIdentity(match);
    const normalized = normalizeLeagueFinalsResults([...review.nightOne, ...review.nightTwo], [{
      matchId: legacyKey,
      resultType: "Winner",
      winner: match.wrestlerB,
      confirmedAt: "2026-06-14T00:00:00.000Z",
    }]);

    expect(normalized.migratedLegacyResultKeys).toEqual([legacyKey]);
    expect(normalized.unmatchedSavedResultKeys).toEqual([]);
    expect(normalized.results[0]).toMatchObject({
      matchId: "league-finals:night-one:match-1",
      resultType: "Winner",
      winner: match.wrestlerB,
    });
  });

  it("preserves existing Night One and Night Two canonical result state across sanitization", () => {
    const review = derive();
    const matches = [...review.nightOne, ...review.nightTwo];
    const semifinalResults = [
      { matchId: "league-finals:night-two:match-4", resultType: "Winner" as const, winner: review.nightTwo[3].wrestlerA, confirmedAt: "2026-06-14T00:00:00.000Z" },
      { matchId: "league-finals:night-two:match-5", resultType: "Winner" as const, winner: review.nightTwo[4].wrestlerA, confirmedAt: "2026-06-14T00:00:00.000Z" },
    ];
    const results: LeagueFinalsResult[] = matches.map((match) => ({
      matchId: match.id,
      resultType: "Winner",
      winner: match.kind === "Elite Cup Final" ? semifinalResults[0].winner : match.wrestlerA,
      confirmedAt: "2026-06-14T00:00:00.000Z",
    }));
    results.splice(9, 2, ...semifinalResults);

    expect(sanitizeLeagueFinalsResults(matches, results).map((result) => result.matchId)).toEqual(results.map((result) => result.matchId));
  });

  it("does not generate filler, Week 25, or a Closing Split roster", () => {
    const review = derive();
    expect([...review.nightOne, ...review.nightTwo]).toHaveLength(12);
    expect(review.reviewRequired).toContain("Manual card padding required if WWE 2K requires more matches; no filler is generated.");
    expect(review).not.toHaveProperty("week25");
    expect(review).not.toHaveProperty("closingSplitRoster");
  });

  it("derives Night One exactly from lower and middle transition ranks", () => {
    expect(derive().nightOne.map((match) => [match.wrestlerA, match.wrestlerB])).toEqual([
      ["National 11", "Regional 2"],
      ["National 10", "Regional 3"],
      ["National 9", "Regional 4"],
      ["Continental 11", "National 2"],
      ["Continental 10", "National 3"],
      ["Continental 9", "National 4"],
    ]);
  });

  it("derives Night Two exactly from upper transition ranks and Global Elite Cup structure", () => {
    expect(derive().nightTwo.map((match) => [match.wrestlerA, match.wrestlerB])).toEqual([
      ["Global 11", "Continental 2"],
      ["Global 10", "Continental 3"],
      ["Global 9", "Continental 4"],
      ["Global 1", "Global 4"],
      ["Global 2", "Global 3"],
      [null, null],
    ]);
  });

  it("uses the same four-league, 12-rank source shape as live standings", () => {
    const review = derive();
    expect(review.sourceAudit).toHaveLength(4);
    expect(review.sourceAudit.map((audit) => audit.league)).toEqual(LEAGUE_NAMES);
    for (const leagueAudit of review.sourceAudit) {
      expect(leagueAudit.ranks.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 9, 10, 11, 12]);
      expect(leagueAudit.ranks.every((entry) => entry.league === leagueAudit.league)).toBe(true);
    }
  });

  it("rejects same-league relegation playoff matchups before rendering cards", () => {
    const invalid: LeagueFinalsMatch = {
      ...derive().relegationMatches[0],
      wrestlerA: "LA Knight",
      wrestlerB: "Chad Gable",
      higherLeague: "National League",
      lowerLeague: "National League",
    };
    expect(validateLeagueFinalsMatchSource(invalid).join(" ")).toContain("invalid relegation playoff league pairing");
    expect(validateLeagueFinalsMatchSource(invalid).join(" ")).toContain("invalid same-league relegation playoff");
  });

  it("does not use stale Source Audit data outside the supplied final live standings", () => {
    const current = standings.map((row) => row.league === "Regional League" && row.rank === 3 ? { ...row, wrestler: "Current Regional #3" } : row);
    const review = deriveLeagueFinalsReview({ completedThroughWeek: 22, standings: current, consequentialTies: [], hasLeagueFinalsTemplate: true });
    expect(review.sourceAudit.find((audit) => audit.league === "Regional League")?.ranks.find((entry) => entry.rank === 3)?.wrestler).toBe("Current Regional #3");
    expect(review.nightOne[1].wrestlerB).toBe("Current Regional #3");
  });

  it("blocks card generation for invalid or stale final standings sources", () => {
    const stale = standings.filter((row) => !(row.league === "Regional League" && row.rank === 12));
    const review = deriveLeagueFinalsReview({ completedThroughWeek: 21, standings: stale, consequentialTies: [], hasLeagueFinalsTemplate: false });
    expect(review.ready).toBe(false);
    expect(review.readinessReasons).toContain("League Finals source standings are invalid or stale.");
    expect(review.cardRenderability.renderable).toBe(false);
    expect(review.cardRenderability.hiddenReasons.join(" ")).toContain("Final standings source is invalid or stale.");
    expect([...review.nightOne, ...review.nightTwo]).toEqual([]);
  });

  it("renders Phase 19G Night One cards from the corrected final standings placements", () => {
    const review = deriveLeagueFinalsReview({ completedThroughWeek: 22, standings: phase19gStandings, consequentialTies: [], hasLeagueFinalsTemplate: true });
    expect(review.nightOne).toHaveLength(6);
    expect(review.nightOne.map((match) => [match.wrestlerA, match.wrestlerB])).toEqual([
      ["Penta", "The Miz"],
      ["Pete Dunne", "Trick Williams"],
      ["Shinsuke Nakamura", "Kofi Kingston"],
      ["Kevin Owens", "The Rock"],
      ["Damian Priest", "Carmelo Hayes"],
      ["Ilja Dragunov", "Chad Gable"],
    ]);
  });

  it("renders Phase 19J Night One from corrected final standings even when readiness is blocked by stale tiebreaker warning", () => {
    const tie: ConsequentialTieReview = {
      league: "Global League", points: 30, placements: [4, 5], wrestlers: ["Cody Rhodes", "Reserve"],
      status: "Tiebreaker Match Required", winner: null, recommendedFormat: null, explanation: "Stale warning remains from pre-reviewed state.",
    };
    const review = deriveLeagueFinalsReview({ completedThroughWeek: 22, standings: phase19gStandings, consequentialTies: [tie], hasLeagueFinalsTemplate: true });
    expect(review.ready).toBe(false);
    expect(review.readinessReasons).toContain("1 consequential tiebreaker group(s) remain unresolved.");
    expect(review.nightOne.map((match) => [match.wrestlerA, match.wrestlerB])).toEqual([
      ["Penta", "The Miz"],
      ["Pete Dunne", "Trick Williams"],
      ["Shinsuke Nakamura", "Kofi Kingston"],
      ["Kevin Owens", "The Rock"],
      ["Damian Priest", "Carmelo Hayes"],
      ["Ilja Dragunov", "Chad Gable"],
    ]);
  });

  it("renders Phase 19J Night Two from corrected final standings even when readiness is blocked by stale tiebreaker warning", () => {
    const tie: ConsequentialTieReview = {
      league: "Global League", points: 30, placements: [4, 5], wrestlers: ["Cody Rhodes", "Reserve"],
      status: "Tiebreaker Match Required", winner: null, recommendedFormat: null, explanation: "Stale warning remains from pre-reviewed state.",
    };
    const review = deriveLeagueFinalsReview({ completedThroughWeek: 22, standings: phase19gStandings, consequentialTies: [tie], hasLeagueFinalsTemplate: false });
    expect(review.ready).toBe(false);
    expect(review.nightTwo.map((match) => [match.wrestlerA, match.wrestlerB])).toEqual([
      ["AJ Styles", "Jacob Fatu"],
      ["CM Punk", "Bronson Reed"],
      ["John Cena", "Shawn Michaels"],
      ["Gunther", "Cody Rhodes"],
      ["Roman Reigns", "Drew McIntyre"],
      [null, null],
    ]);
    expect(review.sourceWarnings).not.toHaveLength(0);
  });

  it("renders Phase 19G Night Two cards and keeps the Elite Cup Final placeholder card", () => {
    const review = deriveLeagueFinalsReview({ completedThroughWeek: 22, standings: phase19gStandings, consequentialTies: [], hasLeagueFinalsTemplate: true });
    expect(review.nightTwo).toHaveLength(6);
    expect(review.nightTwo.map((match) => [match.wrestlerA, match.wrestlerB])).toEqual([
      ["AJ Styles", "Jacob Fatu"],
      ["CM Punk", "Bronson Reed"],
      ["John Cena", "Shawn Michaels"],
      ["Gunther", "Cody Rhodes"],
      ["Roman Reigns", "Drew McIntyre"],
      [null, null],
    ]);
    expect(review.nightTwo[5]).toMatchObject({
      kind: "Elite Cup Final",
      authoritative: true,
      resultMeaning: "Winner becomes Global Elite Cup Winner.",
    });
  });

  it("keeps reviewed tiebreaker states from suppressing valid derived cards or showing stale unresolved warnings", () => {
    const tie: ConsequentialTieReview = {
      league: "Global League",
      points: 30,
      placements: [5, 6],
      wrestlers: ["Global Reserve 5", "Global Reserve 6"],
      status: "Review Required",
      winner: null,
      recommendedFormat: null,
      explanation: "Non-card warning should not hide already-derived finals cards.",
    };
    const review = deriveLeagueFinalsReview({ completedThroughWeek: 22, standings: phase19gStandings, consequentialTies: [tie], hasLeagueFinalsTemplate: true });
    expect(review.ready).toBe(true);
    expect(review.readinessLabel).toBe("Ready");
    expect(review.readinessReasons.join(" ")).not.toContain("consequential tiebreaker");
    expect(review.nightOne).toHaveLength(6);
    expect(review.nightTwo).toHaveLength(6);
  });

  it("preserves corrected source sections while rendering Phase 19G cards", () => {
    const review = deriveLeagueFinalsReview({ completedThroughWeek: 22, standings: phase19gStandings, consequentialTies: [], hasLeagueFinalsTemplate: true });
    expect(review.champions).toEqual([
      { league: "Global League", wrestler: "Gunther" },
      { league: "Continental League", wrestler: "Randy Orton" },
      { league: "National League", wrestler: "LA Knight" },
      { league: "Regional League", wrestler: "Dragon Lee" },
    ]);
    expect(review.directMovements.filter((movement) => movement.reason === "Direct promotion").map((movement) => movement.wrestler)).toEqual(["Randy Orton", "LA Knight", "Dragon Lee"]);
    expect(review.directMovements.filter((movement) => movement.reason === "Direct relegation").map((movement) => movement.wrestler)).toEqual(["Triple H", "Undertaker", "Rey Mysterio"]);
    expect(review.eliteCupQualifiers.map((row) => row.wrestler)).toEqual(["Gunther", "Roman Reigns", "Drew McIntyre", "Cody Rhodes"]);
  });

  it("keys saved results with stable canonical slot match IDs", () => {
    const match = derive().nightOne[0];
    expect(match.id).toBe("league-finals:night-one:match-1");
    expect(match.id).not.toContain("national-11");
    expect(match.id).not.toContain("regional-2");
  });
});

describe("League Finals result resolution", () => {
  it("keeps the higher-league wrestler up after a relegation No Contest", () => {
    const match = derive().relegationMatches[0];
    const result: LeagueFinalsResult = {
      matchId: match.id,
      resultType: "No Contest",
      winner: null,
      confirmedAt: new Date().toISOString(),
    };
    expect(relegationHigherLeagueWrestler(match, result)).toBe("National 11");
  });

  it("requires every authoritative match before completing a night", () => {
    const review = derive();
    const allMatches = [...review.nightOne, ...review.nightTwo];
    expect(validateFinalsNightCompletion("Night One", allMatches, [])).toHaveLength(6);
  });

  it("shows saved results only when the winner belongs to the current matchup", () => {
    const match = derive().relegationMatches[0];
    const stale: LeagueFinalsResult = { matchId: match.id, resultType: "Winner", winner: "Ethan Page", confirmedAt: "2026-06-22T00:00:00.000Z" };
    expect(validateLeagueFinalsResult(stale, derive().relegationMatches, [stale])).toContain(`${match.id}: winner must be one of the derived participants.`);
    expect(sanitizeLeagueFinalsResults(derive().relegationMatches, [stale])).toEqual([]);
  });

  it("ignores a saved result from a stale matchup index after participants change", () => {
    const original = derive().relegationMatches[0];
    const changedStandings = standings.map((row) => row.wrestler === original.wrestlerA ? { ...row, wrestler: "Changed National 11" } : row);
    const changed = deriveLeagueFinalsReview({ completedThroughWeek: 22, standings: changedStandings, consequentialTies: [], hasLeagueFinalsTemplate: true }).relegationMatches[0];
    const oldResult: LeagueFinalsResult = {
      matchId: changed.id,
      matchIdentity: ["old-card", original.wrestlerA, original.wrestlerB].join(":"),
      resultType: "Winner",
      winner: original.wrestlerA,
      confirmedAt: "2026-06-22T00:00:00.000Z",
    };
    expect(sanitizeLeagueFinalsResults([changed], [oldResult])).toEqual([]);
  });

  it("does not attach old saved winners to regenerated card participants", () => {
    const oldReview = derive();
    const oldMatch = oldReview.relegationMatches[0];
    const regeneratedStandings = standings.map((row) => row.rank === 11 && row.league === "National League" ? { ...row, wrestler: "LA Knight" } : row);
    const regeneratedMatch = deriveLeagueFinalsReview({ completedThroughWeek: 22, standings: regeneratedStandings, consequentialTies: [], hasLeagueFinalsTemplate: true }).relegationMatches[0];
    const oldResult: LeagueFinalsResult = { matchId: regeneratedMatch.id, resultType: "Winner", winner: oldMatch.wrestlerA, confirmedAt: "2026-06-22T00:00:00.000Z" };
    expect(sanitizeLeagueFinalsResults([regeneratedMatch], [oldResult])).toEqual([]);
  });

  it("does not perform Phase 9B behavior when both cards can complete", () => {
    const review = derive();
    expect(review.sourceWarnings.join(" ")).toContain("does not create Week 25");
    expect(review).not.toHaveProperty("closingSplitRoster");
    expect(review).not.toHaveProperty("postFinalsLeagueComposition");
  });
});
