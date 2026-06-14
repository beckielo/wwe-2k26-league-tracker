import { describe, expect, it } from "vitest";
import {
  deriveLeagueFinalsReview,
  relegationHigherLeagueWrestler,
  validateFinalsNightCompletion,
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
    expect(derive()).toMatchObject({ ready: true, readinessLabel: "Review Required" });
  });

  it("is blocked when an unresolved tiebreaker match is required", () => {
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
    expect(derive({ ties: [tie] })).toMatchObject({ ready: false, readinessLabel: "Blocked" });
  });

  it("does not become ready before Week 22", () => {
    expect(derive({ week: 21 }).ready).toBe(false);
  });
});

describe("League Finals outcomes and cards", () => {
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

  it("uses workbook template semifinal pairings and labels their source", () => {
    const semifinals = derive().nightTwo.filter((match) => match.kind === "Elite Cup Semifinal");
    expect(semifinals.map((match) => [match.wrestlerA, match.wrestlerB])).toEqual([
      ["Global 1", "Global 4"],
      ["Global 2", "Global 3"],
    ]);
    expect(semifinals.every((match) => match.sourceLabel.startsWith("PPV_Template_Layout"))).toBe(true);
  });

  it("shows Review Required rather than guessing semifinals when the template is missing", () => {
    const review = derive({ template: false });
    expect(review.nightTwo.filter((match) => match.kind === "Elite Cup Semifinal")).toHaveLength(0);
    expect(review.reviewRequired.join(" ")).toContain("no authoritative source template");
    expect(review.eliteCupQualifiers).toHaveLength(4);
  });

  it("does not generate filler, Week 25, or a Closing Split roster", () => {
    const review = derive();
    expect([...review.nightOne, ...review.nightTwo]).toHaveLength(12);
    expect(review.reviewRequired).toContain("Manual card padding required if WWE 2K requires more matches; no filler is generated.");
    expect(review).not.toHaveProperty("week25");
    expect(review).not.toHaveProperty("closingSplitRoster");
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

  it("does not perform Phase 9B behavior when both cards can complete", () => {
    const review = derive();
    expect(review.sourceWarnings.join(" ")).toContain("does not create Week 25");
    expect(review).not.toHaveProperty("closingSplitRoster");
    expect(review).not.toHaveProperty("postFinalsLeagueComposition");
  });
});
