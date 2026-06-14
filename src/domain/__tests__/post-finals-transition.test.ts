import { describe, expect, it } from "vitest";
import { deriveLeagueFinalsReview, type LeagueFinalsResult } from "../league-finals";
import { derivePostFinalsTransition } from "../post-finals-transition";
import { LEAGUE_NAMES, type StandingRow } from "../types";

const standings: StandingRow[] = LEAGUE_NAMES.flatMap((league) =>
  Array.from({ length: 12 }, (_, index) => ({
    league,
    rank: index + 1,
    wrestler: `${league.split(" ")[0]} ${index + 1}`,
    seed: 12 - index,
    matches: 22,
    wins: index === 0 && league === "Global League" ? 22 : 21 - index,
    draws: 0,
    losses: index === 0 && league === "Global League" ? 0 : index + 1,
    points: index === 0 && league === "Global League" ? 66 : (21 - index) * 3,
    status: "",
  })),
);

const finals = deriveLeagueFinalsReview({
  completedThroughWeek: 22,
  standings,
  consequentialTies: [],
  hasLeagueFinalsTemplate: true,
});
const matches = [...finals.nightOne, ...finals.nightTwo];

function completedResults(): LeagueFinalsResult[] {
  const results: LeagueFinalsResult[] = [];
  for (const match of matches) {
    let winner = match.wrestlerA;
    if (match.id === "finals-elite-cup-final") {
      winner = results.find((result) => result.matchId === "finals-elite-cup-sf1")?.winner ?? null;
    }
    results.push({
      matchId: match.id,
      resultType: "Winner",
      winner,
      confirmedAt: "2026-06-14T00:00:00.000Z",
    });
  }
  return results;
}

function derive(overrides: Partial<Parameters<typeof derivePostFinalsTransition>[0]> = {}) {
  return derivePostFinalsTransition({
    completedThroughWeek: 22,
    standings,
    consequentialTies: [],
    matches,
    results: completedResults(),
    completedNights: [
      { night: "Night One", completedAt: "2026-06-14T00:00:00.000Z" },
      { night: "Night Two", completedAt: "2026-06-14T00:00:00.000Z" },
    ],
    champions: finals.champions,
    directMovements: finals.directMovements,
    hasAuthoritativeClosingSchedule: false,
    ...overrides,
  });
}

describe("Post-Finals completion gate", () => {
  it("remains locked while League Finals results or a night are incomplete", () => {
    const transition = derive({ results: [], completedNights: [] });
    expect(transition.unlocked).toBe(false);
    expect(transition.lockedMessage).toBe("Post-Finals Transition locked: complete League Finals first.");
    expect(transition.missingResults).toHaveLength(12);
  });

  it("unlocks after every required result and both nights are complete", () => {
    expect(derive()).toMatchObject({ unlocked: true, finalsComplete: true, compositionValid: true });
  });

  it("rejects duplicate finals results", () => {
    const results = completedResults();
    expect(derive({ results: [...results, results[0]] }).invalidResults.join(" ")).toContain("duplicate");
  });
});

