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

const phase19pPlacements: Record<string, Record<number, string>> = {
  "Global League": { 1: "Gunther", 2: "Roman Reigns", 3: "Drew McIntyre", 4: "Cody Rhodes", 9: "John Cena", 10: "CM Punk", 11: "AJ Styles", 12: "Triple H" },
  "Continental League": { 1: "Randy Orton", 2: "Jacob Fatu", 3: "Bronson Reed", 4: "Shawn Michaels", 9: "Ilja Dragunov", 10: "Damian Priest", 11: "Kevin Owens", 12: "Undertaker" },
  "National League": { 1: "LA Knight", 2: "The Rock", 3: "Carmelo Hayes", 4: "Chad Gable", 9: "Shinsuke Nakamura", 10: "Pete Dunne", 11: "Penta", 12: "Rey Mysterio" },
  "Regional League": { 1: "Dragon Lee", 2: "The Miz", 3: "Trick Williams", 4: "Kofi Kingston", 9: "Johnny Gargano", 10: "Xavier Woods", 11: "Montez Ford", 12: "Axiom" },
};

const phase19pStandings: StandingRow[] = standings.map((row) => ({
  ...row,
  wrestler: phase19pPlacements[row.league]?.[row.rank] ?? `${row.league.split(" ")[0]} Reserve ${row.rank}`,
}));

const phase19pFinals = deriveLeagueFinalsReview({
  completedThroughWeek: 22,
  standings: phase19pStandings,
  consequentialTies: [],
  hasLeagueFinalsTemplate: true,
});
const phase19pMatches = [...phase19pFinals.nightOne, ...phase19pFinals.nightTwo];

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

function phase19pCompletedResults(): LeagueFinalsResult[] {
  const winners: Record<string, string> = {
    "league-finals:night-one:match-1": "The Miz",
    "league-finals:night-one:match-2": "Trick Williams",
    "league-finals:night-one:match-3": "Kofi Kingston",
    "league-finals:night-one:match-4": "The Rock",
    "league-finals:night-one:match-5": "Damian Priest",
    "league-finals:night-one:match-6": "Ilja Dragunov",
    "league-finals:night-two:match-1": "AJ Styles",
    "league-finals:night-two:match-2": "Bronson Reed",
    "league-finals:night-two:match-3": "Shawn Michaels",
    "league-finals:night-two:match-4": "Gunther",
    "league-finals:night-two:match-5": "Roman Reigns",
    "league-finals:night-two:match-6": "Gunther",
  };
  return phase19pMatches.map((match) => ({
    matchId: match.id,
    resultType: "Winner",
    winner: winners[match.id],
    confirmedAt: "2026-06-22T00:00:00.000Z",
    matchIdentity: buildLeagueFinalsMatchIdentity(match),
  }));
}

