import { describe, expect, it } from "vitest";
import {
  calculateActiveSplitStandingsWithConfirmedResults,
  calculateStandingsWithConfirmedResults,
  completeWeek,
  confirmResult,
  createEmptyTrackerState,
  exportTrackerState,
  importTrackerState,
  removeResult,
  reconstructActiveSplitLiveStandings,
  resetTrackerState,
  type ConfirmedResult,
} from "../tracker-state";
import { LEAGUE_NAMES, type LeagueName, type Match, type StandingRow } from "../types";
import type { PostFinalsAssignment } from "../post-finals-transition";

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

describe("Phase 10.8.6 post-finals active live standings reconstruction", () => {
  function previousFinalStandings(): StandingRow[] {
    return LEAGUE_NAMES.flatMap((league) => Array.from({ length: 12 }, (_, index) => ({
      league,
      rank: index + 1,
      wrestler: `${league} ${index + 1}`,
      seed: index + 1,
      matches: 22,
      wins: 12 - index,
      draws: 0,
      losses: 10 + index,
      points: (12 - index) * 3,
      status: "Week 24 final",
    })));
  }

  function assignmentsFromFinals(rows: StandingRow[]): PostFinalsAssignment[] {
    return rows.map((row): PostFinalsAssignment => {
      let newLeague = row.league;
      let movement: PostFinalsAssignment["movement"] = "Retained lower league";
      if (row.wrestler === "National League 1") {
        newLeague = "Continental League";
        movement = "Champion/direct promotion";
      } else if (row.wrestler === "Continental League 12") {
        newLeague = "National League";
        movement = "Direct relegation";
      } else if (row.wrestler === "Global League 11") {
        newLeague = "Continental League";
        movement = "Relegated";
      } else if (row.wrestler === "Continental League 2") {
        newLeague = "Global League";
        movement = "Promoted";
      } else if (row.wrestler === "National League 3") {
        newLeague = "Continental League";
        movement = "Promoted";
      } else if (row.wrestler === "Continental League 10") {
        newLeague = "National League";
        movement = "Relegated";
      }
      return { wrestler: row.wrestler, priorLeague: row.league, priorRank: row.rank, newLeague, movement, finalsOutcome: movement };
    });
  }

  function closingSchedule(composition: PostFinalsAssignment[]): Match[] {
    return LEAGUE_NAMES.flatMap((league) => {
      const wrestlers = composition.filter((row) => row.newLeague === league).map((row) => row.wrestler);
      return Array.from({ length: 5 }, (_, weekIndex) => Array.from({ length: 6 }, (__, matchIndex): Match => ({
        id: `schedule-y2-closing-split-${league.toLowerCase().replaceAll(" ", "-")}-w${String(weekIndex + 1).padStart(2, "0")}-m${matchIndex + 1}`,
        leagueYear: 2,
        split: "Closing Split",
        week: 25 + weekIndex,
        roundType: "Hinrunde",
        league,
        showDay: league === "Global League" ? "Freitag" : league === "Continental League" ? "Mittwoch" : league === "National League" ? "Dienstag" : "Montag",
        matchNumber: matchIndex + 1,
        wrestlerA: wrestlers[matchIndex * 2],
        wrestlerB: wrestlers[matchIndex * 2 + 1],
        matchupKey: `${wrestlers[matchIndex * 2]} vs ${wrestlers[matchIndex * 2 + 1]}`,
        status: "scheduled",
        source: { file: "accepted.json", sheet: "Accepted_Schedule" },
      }))).flat();
    });
  }

  it("derives moved and retained wrestlers from post-finals assignments, then applies Weeks 1-5 locked Closing Split results", () => {
    const previous = previousFinalStandings();
    const assignments = assignmentsFromFinals(previous);
    const schedule = closingSchedule(assignments);
    const results = schedule.map((scheduled) => result(scheduled, {
      matchId: scheduled.week === 25 ? `local-prefix-${scheduled.id}` : scheduled.id,
      week: scheduled.week,
      league: scheduled.league,
      wrestlerA: scheduled.wrestlerA,
      wrestlerB: scheduled.wrestlerB,
      winner: scheduled.wrestlerA,
    }));

    const live = reconstructActiveSplitLiveStandings({
      previousFinalStandings: previous,
      postFinalsAssignments: assignments,
      scheduledMatches: schedule,
      masterResults: [],
      localResults: results,
      split: "Closing Split",
      completedThroughWeek: 29,
    });

    expect(live.standings.find((row) => row.wrestler === "National League 1")).toMatchObject({ league: "Continental League", matches: 5, wins: 5, points: 15 });
    expect(live.standings.find((row) => row.wrestler === "Global League 11")).toMatchObject({ league: "Continental League" });
    expect(live.standings.find((row) => row.wrestler === "National League 3")).toMatchObject({ league: "Continental League" });
    expect(live.standings.find((row) => row.wrestler === "Continental League 10")).toMatchObject({ league: "National League" });
    expect(live.standings.find((row) => row.wrestler === "National League 1")?.league).not.toBe("National League");
    for (const league of LEAGUE_NAMES) expect(live.composition.filter((row) => row.league === league)).toHaveLength(12);
    expect(new Set(live.composition.map((row) => row.wrestler.toLowerCase())).size).toBe(48);
    expect(Math.max(...live.standings.map((row) => row.matches))).toBe(5);
    expect(Math.max(...live.standings.map((row) => row.points))).toBe(15);
    expect(live.standings.some((row) => row.matches === 22 || row.points > 15)).toBe(false);
    expect(live.diagnostics.some((diagnostic) => diagnostic.includes("Result ID mismatch reconciled by participants/week/league"))).toBe(true);
  });

  it("diagnoses missing active split weeks instead of inventing fake results", () => {
    const previous = previousFinalStandings();
    const assignments = assignmentsFromFinals(previous);
    const schedule = closingSchedule(assignments);
    const weekOneResults = schedule.filter((scheduled) => scheduled.week === 25).map((scheduled) => result(scheduled, { week: scheduled.week }));

    const live = reconstructActiveSplitLiveStandings({
      previousFinalStandings: previous,
      postFinalsAssignments: assignments,
      scheduledMatches: schedule,
      masterResults: [],
      localResults: weekOneResults,
      split: "Closing Split",
      completedThroughWeek: 29,
    });

    expect(Math.max(...live.standings.map((row) => row.matches))).toBe(1);
    expect(live.diagnostics).toContain("Only 1 locked Closing Split week found, but UI claims Week 5.");
    expect(live.diagnostics).toContain("Closing Split Week 3 results missing from local/master state.");
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

describe("Phase 10.8 active split standings", () => {
  it("resets Closing Split standings to zero before Week 25 results", () => {
    const scheduled = { ...match("National League", 1, 25), split: "Closing Split" as const, wrestlerA: "Closer A", wrestlerB: "Closer B" };
    const baseline: StandingRow[] = [
      { league: "National League", rank: 1, wrestler: "Closer A", seed: 1, matches: 22, wins: 22, draws: 0, losses: 0, points: 66, status: "Opening Split final" },
      { league: "National League", rank: 2, wrestler: "Closer B", seed: 2, matches: 22, wins: 21, draws: 0, losses: 1, points: 63, status: "Opening Split final" },
    ];

    const updated = calculateActiveSplitStandingsWithConfirmedResults(baseline, [scheduled], [], "Closing Split");

    expect(updated).toEqual(expect.arrayContaining([
      expect.objectContaining({ wrestler: "Closer A", matches: 0, wins: 0, draws: 0, losses: 0, points: 0 }),
      expect.objectContaining({ wrestler: "Closer B", matches: 0, wins: 0, draws: 0, losses: 0, points: 0 }),
    ]));
  });

  it("keeps Closing Split Week 1 max points at 3 and excludes Opening Split points", () => {
    const closing = { ...match("National League", 1, 25), split: "Closing Split" as const, wrestlerA: "Closer A", wrestlerB: "Closer B" };
    const opening = { ...match("National League", 1, 24), split: "Opening Split" as const, wrestlerA: "Closer A", wrestlerB: "Closer B" };
    const baseline: StandingRow[] = [
      { league: "National League", rank: 1, wrestler: "Closer A", seed: 1, matches: 22, wins: 22, draws: 0, losses: 0, points: 66, status: "Opening Split final" },
      { league: "National League", rank: 2, wrestler: "Closer B", seed: 2, matches: 22, wins: 21, draws: 0, losses: 1, points: 63, status: "Opening Split final" },
    ];

    const updated = calculateActiveSplitStandingsWithConfirmedResults(
      baseline,
      [opening, closing],
      [result(opening), result(closing)],
      "Closing Split",
    );

    expect(Math.max(...updated.map((row) => row.points))).toBe(3);
    expect(updated.find((row) => row.wrestler === "Closer A")).toMatchObject({ matches: 1, wins: 1, points: 3 });
    expect(updated.find((row) => row.wrestler === "Closer B")).toMatchObject({ matches: 1, losses: 1, points: 0 });
  });

  it("leaves historical Opening Split standings projection available for seed/order logic", () => {
    const scheduled = match("National League");
    const baseline: StandingRow[] = [
      { league: "National League", rank: 1, wrestler: scheduled.wrestlerA, seed: 1, matches: 22, wins: 22, draws: 0, losses: 0, points: 66, status: "Opening Split final" },
      { league: "National League", rank: 2, wrestler: scheduled.wrestlerB, seed: 2, matches: 22, wins: 21, draws: 0, losses: 1, points: 63, status: "Opening Split final" },
    ];

    const historical = calculateStandingsWithConfirmedResults(baseline, [scheduled], []);

    expect(historical.find((row) => row.wrestler === scheduled.wrestlerA)).toMatchObject({ points: 66, matches: 22 });
  });
});

describe("Phase 10.8.5 live active split result source", () => {
  function closingMatch(week: number, index = 1): Match {
    return { ...match("Global League", index, week), id: `closing-${week}-${index}`, split: "Closing Split", wrestlerA: `Wrestler ${index}A`, wrestlerB: `Wrestler ${index}B` };
  }

  const baseline: StandingRow[] = Array.from({ length: 12 }, (_, index) => ({
    league: "Global League" as const,
    rank: index + 1,
    wrestler: `Wrestler ${Math.floor(index / 2) + 1}${index % 2 === 0 ? "A" : "B"}`,
    seed: index + 1,
    matches: 13,
    wins: 13,
    draws: 0,
    losses: 0,
    points: 39,
    status: "legacy aggregate",
  }));

  it("Closing Split Week 5 live standings include only Year Weeks 25-29 and exclude Opening Split, prior split, and legacy totals", async () => {
    const { calculateLiveStandingsFromCurrentMaster, activeSplitResultWeekRange, validateActiveSplitStandings } = await import("../tracker-state");
    const closing = Array.from({ length: 5 }, (_, index) => closingMatch(25 + index, index + 1));
    const opening = { ...closingMatch(5, 1), split: "Opening Split" as const, id: "opening-old" };
    const ignoredFuture = closingMatch(30, 6);
    const resultRows = [...closing, opening, ignoredFuture].map((scheduled) => ({
      matchId: scheduled.id,
      outcome: "decisive" as const,
      winner: scheduled.wrestlerA,
      loser: scheduled.wrestlerB,
      resultSource: "User" as const,
      notes: null,
      source: { file: "test.xlsx", sheet: "Schedule_22W" },
    }));

    const standings = calculateLiveStandingsFromCurrentMaster(baseline, [...closing, opening, ignoredFuture], [], "Closing Split", 29, resultRows);

    expect(activeSplitResultWeekRange("Closing Split", 29)).toEqual([25, 26, 27, 28, 29]);
    expect(Math.max(...standings.map((row) => row.matches))).toBe(1);
    expect(Math.max(...standings.map((row) => row.points))).toBe(3);
    expect(standings.find((row) => row.wrestler === "Wrestler 6A")?.matches).toBe(0);
    expect(standings.some((row) => row.matches === 13 || row.points === 39)).toBe(false);
    expect(validateActiveSplitStandings(standings, 5)).toEqual([]);
    for (const row of standings) {
      expect(row.wins + row.draws + row.losses).toBe(row.matches);
      expect(row.points).toBe(row.wins * 3 + row.draws);
    }
  });

  it("diagnoses impossible Week 5 active split values before rendering them as valid", async () => {
    const { validateActiveSplitStandings } = await import("../tracker-state");
    expect(validateActiveSplitStandings(baseline, 5)).toContain("Active split standings source is invalid: Wrestler 1A has 13 matches in split week 5.");
    expect(validateActiveSplitStandings(baseline, 5)).toContain("Active split standings source is invalid: Wrestler 1A has 39 points in split week 5.");
  });
});
