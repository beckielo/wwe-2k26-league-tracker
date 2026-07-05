import { describe, expect, it } from "vitest";
import {
  evaluateClosingCheckpoint,
  resolveReconstructedPointTies,
  selectClosingCheckpoint,
  type ClosingCheckpointCandidate,
} from "../closing-checkpoint-reconstruction";
import { acceptedScheduleMatches, generateSchedule, type ScheduleSeed } from "../schedule-setup";
import type { ConfirmedResult } from "../tracker-state";
import {
  LEAGUE_NAMES,
  type HeadToHeadRecord,
  type LeagueName,
  type StandingRow,
  type StreakRecord,
} from "../types";

const seeds = Object.fromEntries(LEAGUE_NAMES.map((league, leagueIndex) => [
  league,
  Array.from({ length: 12 }, (_, index) => ({
    seed: index + 1,
    wrestler: `Checkpoint ${leagueIndex + 1}-${index + 1}`,
  })),
])) as Record<LeagueName, ScheduleSeed[]>;
const generated = generateSchedule({
  leagueYear: 2,
  split: "Closing Split",
  yearWeekStart: 25,
  seeds,
  generatedAt: "2026-06-27T20:39:53.067Z",
});
const schedule = acceptedScheduleMatches({
  matches: generated,
  acceptedAt: "2026-06-27T20:39:53.067Z",
  acceptedBy: "local user workflow",
  source: "Generated",
  leagueYear: 2,
  split: "Closing Split",
  seedSource: "test",
  rosterSource: "test",
  generatorVersion: "1.0.0",
  validation: { valid: true, status: "Valid", errors: [], warnings: [], totalMatches: 528 },
});

function resultsThrough(week: number): ConfirmedResult[] {
  return schedule.filter((match) => match.week <= week).map((match) => ({
    league: match.league,
    week: match.week,
    matchId: match.id,
    wrestlerA: match.wrestlerA,
    wrestlerB: match.wrestlerB,
    resultType: "Winner",
    winner: match.wrestlerA,
    source: match.league === "National League" ? "Manual" : "Simulation",
    confirmedAt: `2026-07-${String(match.week - 24).padStart(2, "0")}T00:00:00.000Z`,
  }));
}

function candidate(
  id: string,
  week: number,
  completedAt: string,
  overrides: Partial<ClosingCheckpointCandidate> = {},
): ClosingCheckpointCandidate {
  return {
    id,
    leagueYear: 2,
    split: "Closing Split",
    completedThroughYearWeek: week,
    writebackCompletedAt: completedAt,
    scheduleSource: "accepted generated snapshot",
    schedule,
    results: resultsThrough(week),
    lockedWeeks: Array.from({ length: week - 24 }, (_, index) => index + 25),
    provenance: "committed-weekly-workbooks",
    ...overrides,
  };
}