function derivePhase19p(overrides: Partial<Parameters<typeof derivePostFinalsTransition>[0]> = {}) {
  return derivePostFinalsTransition({
    completedThroughWeek: 22,
    standings: phase19pStandings,
    consequentialTies: [],
    matches: phase19pMatches,
    results: phase19pCompletedResults(),
    completedNights: [
      { night: "Night One", completedAt: "2026-06-22T00:00:00.000Z" },
      { night: "Night Two", completedAt: "2026-06-22T00:00:00.000Z" },
    ],
    champions: phase19pFinals.champions,
    directMovements: phase19pFinals.directMovements,
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

  it("changes gate copy away from complete League Finals first once finals are complete", () => {
    const transition = derive({
      directMovements: [
        ...finals.directMovements,
        {
          wrestler: "Missing Wrestler",
          fromLeague: "Regional League",
          toLeague: "National League",
          reason: "Direct promotion",
        },
      ],
    });

    expect(transition.finalsComplete).toBe(true);
    expect(transition.compositionValid).toBe(false);
    expect(transition.lockedMessage).toBe("Post-Finals transition locked: review league composition first.");
    expect(transition.lockedMessage?.toLowerCase()).not.toContain("complete league finals first");
  });


  it("uses shared registry instead of stale or empty passed matches", () => {
    const transition = derive({ matches: [] });
    expect(transition.diagnostics.canonicalAuthoritativeFinalsMatchIds).toEqual(buildCanonicalLeagueFinalsRegistry(standings).map((match) => match.id));
    expect(transition.finalsComplete).toBe(true);
  });

  it("shares the exact canonical Phase 19P registry with League Finals", () => {
    const transition = derivePhase19p();
    expect(buildCanonicalLeagueFinalsRegistry(phase19pStandings).map((match) => [match.id, match.wrestlerA, match.wrestlerB]))
      .toEqual(phase19pMatches.map((match) => [match.id, match.wrestlerA, match.wrestlerB]));
    expect(transition.diagnostics.resultWinnerReconciliation.find((row) => row.canonicalResultId === "league-finals:night-one:match-1"))
      .toMatchObject({ authoritativeParticipantA: "Penta", authoritativeParticipantB: "The Miz", rawSavedWinner: "The Miz" });
  });

  it("validates corrected Phase 19P saved winners and completes the gate", () => {
    const transition = derivePhase19p();
    expect(phase19pMatches.map((match) => [match.id, match.wrestlerA, match.wrestlerB])).toEqual([
      ["league-finals:night-one:match-1", "Penta", "The Miz"],
      ["league-finals:night-one:match-2", "Pete Dunne", "Trick Williams"],
      ["league-finals:night-one:match-3", "Shinsuke Nakamura", "Kofi Kingston"],
      ["league-finals:night-one:match-4", "Kevin Owens", "The Rock"],
      ["league-finals:night-one:match-5", "Damian Priest", "Carmelo Hayes"],
      ["league-finals:night-one:match-6", "Ilja Dragunov", "Chad Gable"],
      ["league-finals:night-two:match-1", "AJ Styles", "Jacob Fatu"],
      ["league-finals:night-two:match-2", "CM Punk", "Bronson Reed"],
      ["league-finals:night-two:match-3", "John Cena", "Shawn Michaels"],
      ["league-finals:night-two:match-4", "Gunther", "Cody Rhodes"],
      ["league-finals:night-two:match-5", "Roman Reigns", "Drew McIntyre"],
      ["league-finals:night-two:match-6", null, null],
    ]);
    expect(transition.finalsComplete).toBe(true);
    expect(transition.invalidResults).toEqual([]);
    expect(transition.missingResults).toEqual([]);
    expect(transition.diagnostics.savedCanonicalIdsFound).toHaveLength(12);
  });

  it("repairs a stale authoritative registry mismatch from saved matchIdentity without deleting results", () => {
    const staleStandings = phase19pStandings.map((row) => {
      if (row.league === "National League" && row.rank === 11) return { ...row, wrestler: "Carmelo Hayes" };
      if (row.league === "Regional League" && row.rank === 2) return { ...row, wrestler: "Dragon Lee" };
      if (row.league === "National League" && row.rank === 3) return { ...row, wrestler: "Penta" };
      if (row.league === "Regional League" && row.rank === 1) return { ...row, wrestler: "The Miz" };
      return row;
    });
    const transition = derivePhase19p({ standings: staleStandings });
    const diagnostic = transition.diagnostics.resultWinnerReconciliation.find((row) => row.canonicalResultId === "league-finals:night-one:match-1");
    expect(diagnostic).toMatchObject({
      savedMatchIdentity: expect.stringContaining("penta:the-miz"),
      rawSavedWinner: "The Miz",
      authoritativeParticipantA: "Penta",
      authoritativeParticipantB: "The Miz",
      registrySource: "saved-match-identity-fallback",
    });
    expect(transition.invalidResults).not.toContain("league-finals:night-one:match-1: winner must be one of the derived participants.");
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


  it("applies all direct transfer-map movements and removes movers from original leagues", () => {
    const transition = derive();
    expect(transition.assignments.find((row) => row.wrestler === "National 1")).toMatchObject({
      priorLeague: "National League", newLeague: "Continental League", movement: "Champion/direct promotion",
    });
    expect(transition.assignments.find((row) => row.wrestler === "Regional 1")).toMatchObject({
      priorLeague: "Regional League", newLeague: "National League", movement: "Champion/direct promotion",
    });
    expect(transition.assignments.find((row) => row.wrestler === "Continental 1")).toMatchObject({
      priorLeague: "Continental League", newLeague: "Global League", movement: "Champion/direct promotion",
    });
    expect(transition.assignments.find((row) => row.wrestler === "Global 12")).toMatchObject({
      priorLeague: "Global League", newLeague: "Continental League", movement: "Direct relegation",
    });
    expect(transition.assignments.find((row) => row.wrestler === "Continental 12")).toMatchObject({
      priorLeague: "Continental League", newLeague: "National League", movement: "Direct relegation",
    });
    expect(transition.assignments.find((row) => row.wrestler === "National 12")).toMatchObject({
      priorLeague: "National League", newLeague: "Regional League", movement: "Direct relegation",
    });
    expect(transition.leagueComposition["National League"].some((row) => row.wrestler === "National 1")).toBe(false);
    expect(transition.leagueComposition["Global League"].some((row) => row.wrestler === "Global 12")).toBe(false);
  });

  it("labels direct-promoted National #1 and Regional #1 as promotions, not relegations", () => {
    const transition = derive();
    expect(transition.assignments.find((row) => row.wrestler === "National 1")?.movement).toBe("Champion/direct promotion");
    expect(transition.assignments.find((row) => row.wrestler === "Regional 1")?.movement).toBe("Champion/direct promotion");
    expect(transition.assignments.find((row) => row.wrestler === "National 1")?.movement).not.toBe("Relegated");
    expect(transition.assignments.find((row) => row.wrestler === "Regional 1")?.movement).not.toBe("Relegated");
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


  it("labels a higher-league playoff winner as retained and the lower-league loser as failed promotion", () => {
    const transition = derive();
    const match = finals.relegationMatches[0];
    expect(transition.assignments.find((row) => row.wrestler === match.wrestlerA)).toMatchObject({
      newLeague: match.higherLeague, movement: "Retained higher league",
    });
    expect(transition.assignments.find((row) => row.wrestler === match.wrestlerB)).toMatchObject({
      newLeague: match.lowerLeague, movement: "Failed promotion",
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


  it("regression: fixes the post-finals 11/13 split with a balanced 4x12 transfer map", () => {
    const transition = derivePhase19p();
    expect(LEAGUE_NAMES.map((league) => transition.leagueComposition[league].length)).toEqual([12, 12, 12, 12]);
    expect(new Set(transition.assignments.map((row) => row.wrestler)).size).toBe(48);
    expect(transition.compositionValid).toBe(true);
    expect(transition.compositionErrors).toEqual([]);
  });

  it("blocks composition when a relegation playoff result is missing", () => {
    const missingFirstRelegation = completedResults().filter((result) => result.matchId !== finals.relegationMatches[0].id);
    const transition = derive({ results: missingFirstRelegation });

    expect(transition.compositionValid).toBe(false);
    expect(transition.compositionErrors).toContain(`${finals.relegationMatches[0].id}: missing League Finals result blocks composition.`);
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
    expect(transition.assignments.find((row) => row.wrestler === "Global 2")).toMatchObject({
      newLeague: "Global League",
      movement: "Retained",
    });
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
