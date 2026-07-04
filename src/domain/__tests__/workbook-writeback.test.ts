import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import type { ConfirmedResult } from "../tracker-state";
import type { WeeklyClosePackage } from "../weekly-close-exports";
import {
  createWorkbookWriteback,
  LOG_SHEET,
  RESULTS_SHEET,
  STANDINGS_SHEET,
  ACCEPTED_SCHEDULE_SHEET,
} from "../workbook-writeback";
import { acceptedScheduleMatches, createAcceptedScheduleSnapshot, generateSchedule, validateSchedule } from "../schedule-setup";
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


const closingSeeds = Object.fromEntries(leagues.map((league) => [
  league,
  Array.from({ length: 12 }, (_, index) => ({ seed: index + 1, wrestler: `${league} Wrestler ${index + 1}` })),
])) as Record<LeagueName, Array<{ seed: number; wrestler: string }>>;
const closingPreview = generateSchedule({ leagueYear: 2, split: "Closing Split", yearWeekStart: 25, seeds: closingSeeds, generatedAt: "2026-06-14T00:00:00.000Z" });
const closingValidation = validateSchedule(closingPreview, { rosters: Object.fromEntries(leagues.map((league) => [league, closingSeeds[league].map((seed) => seed.wrestler)])) as Record<LeagueName, string[]> });
const acceptedClosingSchedule = createAcceptedScheduleSnapshot({ preview: closingPreview, validation: closingValidation, acceptedAt: "2026-06-14T01:00:00.000Z", leagueYear: 2, split: "Closing Split" });
const closingMatches = acceptedScheduleMatches(acceptedClosingSchedule);
const closingWeek25Results: ConfirmedResult[] = closingMatches.filter((match) => match.week === 25).map((match) => ({
  league: match.league,
  week: 25,
  matchId: match.id,
  wrestlerA: match.wrestlerA,
  wrestlerB: match.wrestlerB,
  resultType: "Winner",
  winner: match.wrestlerA,
  source: "Simulation",
  confirmedAt: "2026-06-15T10:00:00.000Z",
}));
const closingStandings: StandingRow[] = leagues.flatMap((league) => closingSeeds[league].map((seed, index) => ({
  league,
  rank: index + 1,
  wrestler: seed.wrestler,
  seed: seed.seed,
  matches: index < 12 ? 1 : 0,
  wins: index % 2 === 0 ? 1 : 0,
  draws: 0,
  losses: index % 2 === 1 ? 1 : 0,
  points: index % 2 === 0 ? 3 : 0,
  status: "active split reset",
})));

function closingClosePackage(): WeeklyClosePackage {
  const pkg = closePackage();
  return {
    ...pkg,
    exportedAt: "2026-06-15T12:00:00.000Z",
    week: 25,
    completedAt: "2026-06-15T11:00:00.000Z",
    workbookCompletedThroughWeek: 24,
    latestLockedWeek: 25,
    latestLockedCompletedAt: "2026-06-15T11:00:00.000Z",
    safety: { ...pkg.safety, source: "source.xlsx" },
    results: structuredClone(closingWeek25Results),
    standings: structuredClone(closingStandings),
    acceptedSchedule: structuredClone(acceptedClosingSchedule),
    scheduleAuthority: { source: "accepted generated snapshot", closingSplitAccepted: true, closingSplitWrittenToWorkbook: false },
  };
}

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

function contextDashboardWorkbook(): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const dashboard = XLSX.utils.aoa_to_sheet([
    ["WWE 2K26 Liga-System", "League Year 2 \u2013 Opening Split"],
    ["Aktueller Stand", "Woche 13 abgeschlossen"],
    ["Ligaphase", "Opening Split Woche 13 abgeschlossen"],
    ["Dateistand", "LY2 Opening Split Week 13 abgeschlossen"],
  ]);
  dashboard.B1.s = { fill: { patternType: "solid", fgColor: { rgb: "FF112233" } } };
  XLSX.utils.book_append_sheet(workbook, dashboard, "Dashboard");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx", cellStyles: true });
}

