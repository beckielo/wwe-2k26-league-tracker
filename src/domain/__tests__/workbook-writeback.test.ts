import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import type { ConfirmedResult } from "../tracker-state";
import type { WeeklyClosePackage } from "../weekly-close-exports";
import {
  createWorkbookWriteback,
  LOG_SHEET,
  RESULTS_SHEET,
  STANDINGS_SHEET,
} from "../workbook-writeback";
import type { LeagueName, Match, StandingRow } from "../types";

const leagues: LeagueName[] = ["Global League", "Continental League", "National League", "Regional League"];
const schedule: Match[] = leagues.flatMap((league, leagueIndex) =>
  Array.from({ length: 6 }, (_, index) => ({
    id: `global-${leagueIndex}-${index}`,
    leagueYear: 2,
    split: "Opening Split",
    week: 14,
    roundType: "Rückrunde",
    league,
    showDay: "Montag",
    matchNumber: index + 1,
    wrestlerA: `${league} A${index}`,
    wrestlerB: `${league} B${index}`,
    matchupKey: `${league}-${index}`,
    status: "scheduled",
    source: { file: "source.xlsx", sheet: "Schedule_22W", row: index + 2 },
  })),
);
const results: ConfirmedResult[] = schedule.map((match) => ({
  league: match.league,
  week: 14,
  matchId: match.id,
  wrestlerA: match.wrestlerA,
  wrestlerB: match.wrestlerB,
  resultType: "Winner",
  winner: match.wrestlerA,
  source: match.league === "National League" ? "Manual" : "Simulation",
  confirmedAt: "2026-06-13T10:00:00.000Z",
}));
const standings: StandingRow[] = schedule.flatMap((match) =>
  [match.wrestlerA, match.wrestlerB].map((wrestler, index) => ({
    league: match.league,
    rank: match.matchNumber * 2 - 1 + index,
    wrestler,
    seed: match.matchNumber * 2 - 1 + index,
    matches: 1,
    wins: index === 0 ? 1 : 0,
    draws: 0,
    losses: index,
    points: index === 0 ? 3 : 0,
    status: "",
  })),
);

function closePackage(): WeeklyClosePackage {
  return {
    version: 1,
    exportedAt: "2026-06-13T12:00:00.000Z",
    week: 14,
    completedAt: "2026-06-13T11:00:00.000Z",
    workbookCompletedThroughWeek: 13,
    latestLockedWeek: 14,
    latestLockedCompletedAt: "2026-06-13T11:00:00.000Z",
    validation: {
      exportable: true,
      status: "passed",
      scheduled: 24,
      confirmed: 24,
      missing: 0,
      manual: 6,
      simulation: 18,
      errors: [],
    },
    safety: { excelModified: false, source: "source.xlsx", notice: "Excel was not modified." },
    summary: { scheduled: 24, confirmed: 24, manual: 6, simulation: 18 },
    results: structuredClone(results),
    standings: structuredClone(standings),
  };
}

function baselineWorkbook(): Uint8Array {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Original"], ["preserved"]]), "Dashboard");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

function generate(pkg = closePackage()) {
  return createWorkbookWriteback(
    { workbook: baselineWorkbook(), sourceFile: "source.xlsx", schedule },
    pkg,
    "2026-06-13T13:00:00.000Z",
  );
}

describe("safe workbook writeback", () => {
  it("creates new output metadata and preserves the original sheet", () => {
    const result = generate();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filename).toBe("WWE_2K26_Liga_System_LY2_Opening_W14_abgeschlossen.xlsx");
    expect(result.metadata).toEqual({
      week: 14,
      resultCount: 24,
      standingsCount: 48,
      sheets: [RESULTS_SHEET, STANDINGS_SHEET, LOG_SHEET],
    });
    const workbook = XLSX.read(result.workbook, { type: "array" });
    expect(workbook.SheetNames).toContain("Dashboard");
  });

  it("rejects incomplete or unlocked close packages", () => {
    const incomplete = closePackage();
    incomplete.validation.confirmed = 23;
    incomplete.validation.missing = 1;
    incomplete.results.pop();
    expect(generate(incomplete)).toMatchObject({ ok: false });

    const unlocked = closePackage();
    unlocked.latestLockedWeek = 13;
    expect(generate(unlocked)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(["Week 14 is not the latest locked week in the close package."]),
    });
  });

  it("rejects unsafe, duplicate, and invalid winner packages", () => {
    const unsafe = closePackage();
    (unsafe.safety as { excelModified: boolean }).excelModified = true;
    expect(generate(unsafe)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(["Close package indicates that Excel was modified."]),
    });

    const duplicate = closePackage();
    duplicate.results[1].matchId = duplicate.results[0].matchId;
    expect(generate(duplicate)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([`${duplicate.results[0].matchId}: duplicate match ID.`]),
    });

    const invalidWinner = closePackage();
    invalidWinner.results[0].winner = "Not Scheduled";
    expect(generate(invalidWinner)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([`${invalidWinner.results[0].matchId}: winner must be one of the scheduled wrestlers.`]),
    });
  });

  it("writes all results, standings, and the safety log to App sheets", () => {
    const result = generate();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const workbook = XLSX.read(result.workbook, { type: "array" });
    expect(XLSX.utils.sheet_to_json(workbook.Sheets[RESULTS_SHEET])).toHaveLength(24);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets[STANDINGS_SHEET])).toHaveLength(48);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets[LOG_SHEET])).toEqual([
      expect.objectContaining({
        week: 14,
        manualCount: 6,
        simulationCount: 18,
        excelModified: false,
        originalWorkbookSource: "source.xlsx",
      }),
    ]);
  });

  it("does not mutate workbook baseline, schedule, or close package inputs", () => {
    const workbook = baselineWorkbook();
    const pkg = closePackage();
    const workbookBefore = workbook.slice();
    const scheduleBefore = structuredClone(schedule);
    const packageBefore = structuredClone(pkg);
    createWorkbookWriteback(
      { workbook, sourceFile: "source.xlsx", schedule },
      pkg,
      "2026-06-13T13:00:00.000Z",
    );
    expect(workbook).toEqual(workbookBefore);
    expect(schedule).toEqual(scheduleBefore);
    expect(pkg).toEqual(packageBefore);
  });
});
