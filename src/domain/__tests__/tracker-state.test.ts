import { describe, expect, it } from "vitest";
import {
  calculateStandingsWithConfirmedResults,
  completeWeek,
  confirmResult,
  createEmptyTrackerState,
  exportTrackerState,
  importTrackerState,
  removeResult,
  resetTrackerState,
  type ConfirmedResult,
} from "../tracker-state";
import type { LeagueName, Match, StandingRow } from "../types";

const leagueNames: LeagueName[] = ["Regional League", "National League", "Continental League", "Global League"];

function match(league: LeagueName, matchNumber = 1, week = 14): Match {
  const prefix = league.split(" ")[0];
  return {
    id: `${prefix}-${week}-${matchNumber}`,
    leagueYear: 2,
    split: "Opening Split",
    week,
    roundType: "Rückrunde",
    league,
    showDay: league === "Regional League" ? "Montag" : league === "National League" ? "Dienstag" : league === "Continental League" ? "Mittwoch" : "Freitag",
    matchNumber,
    wrestlerA: `${prefix} A${matchNumber}`,
    wrestlerB: `${prefix} B${matchNumber}`,
    matchupKey: `${prefix} A${matchNumber} vs ${prefix} B${matchNumber}`,
    status: "scheduled",
    source: { file: "test.xlsx", sheet: "Schedule_22W" },
  };
}

function result(source: Match, overrides: Partial<ConfirmedResult> = {}): ConfirmedResult {
  return {
    league: source.league,
    week: source.week,
    matchId: source.id,
    wrestlerA: source.wrestlerA,
    wrestlerB: source.wrestlerB,
    resultType: "Winner",
    winner: source.wrestlerA,
    source: source.league === "National League" ? "Manual" : "Simulation",
    confirmedAt: "2026-06-12T00:00:00.000Z",
    ...overrides,
  };
}

function fullWeek(): Match[] {
  return leagueNames.flatMap((league) => Array.from({ length: 6 }, (_, index) => match(league, index + 1)));
}

describe("confirmed result management", () => {
  it("confirms a valid manual result", () => {
    const scheduled = match("National League");
    const action = confirmResult(createEmptyTrackerState(), result(scheduled), [scheduled], "National League");
    expect(action.ok).toBe(true);
    expect(action.state.confirmedResults).toHaveLength(1);
    expect(action.state.confirmedResults[0].source).toBe("Manual");
  });

  it("rejects an invalid manual result", () => {
    const scheduled = match("National League");
    const action = confirmResult(createEmptyTrackerState(), result(scheduled, { winner: "Outsider" }), [scheduled], "National League");
    expect(action.ok).toBe(false);
    expect(action.errors.join(" ")).toContain("winner must be one of the scheduled wrestlers");
  });

  it("confirms valid simulation results", () => {
    const scheduled = match("Global League");
    const action = confirmResult(createEmptyTrackerState(), result(scheduled), [scheduled], "National League");
    expect(action.ok).toBe(true);
    expect(action.state.confirmedResults[0].source).toBe("Simulation");
  });

  it("rejects simulation for the user-controlled league", () => {
    const scheduled = match("National League");
    const action = confirmResult(createEmptyTrackerState(), result(scheduled, { source: "Simulation" }), [scheduled], "National League");
    expect(action.ok).toBe(false);
    expect(action.errors.join(" ")).toContain("cannot be simulated");
  });

  it("rejects duplicate confirmed results", () => {
    const scheduled = match("National League");
    const first = confirmResult(createEmptyTrackerState(), result(scheduled), [scheduled], "National League");
    const duplicate = confirmResult(first.state, result(scheduled), [scheduled], "National League");
    expect(duplicate.ok).toBe(false);
    expect(duplicate.errors.join(" ")).toContain("duplicate confirmed result");
  });
});

