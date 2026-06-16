import { describe, expect, it } from "vitest";
import { placementLabel, placementZone } from "../visual-identity";
import { calculateLiveStandingsFromCurrentMaster, type ConfirmedResult } from "../tracker-state";
import { enrichLegacyProfilesFromCurrentMaster } from "../legacy";
import { generateLegacyCommentary, type LegacyProfile } from "../legacy-commentary";
import type { LeagueName, Match, StandingRow, StreakRecord } from "../types";

const leagues: LeagueName[] = ["Global League", "Continental League", "National League", "Regional League"];

function rows(league: LeagueName, points = 0): StandingRow[] {
  return Array.from({ length: 12 }, (_, index) => ({
    league,
    rank: index + 1,
    wrestler: `${league} ${index + 1}`,
    seed: index + 1,
    matches: points ? 5 : 0,
    wins: points ? Math.max(0, Math.floor((points - index) / 3)) : 0,
    draws: points ? (points - index) % 3 : 0,
    losses: points ? 5 - Math.max(0, Math.floor((points - index) / 3)) - ((points - index) % 3) : 0,
    points: points ? points - index : 0,
    status: "source",
  }));
}

const baseProfile: LegacyProfile = {
  wrestler: "Ace",
  currentLeague: "National League",
  goatStatusTier: null,
  leagueWinsTotal: 0,
  globalChampionWins: 0,
  eliteCupWins: 0,
  doubles: 0,
  invincibleSplits: 0,
  invincibleHinrunden: 0,
  invincibleRueckrunden: 0,
  longestWinStreakOverall: 2,
  sourceCommentary: null,
};

describe("Phase 10.8.3 live standings zone mapping", () => {
  it("maps Global League ranks to champion, Elite Cup, mid-table, relegation playoff, and direct relegation zones", () => {
    expect(placementLabel("Global League", 1)).toBe("Champion");
    for (const rank of [2, 3, 4]) expect(placementLabel("Global League", rank)).toBe("Elite Cup Qualification");
    for (const rank of [5, 6, 7, 8]) expect(placementLabel("Global League", rank)).toBe("Mid-table");
    for (const rank of [9, 10, 11]) expect(placementLabel("Global League", rank)).toBe("Relegation Playoff");
    expect(placementLabel("Global League", 12)).toBe("Direct Relegation");
  });

  it("maps Continental and National rank 1 to champion plus direct promotion and ranks 2-4 to promotion playoff", () => {
    for (const league of ["Continental League", "National League"] as const) {
      expect(placementLabel(league, 1)).toBe("Champion + Direct Promotion");
      for (const rank of [2, 3, 4]) expect(placementLabel(league, rank)).toBe("Promotion Playoff");
      for (const rank of [9, 10, 11]) expect(placementLabel(league, rank)).toBe("Relegation Playoff");
      expect(placementLabel(league, 12)).toBe("Direct Relegation");
    }
  });

  it("keeps Regional League ranks 5-12 safe because there is no lower league", () => {
    expect(placementLabel("Regional League", 1)).toBe("Champion + Direct Promotion");
    for (const rank of [2, 3, 4]) expect(placementLabel("Regional League", rank)).toBe("Promotion Playoff");
    for (const rank of [5, 6, 7, 8, 9, 10, 11, 12]) {
      expect(placementLabel("Regional League", rank)).toBe("Regional League Hold / Safe");
      expect(placementZone(rank, "Regional League")).toBe("regional-hold");
    }
  });
});

describe("Phase 10.8.3 active split source authority", () => {
  it("uses Closing Split Week 5 current master standings instead of resetting to previous split or seed values", () => {
    const baseline = leagues.flatMap((league) => rows(league, 15));
    const standings = calculateLiveStandingsFromCurrentMaster(baseline, [], [], "Closing Split", 29);
    expect(standings.find((row) => row.wrestler === "Global League 1")?.points).toBe(15);
    expect(standings.find((row) => row.wrestler === "Global League 1")?.matches).toBe(5);
  });

  it("applies browser-local overlays only after the current master completed week so points and statuses share one source", () => {
    const baseline = rows("Global League", 15);
    const match: Match = { id: "m30", leagueYear: 2, split: "Closing Split", week: 30, roundType: "Hinrunde", league: "Global League", showDay: "Freitag", matchNumber: 1, wrestlerA: "Global League 2", wrestlerB: "Global League 12", matchupKey: "x", status: "scheduled", source: { file: "test", sheet: "test" } };
    const result: ConfirmedResult = { league: "Global League", week: 30, matchId: "m30", wrestlerA: match.wrestlerA, wrestlerB: match.wrestlerB, resultType: "Winner", winner: "Global League 12", source: "Manual", confirmedAt: "2026-06-16T00:00:00.000Z" };
    const ignoredOld = { ...result, week: 28, matchId: "old" };
    const standings = calculateLiveStandingsFromCurrentMaster(baseline, [match], [result, ignoredOld], "Closing Split", 29);
    expect(standings.find((row) => row.wrestler === "Global League 12")?.points).toBe(7);
    expect(placementLabel("Global League", standings.find((row) => row.wrestler === "Global League 12")!.rank)).toBeTruthy();
  });
});

describe("Phase 10.8.3 legacy current master sync and commentary", () => {
  it("updates current league, final placement checkpoint, and longest winning streak from current master sheets", () => {
    const standings = [{ ...rows("Global League")[0], wrestler: "Ace", rank: 1 }];
    const streaks: StreakRecord[] = [{ league: "Global League", wrestler: "Ace", seed: 1, currentStreak: 6, longestWinningStreak: 6, lastResult: "W", notes: null }];
    const [profile] = enrichLegacyProfilesFromCurrentMaster([baseProfile], standings, streaks);
    expect(profile.currentLeague).toBe("Global League");
    expect(profile.longestWinStreakOverall).toBe(6);
    expect(profile.checkpoints?.finalPosition).toBe(1);
  });

  it("updates comments for titles, streaks, Elite Cup, and direct promotion without inventing unavailable achievements", () => {
    const commentary = generateLegacyCommentary({ ...baseProfile, leagueWinsTotal: 1, eliteCupWins: 1, longestWinStreakOverall: 8 });
    expect(commentary.category).toBe("Elite Cup Specialist");
    expect(commentary.text).toMatch(/Elite Cup/i);
    expect(commentary.text).not.toMatch(/Global Championship/i);
    expect(generateLegacyCommentary({ ...baseProfile, wrestler: "Ace" })).toEqual(generateLegacyCommentary({ ...baseProfile, wrestler: "Ace" }));
  });

  it("does not overuse generic streak commentary when title data exists", () => {
    expect(generateLegacyCommentary({ ...baseProfile, leagueWinsTotal: 1, longestWinStreakOverall: 12 }).category).toBe("League Title Standard");
    expect(generateLegacyCommentary({ ...baseProfile, globalChampionWins: 1, longestWinStreakOverall: 12 }).category).toBe("Global Championship Standard");
  });
});
