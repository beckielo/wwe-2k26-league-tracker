import { describe, expect, it } from "vitest";
import { completeWeek, createEmptyTrackerState, type ConfirmedResult } from "../tracker-state";
import { createWeeklyCloseExports } from "../weekly-close-exports";
import type { LeagueName, Match, StandingRow } from "../types";

const leagues: LeagueName[] = [
  "Global League",
  "Continental League",
  "National League",
  "Regional League",
];

const matches: Match[] = leagues.flatMap((league, leagueIndex) =>
  Array.from({ length: 6 }, (_, index) => ({
    id: `14-${leagueIndex}-${index}`,
    leagueYear: 2,
    split: "Opening Split" as const,
    week: 14,
    roundType: "Rückrunde" as const,
    league,
    showDay: league === "National League" ? ("Mittwoch" as const) : ("Montag" as const),
    matchNumber: index + 1,
    wrestlerA: `${league}, Wrestler A${index}`,
    wrestlerB: `${league} Wrestler "B${index}"`,
    matchupKey: `${league}-${index}`,
    status: "scheduled" as const,
    source: { file: "test.xlsx", sheet: "Schedule_22W" },
  })),
);

const baselineStandings: StandingRow[] = matches.flatMap((match) =>
  [match.wrestlerA, match.wrestlerB].map((wrestler, index) => ({
    league: match.league,
    rank: match.matchNumber * 2 - 1 + index,
    wrestler,
    seed: match.matchNumber * 2 - 1 + index,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    status: "",
  })),
);

function results(): ConfirmedResult[] {
  return matches.map((match, index) => ({
    league: match.league,
    week: match.week,
    matchId: match.id,
    wrestlerA: match.wrestlerA,
    wrestlerB: match.wrestlerB,
    resultType: index === 0 ? "No Contest" : "Winner",
    winner: index === 0 ? null : match.wrestlerA,
    source: match.league === "National League" ? "Manual" : "Simulation",
    confirmedAt: "2026-06-13T10:00:00.000Z",
  }));
}

function lockedState() {
  const ready = { ...createEmptyTrackerState(), confirmedResults: results() };
  const locked = completeWeek(
    ready,
    14,
    matches,
    "National League",
    "2026-06-13T11:00:00.000Z",
  );
  if (!locked.ok) throw new Error(locked.errors.join("\n"));
  return locked.state;
}

describe("weekly close exports", () => {
  it("creates a package only for a locked complete week with source counts", () => {
    const exports = createWeeklyCloseExports(
      lockedState(),
      matches,
      baselineStandings,
      "National League",
      13,
      "2026-06-13T12:00:00.000Z",
    );

    expect(exports.ok).toBe(true);
    if (!exports.ok) return;
    expect(exports.package).toMatchObject({
      version: 1,
      week: 14,
      completedAt: "2026-06-13T11:00:00.000Z",
      exportedAt: "2026-06-13T12:00:00.000Z",
      workbookCompletedThroughWeek: 13,
      latestLockedWeek: 14,
      latestLockedCompletedAt: "2026-06-13T11:00:00.000Z",
      validation: {
        exportable: true,
        status: "locked",
        scheduled: 24,
        confirmed: 24,
        missing: 0,
        manual: 6,
        simulation: 18,
        errors: [],
      },
      safety: {
        excelModified: false,
        source: "workbook baseline + browser-local tracker state",
        notice: "Excel workbook was not modified by this export.",
      },
      summary: { scheduled: 24, confirmed: 24, manual: 6, simulation: 18 },
    });
    expect(JSON.parse(exports.packageJson)).toMatchObject({
      workbookCompletedThroughWeek: 13,
      latestLockedWeek: 14,
      validation: { exportable: true, missing: 0 },
      safety: { excelModified: false },
    });
    expect(exports.package.results).toHaveLength(24);
  });

  it("explains why exports are unavailable for incomplete or unlocked state", () => {
    const incomplete = {
      ...createEmptyTrackerState(),
      confirmedResults: results().slice(0, 23),
      completedWeeks: [{ week: 14, completedAt: "2026-06-13T11:00:00.000Z" }],
    };
    const unlocked = {
      ...createEmptyTrackerState(),
      confirmedResults: results(),
    };

    expect(
      createWeeklyCloseExports(incomplete, matches, baselineStandings, "National League", 13),
    ).toMatchObject({
      ok: false,
      reason: "Locked Week 14 is not complete and valid, so safe exports are unavailable.",
      validation: {
        exportable: false,
        status: "locked",
        scheduled: 24,
        confirmed: 23,
        missing: 1,
      },
    });
    const incompleteExport = createWeeklyCloseExports(
      incomplete,
      matches,
      baselineStandings,
      "National League",
      13,
    );
    expect(incompleteExport.ok).toBe(false);
    if (incompleteExport.ok) return;
    expect(incompleteExport.validation.errors).toContain(
      "14-3-5: confirmed result is missing.",
    );

    expect(
      createWeeklyCloseExports(unlocked, matches, baselineStandings, "National League", 13),
    ).toMatchObject({
      ok: false,
      reason: "Complete and lock a week before downloading the weekly close exports.",
      validation: {
        exportable: false,
        status: "complete-unlocked",
        scheduled: 24,
        confirmed: 24,
        missing: 0,
        errors: ["Week 14 is not locked."],
      },
    });
  });

  it("writes escaped results and app-state standings CSV output", () => {
    const exports = createWeeklyCloseExports(
      lockedState(),
      matches,
      baselineStandings,
      "National League",
      13,
    );

    expect(exports.ok).toBe(true);
    if (!exports.ok) return;
    expect(exports.resultsCsv).toContain(
      '"Global League, Wrestler A0","Global League Wrestler ""B0""",No Contest,,Simulation',
    );
    expect(exports.standingsCsv.split("\r\n")[0]).toBe(
      "league,rank,wrestler,seed,matches,wins,draws,losses,points,status",
    );

    const noContestRows = exports.package.standings.filter(
      (row) =>
        row.wrestler === matches[0].wrestlerA || row.wrestler === matches[0].wrestlerB,
    );
    expect(noContestRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ matches: 0, wins: 0, draws: 0, losses: 0, points: 0 }),
        expect.objectContaining({ matches: 0, wins: 0, draws: 0, losses: 0, points: 0 }),
      ]),
    );
  });

  it("does not mutate state, matches, or baseline standings", () => {
    const state = lockedState();
    const stateBefore = structuredClone(state);
    const matchesBefore = structuredClone(matches);
    const standingsBefore = structuredClone(baselineStandings);

    createWeeklyCloseExports(state, matches, baselineStandings, "National League", 13);

    expect(state).toEqual(stateBefore);
    expect(matches).toEqual(matchesBefore);
    expect(baselineStandings).toEqual(standingsBefore);
  });
});
