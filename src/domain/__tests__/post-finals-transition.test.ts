import { describe, expect, it } from "vitest";
import { resolveCurrentUser } from "../current-user";
import { buildCanonicalLeagueFinalsRegistry, buildLeagueFinalsMatchIdentity, deriveLeagueFinalsReview, type LeagueFinalsResult } from "../league-finals";
import { buildNextSplitStandings, derivePostFinalsTransition } from "../post-finals-transition";
import { generateSchedule, validateSchedule } from "../schedule-setup";
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
    if (match.kind === "Elite Cup Final") {
      winner = results.find((result) => result.matchId === matches.find((candidate) => candidate.kind === "Elite Cup Semifinal" && candidate.matchNumber === 4)?.id)?.winner ?? null;
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


  it("uses shared registry instead of stale or empty passed matches", () => {
    const transition = derive({ matches: [] });
    expect(transition.diagnostics.canonicalAuthoritativeFinalsMatchIds).toEqual(buildCanonicalLeagueFinalsRegistry(standings).map((match) => match.id));
    expect(transition.finalsComplete).toBe(true);
  });

  it("reconciles canonical Night One match 1 and Night Two match 6 IDs", () => {
    const transition = derive({ results: completedResults() });
    expect(transition.diagnostics.savedLeagueFinalsResultKeys).toContain("league-finals:night-one:match-1");
    expect(transition.diagnostics.savedLeagueFinalsResultKeys).toContain("league-finals:night-two:match-6");
    expect(transition.diagnostics.extraUnmatchedSavedIds).toEqual([]);
    expect(transition.diagnostics.missingCanonicalIds).toEqual([]);
  });

  it("recognizes freshly saved canonical League Finals results", () => {
    const transition = derive({ results: completedResults() });
    expect(transition.finalsComplete).toBe(true);
    expect(transition.invalidResults).toEqual([]);
    expect(transition.missingResults).toEqual([]);
  });

  it("keeps the authoritative registry populated when warnings are present", () => {
    const transition = derive({
      hasAuthoritativeClosingSchedule: false,
      manualReviews: [{
        id: "review-1",
        scope: "regular-season",
        matchId: "warning-only",
        league: "Global League",
        weekOrEvent: 22,
        wrestlerA: "Global 1",
        wrestlerB: "Global 2",
        note: "warning should not empty registry",
        status: "open",
        createdAt: "2026-06-14T00:00:00.000Z",
      }],
    });
    expect(transition.diagnostics.canonicalAuthoritativeFinalsMatchIds).toHaveLength(12);
  });

  it("recognizes migrated legacy participant-based League Finals results", () => {
    const legacy = completedResults().map((result) => {
      const match = matches.find((candidate) => candidate.id === result.matchId)!;
      return { ...result, matchId: buildLeagueFinalsMatchIdentity(match) };
    });
    const transition = derive({ results: legacy });
    expect(transition.finalsComplete).toBe(true);
    expect(transition.invalidResults).toEqual([]);
    expect(transition.missingResults).toEqual([]);
    expect(transition.diagnostics.migratedLegacyResultKeysCount).toBe(12);
  });

  it("validates the Elite Cup Final by canonical slot ID", () => {
    const results = completedResults();
    const final = matches.find((match) => match.kind === "Elite Cup Final")!;
    const finalResult = results.find((result) => result.matchId === final.id)!;
    expect(final.id).toBe("league-finals:night-two:match-6");
    expect(finalResult.winner).toBe("Global 1");
    expect(derive({ results }).invalidResults).toEqual([]);
  });


  it("treats canonical slot ID as primary identity and ignores stale payload metadata", () => {
    const results = completedResults().map((result, index) => ({
      ...result,
      matchIdentity: `stale-payload:${index}:old-participant-snapshot`,
    }));

    const transition = derive({ results });

    expect(transition.finalsComplete).toBe(true);
    expect(transition.invalidResults.join(" ")).not.toContain("saved result belongs to a different League Finals matchup");
    expect(transition.diagnostics.repairedPayloadCount).toBe(12);
    expect(transition.diagnostics.staleMetadataIgnoredCount).toBe(12);
    expect(transition.diagnostics.invalidWinnerOutcomeCount).toBe(0);
  });

  it("invalidates only the canonical result whose winner cannot apply to the current slot", () => {
    const results = completedResults();
    results[0] = {
      ...results[0],
      matchIdentity: "stale-payload:old-matchup",
      winner: "Not In This Match",
    };

    const transition = derive({ results });

    expect(transition.finalsComplete).toBe(false);
    expect(transition.invalidResults).toEqual(["league-finals:night-one:match-1: winner must be one of the derived participants."]);
    expect(transition.missingResults).toEqual([]);
    expect(transition.diagnostics.invalidWinnerOutcomeCount).toBe(1);
  });

  it("reports all twelve saved canonical IDs and unlocks when completion flags are set", () => {
    const transition = derive({ results: completedResults() });

    expect(transition.diagnostics.savedCanonicalIdsFound).toHaveLength(12);
    expect(transition.finalsComplete).toBe(true);
    expect(transition.unlocked).toBe(true);
    expect(transition.invalidResults).toEqual([]);
  });

  it("normalizes all twelve canonical saved winners and unlocks without discarding results", () => {
    const saved = completedResults().map((result, index) => ({
      ...result,
      winner: result.winner ? (index % 2 === 0 ? `${result.winner} wins` : `#11 ${result.winner.toUpperCase()}`) : result.winner,
      label: `Saved card row ${index + 1}`,
      participantSnapshot: { stale: true },
    }));

    const transition = derive({ results: saved });

    expect(transition.finalsComplete).toBe(true);
    expect(transition.unlocked).toBe(true);
    expect(transition.invalidResults).toEqual([]);
    expect(transition.missingResults).toEqual([]);
    expect(transition.diagnostics.savedCanonicalIdsFound).toHaveLength(12);
    expect(transition.diagnostics.repairedWinnerCount).toBe(12);
    expect(transition.diagnostics.resultWinnerReconciliation[0]).toMatchObject({
      canonicalResultId: "league-finals:night-one:match-1",
      rawSavedWinner: "National 11 wins",
      normalizedWinner: "national 11",
      authoritativeParticipantA: "National 11",
      authoritativeParticipantB: "Regional 2",
      repairedWinner: "National 11",
    });
  });

  it("accepts relegation No Contest results without a winner and counts the diagnostic", () => {
    const results = completedResults();
    results[0] = { ...results[0], resultType: "No Contest", winner: null };

    const transition = derive({ results });

    expect(transition.invalidResults).toEqual([]);
    expect(transition.diagnostics.noContestAcceptedCount).toBe(1);
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

  it("builds zeroed next-split standings without carrying old completed results forward", () => {
    const nextStandings = buildNextSplitStandings(derive().assignments);
    expect(nextStandings).toHaveLength(48);
    for (const league of LEAGUE_NAMES) expect(nextStandings.filter((row) => row.league === league)).toHaveLength(12);
    expect(new Set(nextStandings.map((row) => row.wrestler)).size).toBe(48);
    expect(nextStandings.every((row) => row.matches === 0 && row.wins === 0 && row.draws === 0 && row.losses === 0 && row.points === 0)).toBe(true);
  });

  it("keeps the Current User valid and follows their post-finals league", () => {
    const nextStandings = buildNextSplitStandings(derive().assignments);
    expect(resolveCurrentUser(nextStandings, "Continental 1")).toMatchObject({
      wrestler: "Continental 1",
      league: "Global League",
    });
  });

  it("generates a valid 4x12 Closing Split schedule that references only active post-finals wrestlers", () => {
    const nextStandings = buildNextSplitStandings(derive().assignments);
    const seeds = Object.fromEntries(LEAGUE_NAMES.map((league) => [
      league,
      nextStandings.filter((row) => row.league === league).map((row) => ({ seed: row.seed, wrestler: row.wrestler })),
    ])) as Parameters<typeof generateSchedule>[0]["seeds"];
    const rosters = Object.fromEntries(LEAGUE_NAMES.map((league) => [league, seeds[league].map((seed) => seed.wrestler)])) as Record<(typeof LEAGUE_NAMES)[number], string[]>;
    const schedule = generateSchedule({ leagueYear: 2, split: "Closing Split", yearWeekStart: 25, seeds, generatedAt: "2026-06-14T00:00:00.000Z" });
    const validation = validateSchedule(schedule, { rosters });
    const active = new Set(nextStandings.map((row) => row.wrestler));

    expect(validation).toMatchObject({ valid: true, totalMatches: 528 });
    expect(schedule.every((match) => active.has(match.wrestlerA) && active.has(match.wrestlerB))).toBe(true);
    expect(new Set(schedule.map((match) => match.id)).size).toBe(528);
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
    const finalIndex = results.findIndex((result) => result.matchId === matches.find((match) => match.kind === "Elite Cup Final")?.id);
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