describe("week completion and locking", () => {
  it("blocks week completion when results are missing", () => {
    const matches = fullWeek();
    const action = completeWeek(createEmptyTrackerState(), 14, matches, "National League");
    expect(action.ok).toBe(false);
    expect(action.errors.some((error) => error.includes("confirmed result is missing"))).toBe(true);
  });

  it("allows week completion when all 24 results are valid", () => {
    const matches = fullWeek();
    const state = { ...createEmptyTrackerState(), confirmedResults: matches.map((scheduled) => result(scheduled)) };
    const action = completeWeek(state, 14, matches, "National League", "2026-06-12T01:00:00.000Z");
    expect(action.ok).toBe(true);
    expect(action.state.completedWeeks).toEqual([{ week: 14, completedAt: "2026-06-12T01:00:00.000Z" }]);
  });

  it("prevents edits to a locked week", () => {
    const scheduled = match("National League");
    const state = { ...createEmptyTrackerState(), confirmedResults: [result(scheduled)], completedWeeks: [{ week: 14, completedAt: "2026-06-12T01:00:00.000Z" }] };
    const action = removeResult(state, scheduled.id);
    expect(action.ok).toBe(false);
    expect(action.errors.join(" ")).toContain("locked");
  });
});

describe("standings and state portability", () => {
  it("updates standings from confirmed results over the workbook baseline", () => {
    const scheduled = match("National League");
    const baseline: StandingRow[] = [
      { league: "National League", rank: 1, wrestler: scheduled.wrestlerA, seed: 1, matches: 13, wins: 8, draws: 0, losses: 5, points: 24, status: "source" },
      { league: "National League", rank: 2, wrestler: scheduled.wrestlerB, seed: 2, matches: 13, wins: 7, draws: 0, losses: 6, points: 21, status: "source" },
    ];
    const updated = calculateStandingsWithConfirmedResults(baseline, [scheduled], [result(scheduled)]);
    expect(updated.find((row) => row.wrestler === scheduled.wrestlerA)).toMatchObject({ matches: 14, wins: 9, points: 27 });
    expect(updated.find((row) => row.wrestler === scheduled.wrestlerB)).toMatchObject({ matches: 14, losses: 7, points: 21 });
  });

  it("roundtrips tracker state through JSON export/import", () => {
    const scheduled = match("National League");
    const original = { ...createEmptyTrackerState(), confirmedResults: [result(scheduled)] };
    const exported = exportTrackerState(original, "2026-06-12T02:00:00.000Z");
    const imported = importTrackerState(exported.json, [scheduled], "National League", "2026-06-12T03:00:00.000Z");
    expect(imported.ok).toBe(true);
    expect(imported.state.confirmedResults).toEqual(original.confirmedResults);
    expect(imported.state.lastExportedAt).toBe("2026-06-12T02:00:00.000Z");
    expect(imported.state.lastImportedAt).toBe("2026-06-12T03:00:00.000Z");
  });

  it("preserves an accepted schedule snapshot through state rehydration", () => {
    const original = {
      ...createEmptyTrackerState(),
      acceptedSchedule: {
        matches: [],
        acceptedAt: "2026-06-14T12:00:00.000Z",
        acceptedBy: "local user workflow" as const,
        source: "Generated" as const,
        leagueYear: 2,
        split: "Closing Split" as const,
        seedSource: "Phase 9.5 continuity seeds",
        rosterSource: "Phase 9B post-finals composition",
        generatorVersion: "1.0.0",
        validation: { valid: true, status: "Valid" as const, errors: [], warnings: [], totalMatches: 528 },
      },
    };

    const stored = JSON.stringify(original);
    const rehydrated = JSON.parse(stored);
    expect(rehydrated.acceptedSchedule).toEqual(original.acceptedSchedule);

    const imported = importTrackerState(stored, [], "National League", "2026-06-14T13:00:00.000Z");
    expect(imported.ok).toBe(true);
    expect(imported.state.acceptedSchedule).toEqual(original.acceptedSchedule);
  });

  it("resets local tracker state", () => {
    expect(resetTrackerState()).toEqual(createEmptyTrackerState());
  });
});
