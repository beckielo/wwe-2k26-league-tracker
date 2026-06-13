import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseAppWorkbookBaseline } from "../app-workbook-baseline";
import type { LeagueName, Match, StandingRow } from "../types";
import { LOG_SHEET, RESULTS_SHEET, STANDINGS_SHEET } from "../workbook-writeback";

const leagues: LeagueName[] = ["Global League", "Continental League", "National League", "Regional League"];
const standings: StandingRow[] = leagues.flatMap((league) =>
  Array.from({ length: 12 }, (_, index) => ({
    league,
    rank: index + 1,
    wrestler: `${league} Wrestler ${index + 1}`,
    seed: index + 1,
    matches: 1,
    wins: index < 6 ? 1 : 0,
    draws: 0,
    losses: index < 6 ? 0 : 1,
    points: index < 6 ? 3 : 0,
    status: "",
  })),
);
const schedule: Match[] = leagues.flatMap((league) =>
  Array.from({ length: 6 }, (_, index) => ({
    id: `${league.toLowerCase().replaceAll(" ", "-")}-14-${index + 1}`,
    leagueYear: 2,
    split: "Opening Split" as const,
    week: 14,
    roundType: "Rückrunde" as const,
    league,
    showDay: "Montag" as const,
    matchNumber: index + 1,
    wrestlerA: `${league} Wrestler ${index + 1}`,
    wrestlerB: `${league} Wrestler ${index + 7}`,
    matchupKey: `${league}-${index}`,
    status: "scheduled" as const,
    source: { file: "source.xlsx", sheet: "Schedule_22W" },
  })),
);

function workbookWithAppSheets(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
    week: 14,
    generatedAt: "2026-06-13T12:00:00.000Z",
    completedAt: "2026-06-13T11:00:00.000Z",
  }]), LOG_SHEET);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(standings), STANDINGS_SHEET);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(schedule.map((match) => ({
    league: match.league,
    week: match.week,
    matchNumber: match.matchNumber,
    matchId: match.id,
    wrestlerA: match.wrestlerA,
    wrestlerB: match.wrestlerB,
    resultType: "Winner",
    winner: match.wrestlerA,
    source: match.league === "National League" ? "Manual" : "Simulation",
    confirmedAt: "2026-06-13T10:00:00.000Z",
  }))), RESULTS_SHEET);
  return workbook;
}

describe("app workbook baseline parser", () => {
  it("leaves a workbook without App sheets unchanged", () => {
    const workbook = XLSX.utils.book_new();
    const result = parseAppWorkbookBaseline(workbook, schedule, standings);
    expect(result).toMatchObject({
      hasWritebackSheets: false,
      latestAppWritebackWeek: null,
      standings: null,
      confirmedResults: [],
      validationIssues: [],
    });
  });

  it("exposes the latest valid writeback and accepts the 48-row standings baseline", () => {
    const workbook = workbookWithAppSheets();
    XLSX.utils.sheet_add_json(workbook.Sheets[LOG_SHEET], [{
      week: 13,
      generatedAt: "2026-06-12T12:00:00.000Z",
      completedAt: "2026-06-12T11:00:00.000Z",
    }], { skipHeader: true, origin: -1 });
    const result = parseAppWorkbookBaseline(workbook, schedule, standings);
    expect(result.latestAppWritebackWeek).toBe(14);
    expect(result.latestAppWritebackCompletedAt).toBe("2026-06-13T11:00:00.000Z");
    expect(result.standings).toHaveLength(48);
    expect(result.validationIssues).toEqual([]);
  });

  it("rejects invalid App standings and keeps the caller baseline available", () => {
    const workbook = workbookWithAppSheets();
    XLSX.utils.sheet_add_json(workbook.Sheets[STANDINGS_SHEET], [{ ...standings[0], rank: 12 }], {
      skipHeader: true,
      origin: "A2",
    });
    const result = parseAppWorkbookBaseline(workbook, schedule, standings);
    expect(result.standings).toBeNull();
    expect(result.validationIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "APP_STATE_STANDINGS_INVALID", severity: "warning" }),
    ]));
  });

  it("parses 24 authoritative Week 14 results and preserves their sources", () => {
    const result = parseAppWorkbookBaseline(workbookWithAppSheets(), schedule, standings);
    expect(result.confirmedResults).toHaveLength(24);
    expect(result.confirmedResults.filter((entry) => entry.source === "Manual")).toHaveLength(6);
    expect(result.confirmedResults.filter((entry) => entry.source === "Simulation")).toHaveLength(18);
  });

  it("rejects duplicate App confirmed result IDs", () => {
    const workbook = workbookWithAppSheets();
    const duplicate = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[RESULTS_SHEET]);
    duplicate[1] = { ...duplicate[1], matchId: duplicate[0].matchId };
    workbook.Sheets[RESULTS_SHEET] = XLSX.utils.json_to_sheet(duplicate);
    const result = parseAppWorkbookBaseline(workbook, schedule, standings);
    expect(result.confirmedResults).toEqual([]);
    expect(result.validationIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "APP_CONFIRMED_RESULTS_INVALID", severity: "warning" }),
    ]));
  });

  it("does not mutate workbook, schedule, or standings inputs", () => {
    const workbook = workbookWithAppSheets();
    const workbookBefore = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const scheduleBefore = structuredClone(schedule);
    const standingsBefore = structuredClone(standings);
    parseAppWorkbookBaseline(workbook, schedule, standings);
    expect(XLSX.write(workbook, { type: "array", bookType: "xlsx" })).toEqual(workbookBefore);
    expect(schedule).toEqual(scheduleBefore);
    expect(standings).toEqual(standingsBefore);
  });
});