describe("Post-Finals movement and composition", () => {
  it("applies direct promotions and direct relegations", () => {
    const transition = derive();
    expect(transition.assignments.find((row) => row.wrestler === "Continental 1")).toMatchObject({
      newLeague: "Global League", movement: "Champion/direct promotion",
    });
    expect(transition.assignments.find((row) => row.wrestler === "Global 12")).toMatchObject({
      newLeague: "Continental League", movement: "Direct relegation",
    });
  });

  it("places the relegation winner in the higher league and loser in the lower league", () => {
    const results = completedResults();
    const match = finals.relegationMatches[0];
    const index = results.findIndex((result) => result.matchId === match.id);
    results[index] = { ...results[index], winner: match.wrestlerB };
    const transition = derive({ results });
    expect(transition.assignments.find((row) => row.wrestler === match.wrestlerB)).toMatchObject({
      newLeague: match.higherLeague, movement: "Promoted",
    });
    expect(transition.assignments.find((row) => row.wrestler === match.wrestlerA)).toMatchObject({
      newLeague: match.lowerLeague, movement: "Relegated",
    });
  });

  it("retains the original league assignments after No Contest / unclear", () => {
    const results = completedResults();
    const match = finals.relegationMatches[0];
    const index = results.findIndex((result) => result.matchId === match.id);
    results[index] = { ...results[index], resultType: "No Contest", winner: null };
    const transition = derive({ results });
    expect(transition.assignments.find((row) => row.wrestler === match.wrestlerA)?.newLeague).toBe(match.higherLeague);
    expect(transition.assignments.find((row) => row.wrestler === match.wrestlerB)?.newLeague).toBe(match.lowerLeague);
  });

  it("marks a DQ without caused-by metadata Review Required", () => {
    const results = completedResults();
    results[0] = { ...results[0], resultType: "Disqualification" } as unknown as LeagueFinalsResult;
    const transition = derive({ results });
    expect(transition.reviewRequired.join(" ")).toContain("does not identify the wrestler who caused it");
    expect(transition.closingSplitSetupReady).toBe(false);
  });

  it("produces four unique, complete leagues", () => {
    const transition = derive();
    expect(LEAGUE_NAMES.map((league) => transition.leagueComposition[league].length)).toEqual([12, 12, 12, 12]);
    expect(new Set(transition.assignments.map((row) => row.wrestler)).size).toBe(48);
    expect(transition.compositionErrors).toEqual([]);
  });

  it("blocks duplicate and missing wrestler placement", () => {
    const invalidStandings = standings.map((row) => ({ ...row }));
    invalidStandings[1].wrestler = invalidStandings[0].wrestler;
    const transition = derive({ standings: invalidStandings });
    expect(transition.unlocked).toBe(false);
    expect(transition.compositionErrors.join(" ")).toContain("Duplicate wrestler");
  });
});

describe("Ordering, readiness, and legacy boundaries", () => {
  it("keeps Global #1 champion separate from the Elite Cup winner", () => {
    const results = completedResults();
    const finalIndex = results.findIndex((result) => result.matchId === "finals-elite-cup-final");
    results[finalIndex] = { ...results[finalIndex], winner: "Global 2" };
    const transition = derive({ results });
    expect(transition.champions[0]).toEqual({ league: "Global League", wrestler: "Global 1" });
    expect(transition.legacyFacts).toContainEqual(expect.objectContaining({
      label: "Global Elite Cup Winner", wrestler: "Global 2",
    }));
  });

  it("does not use source seed as a proposed-order tiebreaker", () => {
    const transition = derive();
    const global = transition.proposedOrder.find((group) => group.league === "Global League");
    expect(global?.reviewRequired).toBe(true);
    expect(global?.wrestlers[0].wrestler).toBe("Global 1");
  });

  it("does not generate or start Week 25 without an authoritative schedule", () => {
    const transition = derive();
    expect(transition.week25Generated).toBe(false);
    expect(transition.closingSplitSetupReady).toBe(false);
    expect(transition.closingScheduleMessage).toBe(
      "Closing Split schedule source missing: create or import schedule before starting Week 25.",
    );
  });

  it("can report setup ready when composition and authoritative schedule are both available", () => {
    expect(derive({ hasAuthoritativeClosingSchedule: true }).closingSplitSetupReady).toBe(true);
  });

  it("preserves factual legacy achievements without calculated GOAT rankings", () => {
    const transition = derive();
    expect(transition.legacyFacts).toContainEqual(expect.objectContaining({
      label: "Undefeated / Invincible Opening Split", wrestler: "Global 1",
    }));
    expect(transition.reviewRequired.join(" ")).toContain("Legacy formula Review Required");
    expect(transition).not.toHaveProperty("goatRanking");
    expect(transition).not.toHaveProperty("goatPoints");
  });
});