describe("Closing checkpoint reconstruction", () => {
  it("resolves equal points by H2H, then longest streak, and never by seed", () => {
    const rows: StandingRow[] = [
      { league: "Global League", rank: 1, wrestler: "Alpha", seed: 1, matches: 2, wins: 1, draws: 0, losses: 1, points: 3, status: "provisional" },
      { league: "Global League", rank: 2, wrestler: "Beta", seed: 12, matches: 2, wins: 1, draws: 0, losses: 1, points: 3, status: "provisional" },
    ];
    const streaks: StreakRecord[] = [
      { league: "Global League", wrestler: "Alpha", seed: 1, currentStreak: 0, longestWinningStreak: 9, lastResult: "L", notes: null },
      { league: "Global League", wrestler: "Beta", seed: 12, currentStreak: 1, longestWinningStreak: 1, lastResult: "W", notes: null },
    ];
    const headToHead: HeadToHeadRecord[] = [{
      league: "Global League",
      week: 1,
      roundType: "Hinrunde",
      wrestlerA: "Alpha",
      wrestlerB: "Beta",
      winner: "Beta",
      loser: "Alpha",
    }];

    expect(resolveReconstructedPointTies(rows, headToHead, streaks).standings.map((row) => row.wrestler))
      .toEqual(["Beta", "Alpha"]);
    expect(resolveReconstructedPointTies([...rows].reverse(), [], streaks).standings.map((row) => row.wrestler))
      .toEqual(["Alpha", "Beta"]);

    const unresolvedRows = [...rows].reverse();
    const unresolved = resolveReconstructedPointTies(unresolvedRows, [], streaks.map((row) => ({
      ...row,
      longestWinningStreak: 1,
    })));
    const swappedSeeds = resolveReconstructedPointTies(unresolvedRows.map((row) => ({
      ...row,
      seed: row.seed === 1 ? 12 : 1,
    })), [], streaks.map((row) => ({
      ...row,
      longestWinningStreak: 1,
    })));
    expect(unresolved.standings.map((row) => row.wrestler)).toEqual(["Beta", "Alpha"]);
    expect(swappedSeeds.standings.map((row) => row.wrestler)).toEqual(["Beta", "Alpha"]);
    expect(unresolved.unresolvedTies).toEqual([
      expect.objectContaining({ wrestlers: ["Beta", "Alpha"], status: "needs_tiebreaker" }),
    ]);
  });

  it("accepts a complete W36 candidate and reconstructs 48 twelve-match standings rows", () => {
    const evaluated = evaluateClosingCheckpoint(candidate("productive-w36", 36, "2026-07-03T22:45:23.399Z"));
    expect(evaluated).toMatchObject({
      coherent: true,
      promotable: true,
      confidence: "high",
      completedThroughYearWeek: 36,
      splitWeek: 12,
      resultCount: 288,
      lockedWeekCount: 12,
    });
    expect(evaluated.standings).toHaveLength(48);
    expect(evaluated.standings.every((row) => row.matches === 12)).toBe(true);
    expect(new Set(evaluated.standings.map((row) => `${row.league}:${row.wrestler}`))).toHaveLength(48);
  });

  it("does not promote final regular-season standings when point ties still need a tiebreaker", () => {
    const drawnResults = resultsThrough(46).map((result): ConfirmedResult => ({
      ...result,
      resultType: "Draw",
      winner: null,
    }));
    const evaluated = evaluateClosingCheckpoint(candidate(
      "unresolved-w46",
      46,
      "2026-07-22T20:00:00.000Z",
      { results: drawnResults },
    ));

    expect(evaluated.tiebreakerStatus).toBe("needs_tiebreaker");
    expect(evaluated.unresolvedTies).toHaveLength(4);
    expect(evaluated.promotable).toBe(false);
    expect(evaluated.errors.join(" ")).toContain("Tiebreaker Match is required");
    expect(evaluated.standings.every((row) => row.status.includes("needs_tiebreaker"))).toBe(true);
    expect(evaluated.standings.filter((row) => row.league === "Global League").map((row) => row.seed))
      .not.toEqual([...Array.from({ length: 12 }, (_, index) => index + 1)]);
  });

  it("selects newer chronological W36 over an older stale W46 run", () => {
    const selection = selectClosingCheckpoint([
      candidate("stale-w46", 46, "2026-06-26T14:49:37.261Z"),
      candidate("productive-w36", 36, "2026-07-03T22:45:23.399Z"),
    ]);
    expect(selection.selected?.candidateId).toBe("productive-w36");
  });

  it("lets a lower coherent candidate beat a higher incoherent candidate", () => {
    const brokenW46 = candidate("broken-w46", 46, "2026-07-04T10:00:00.000Z");
    brokenW46.results.pop();
    const selection = selectClosingCheckpoint([
      brokenW46,
      candidate("coherent-w36", 36, "2026-07-03T22:45:23.399Z"),
    ]);
    expect(selection.selected?.candidateId).toBe("coherent-w36");
    expect(selection.evaluations.find((entry) => entry.candidateId === "broken-w46")?.coherent).toBe(false);
  });

  it("does not promote a newer browser or QA artifact", () => {
    const selection = selectClosingCheckpoint([
      candidate("productive-w36", 36, "2026-07-03T22:45:23.399Z"),
      candidate("qa-w46", 46, "2026-07-04T23:00:00.000Z", { provenance: "qa-fixture" }),
      candidate("browser-w40", 40, "2026-07-04T22:00:00.000Z", { provenance: "browser-local" }),
    ]);
    expect(selection.selected?.candidateId).toBe("productive-w36");
    expect(selection.evaluations.filter((entry) => entry.candidateId !== "productive-w36"))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ promotable: false, confidence: "conflicted" }),
      ]));
  });

  it("rejects Opening/Closing, Year, result, and lock mixing", () => {
    const mixed = candidate("mixed", 36, "2026-07-03T22:45:23.399Z");
    mixed.schedule = mixed.schedule.map((match, index) => index === 0
      ? { ...match, leagueYear: 3, split: "Opening Split" }
      : match);
    mixed.results[1] = { ...mixed.results[1], wrestlerA: "Wrong Context" };
    mixed.lockedWeeks = mixed.lockedWeeks.filter((week) => week !== 30);
    const evaluated = evaluateClosingCheckpoint(mixed);
    expect(evaluated.coherent).toBe(false);
    expect(evaluated.promotable).toBe(false);
    expect(evaluated.errors.join(" ")).toMatch(/mixes League Year or Split/);
    expect(evaluated.errors.join(" ")).toMatch(/Locked weeks are not contiguous/);
    expect(evaluated.errors.join(" ")).toMatch(/does not match the candidate schedule/);
  });

  it("returns no selection so the workbook fallback can lead when no coherent candidate exists", () => {
    const incomplete = candidate("incomplete", 36, "2026-07-03T22:45:23.399Z", { results: [] });
    const selection = selectClosingCheckpoint([incomplete]);
    expect(selection.selected).toBeNull();
    expect(selection.reason).toMatch(/workbook fallback/i);
  });
});
