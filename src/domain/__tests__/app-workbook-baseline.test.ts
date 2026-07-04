import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseAppWorkbookBaseline } from "../app-workbook-baseline";
import { createAppWorkbookContextCandidate } from "../workflow-context";
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
const completeSchedule: Match[] = Array.from({ length: 22 }, (_, index) => index + 1).flatMap((week) =>
  schedule.map((match) => week === 14 ? match : {
    ...match,
    id: `${match.id}-week-${week}`,
    week,
  }),
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
    const result = parseAppWorkbookBaseline(workbook, schedule);
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
    const result = parseAppWorkbookBaseline(workbook, schedule);
    expect(result.latestAppWritebackWeek).toBe(14);
    expect(result.latestAppWritebackCompletedAt).toBe("2026-06-13T11:00:00.000Z");
    expect(result.standings).toHaveLength(48);
    expect(result.validationIssues).toEqual([]);
  });

  it("prefers the newest chronological writeback over an older higher week", () => {
    const workbook = workbookWithAppSheets();
    const coherentStandings = standings.map((row) => ({
      ...row,
      matches: 14,
      wins: 14,
      draws: 0,
      losses: 0,
      points: 42,
    }));
    workbook.Sheets[STANDINGS_SHEET] = XLSX.utils.json_to_sheet(coherentStandings);
    workbook.Sheets[LOG_SHEET] = XLSX.utils.json_to_sheet([
      { week: 46, generatedAt: "2026-06-01T12:00:00.000Z", completedAt: "2026-06-01T11:00:00.000Z" },
      { week: 14, generatedAt: "2026-07-03T12:00:00.000Z", completedAt: "2026-07-03T11:00:00.000Z" },
    ]);
    const result = parseAppWorkbookBaseline(workbook, completeSchedule);
    expect(result.latestWriteback).toEqual({ week: 14, completedAt: "2026-07-03T11:00:00.000Z" });
    expect(createAppWorkbookContextCandidate({
      latestWriteback: result.latestWriteback,
      schedule: completeSchedule,
      standings: result.standings,
      results: result.confirmedResults,
    })?.valid).toBe(true);
  });

  it("marks the latest chronological writeback incoherent when its sheets belong to another cycle", () => {
    const workbook = workbookWithAppSheets();
    XLSX.utils.sheet_add_json(workbook.Sheets[LOG_SHEET], [{
      week: 13,
      generatedAt: "2026-07-04T12:00:00.000Z",
      completedAt: "2026-07-04T11:00:00.000Z",
    }], { skipHeader: true, origin: -1 });
    const result = parseAppWorkbookBaseline(workbook, schedule);
    const candidate = createAppWorkbookContextCandidate({
      latestWriteback: result.latestWriteback,
      schedule,
      standings: result.standings,
      results: result.confirmedResults,
    });
    expect(result.latestAppWritebackWeek).toBe(13);
    expect(candidate?.valid).toBe(false);
    expect(candidate?.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "APP_CHECKPOINT_SCHEDULE_MISMATCH" }),
      expect.objectContaining({ code: "APP_CHECKPOINT_RESULTS_MISMATCH" }),
    ]));
  });

  it("rejects invalid App standings and keeps the caller baseline available", () => {
    const workbook = workbookWithAppSheets();
    XLSX.utils.sheet_add_json(workbook.Sheets[STANDINGS_SHEET], [{ ...standings[0], rank: 12 }], {
      skipHeader: true,
      origin: "A2",
    });
    const result = parseAppWorkbookBaseline(workbook, schedule);
    expect(result.standings).toBeNull();
    expect(result.validationIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "APP_STATE_STANDINGS_INVALID", severity: "warning" }),
    ]));
  });

  it("parses 24 authoritative Week 14 results and preserves their sources", () => {
    const result = parseAppWorkbookBaseline(workbookWithAppSheets(), schedule);
    expect(result.confirmedResults).toHaveLength(24);
    expect(result.confirmedResults.filter((entry) => entry.source === "Manual")).toHaveLength(6);
    expect(result.confirmedResults.filter((entry) => entry.source === "Simulation")).toHaveLength(18);
  });

  it("rejects duplicate App confirmed result IDs", () => {
    const workbook = workbookWithAppSheets();
    const duplicate = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[RESULTS_SHEET]);
    duplicate[1] = { ...duplicate[1], matchId: duplicate[0].matchId };
    workbook.Sheets[RESULTS_SHEET] = XLSX.utils.json_to_sheet(duplicate);
    const result = parseAppWorkbookBaseline(workbook, schedule);
    expect(result.confirmedResults).toEqual([]);
    expect(result.validationIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "APP_CONFIRMED_RESULTS_INVALID", severity: "warning" }),
    ]));
  });

  it("does not mutate workbook or schedule inputs", () => {
    const workbook = workbookWithAppSheets();
    const workbookBefore = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const scheduleBefore = structuredClone(schedule);
    parseAppWorkbookBaseline(workbook, schedule);
    expect(XLSX.write(workbook, { type: "array", bookType: "xlsx" })).toEqual(workbookBefore);
    expect(schedule).toEqual(scheduleBefore);
  });
});