function legacyFallbackWorkbook(): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const dashboard = XLSX.utils.aoa_to_sheet([
    ["WWE 2K26 Liga-System", "League Year 2 \u2013 Opening Split"],
    ["Aktueller Stand", "Woche 13 abgeschlossen"],
    ["Ligaphase", "Opening Split Woche 13 abgeschlossen"],
    ["Next User-Show", "National League \u2013 Opening Split Woche 14"],
    ["Dateistand", "LY2 Opening Split Week 13 abgeschlossen"],
    ["Authoritative next-match source", "National League \u2013 Opening Split Woche 14"],
  ]);
  dashboard.B1.s = { fill: { patternType: "solid", fgColor: { rgb: "FF112233" } } };
  XLSX.utils.book_append_sheet(workbook, dashboard, "Dashboard");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["League Year", "Split", "Week", "Round Type", "League", "Show Day", "Match #", "Wrestler A", "Wrestler B", "Winner", "Result Type", "Notes"],
    ["League Year 2", "Opening Split", 1, "Hinrunde", "Global League", "Freitag", 1, "Old A", "Old B", "Old A", "Simulation", "Opening result"],
  ]), "Schedule_22W");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["League", "Rank", "Wrestler", "Seed", "Matches", "Wins", "Draws", "Losses", "Points", "Status / Zone"],
    ["Global League", 1, "Old A", 1, 13, 13, 0, 0, 39, "Opening"],
  ]), "Standings_Current");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx", cellStyles: true });
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

  it("synchronizes existing Dashboard context cells without changing its structure or style", () => {
    const result = createWorkbookWriteback(
      { workbook: contextDashboardWorkbook(), sourceFile: "source.xlsx", schedule },
      closePackage(),
      "2026-06-13T13:00:00.000Z",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const workbook = XLSX.read(result.workbook, { type: "array", cellStyles: true });
    expect(workbook.SheetNames).toEqual(expect.arrayContaining(["Dashboard", RESULTS_SHEET, STANDINGS_SHEET, LOG_SHEET]));
    const dashboardRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Dashboard, { header: 1, raw: true });
    expect(String(dashboardRows[0][1])).toContain("League Year 2");
    expect(String(dashboardRows[0][1])).toContain("Opening Split");
    expect(dashboardRows.slice(1)).toEqual([
      ["Aktueller Stand", "Woche 14 abgeschlossen"],
      ["Ligaphase", "Opening Split Woche 14 abgeschlossen"],
      ["Dateistand", "LY2 Opening Split Week 14 abgeschlossen"],
    ]);
    expect(workbook.Sheets.Dashboard.B1.s).toBeTruthy();
  });

  it("writes the accepted Closing Split schedule snapshot for Year Weeks 25-46", () => {
    expect(closingMatches.filter((match) => match.week === 25)).toHaveLength(24);
    const result = createWorkbookWriteback(
      { workbook: baselineWorkbook(), sourceFile: "source.xlsx", schedule },
      closingClosePackage(),
      "2026-06-15T13:00:00.000Z",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.sheets).toContain(ACCEPTED_SCHEDULE_SHEET);
    const workbook = XLSX.read(result.workbook, { type: "array" });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[ACCEPTED_SCHEDULE_SHEET]);
    expect(rows).toHaveLength(528);
    expect(rows.filter((row) => row.yearWeek === 25)).toHaveLength(24);
    for (const league of leagues) expect(rows.filter((row) => row.yearWeek === 25 && row.league === league)).toHaveLength(6);
    expect(rows[0]).toMatchObject({ split: "Closing Split", leagueYear: 2, scheduleSource: "accepted generated snapshot" });
    expect(new Set(rows.filter((row) => row.yearWeek === 25).map((row) => row.matchId))).toEqual(new Set(closingWeek25Results.map((result) => result.matchId)));
    expect(result.filename).toBe("WWE_2K26_Liga_System_LY2_Closing_W25_abgeschlossen.xlsx");
  });

  it("synchronizes existing legacy fallback sheets from the coherent Closing checkpoint", () => {
    const result = createWorkbookWriteback(
      { workbook: legacyFallbackWorkbook(), sourceFile: "source.xlsx", schedule },
      closingClosePackage(),
      "2026-06-15T13:00:00.000Z",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const workbook = XLSX.read(result.workbook, { type: "array", cellStyles: true });
    const dashboardRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Dashboard, { header: 1, raw: true });
    expect(dashboardRows[0]).toEqual(["WWE 2K26 Liga-System", expect.stringMatching(/League Year 2.+Closing Split/)]);
    expect(dashboardRows[1]).toEqual(["Aktueller Stand", "Woche 25 abgeschlossen"]);
    expect(dashboardRows[2]).toEqual(["Ligaphase", "Closing Split Woche 1 abgeschlossen"]);
    expect(dashboardRows[3]).toEqual(["Next User-Show", expect.stringMatching(/National League.+Closing Split Woche 2/)]);
    expect(dashboardRows[4]).toEqual(["Dateistand", "LY2 Closing Split Week 1 abgeschlossen"]);
    expect(dashboardRows[5]).toEqual(["Authoritative next-match source", expect.stringMatching(/National League.+Closing Split Woche 2/)]);
    expect(workbook.Sheets.Dashboard.B1.s).toBeTruthy();

    const fallbackSchedule = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.Schedule_22W);
    expect(fallbackSchedule).toHaveLength(528);
    expect(new Set(fallbackSchedule.map((row) => row.Split))).toEqual(new Set(["Closing Split"]));
    expect(fallbackSchedule.filter((row) => row.Week === 25)).toHaveLength(24);
    expect(fallbackSchedule.filter((row) => row.Week === 25 && row.Winner)).toHaveLength(24);
    expect(fallbackSchedule.filter((row) => row.Week === 26 && row.Winner)).toHaveLength(0);

    const fallbackStandings = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.Standings_Current);
    expect(fallbackStandings).toHaveLength(48);
    expect(fallbackStandings[0]).toMatchObject({
      League: closingStandings[0].league,
      Wrestler: closingStandings[0].wrestler,
      Matches: 1,
    });
  });

  it("rejects Closing Split writeback when no accepted schedule exists or result ids do not match", () => {
    const missing = closingClosePackage();
    delete missing.acceptedSchedule;
    expect(createWorkbookWriteback({ workbook: baselineWorkbook(), sourceFile: "source.xlsx", schedule }, missing)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(["Accepted Closing Split schedule could not be written to workbook: no accepted Closing Split schedule snapshot was supplied."]),
    });

    const mismatch = closingClosePackage();
    mismatch.results[0].matchId = "not-authoritative";
    expect(createWorkbookWriteback({ workbook: baselineWorkbook(), sourceFile: "source.xlsx", schedule }, mismatch)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(["not-authoritative: match is not in the authoritative Week 25 schedule."]),
    });
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
