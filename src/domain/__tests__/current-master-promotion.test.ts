import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { afterEach, describe, expect, it } from "vitest";
import {
  CURRENT_MASTER_MARKER,
  promoteCurrentMaster,
} from "../current-master-promotion";
import { acceptedScheduleMatches, createAcceptedScheduleSnapshot, generateSchedule, validateSchedule } from "../schedule-setup";
import type { ConfirmedResult } from "../tracker-state";
import type { LeagueName, Match, StandingRow } from "../types";
import type { WeeklyClosePackage } from "../weekly-close-exports";

const temporaryDirectories: string[] = [];
const leagues: LeagueName[] = [
  "Global League",
  "Continental League",
  "National League",
  "Regional League",
];
const schedule: Match[] = leagues.flatMap((league, leagueIndex) =>
  Array.from({ length: 6 }, (_, index) => ({
    id: `match-${leagueIndex}-${index}`,
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
    source: { file: "master.xlsx", sheet: "Schedule_22W", row: index + 2 },
  })),
);

const closingSeeds = Object.fromEntries(leagues.map((league) => [
  league,
  Array.from({ length: 12 }, (_, index) => ({ seed: index + 1, wrestler: `${league} Wrestler ${index + 1}` })),
])) as Record<LeagueName, Array<{ seed: number; wrestler: string }>>;
const closingPreview = generateSchedule({ leagueYear: 2, split: "Closing Split", yearWeekStart: 25, seeds: closingSeeds, generatedAt: "2026-06-14T00:00:00.000Z" });
const acceptedClosingSchedule = createAcceptedScheduleSnapshot({
  preview: closingPreview,
  validation: validateSchedule(closingPreview, { rosters: Object.fromEntries(leagues.map((league) => [league, closingSeeds[league].map((seed) => seed.wrestler)])) as Record<LeagueName, string[]> }),
  acceptedAt: "2026-06-14T01:00:00.000Z",
  leagueYear: 2,
  split: "Closing Split",
});
const closingWeek25Matches = acceptedScheduleMatches(acceptedClosingSchedule).filter((match) => match.week === 25);
const closingResults: ConfirmedResult[] = closingWeek25Matches.map((match) => ({
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
  matches: 1,
  wins: index % 2 === 0 ? 1 : 0,
  draws: 0,
  losses: index % 2 === 1 ? 1 : 0,
  points: index % 2 === 0 ? 3 : 0,
  status: "active split reset",
})));

const results: ConfirmedResult[] = schedule.map((match) => ({
  league: match.league,
  week: 14,
  matchId: match.id,
  wrestlerA: match.wrestlerA,
  wrestlerB: match.wrestlerB,
  resultType: "Winner",
  winner: match.wrestlerA,
  source: "Simulation",
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

function closingClosePackage(): WeeklyClosePackage {
  const pkg = closePackage();
  return {
    ...pkg,
    week: 25,
    completedAt: "2026-06-15T11:00:00.000Z",
    workbookCompletedThroughWeek: 24,
    latestLockedWeek: 25,
    latestLockedCompletedAt: "2026-06-15T11:00:00.000Z",
    validation: { ...pkg.validation, manual: 0, simulation: 24 },
    summary: { scheduled: 24, confirmed: 24, manual: 0, simulation: 24 },
    results: structuredClone(closingResults),
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
      manual: 0,
      simulation: 24,
      errors: [],
    },
    safety: {
      excelModified: false,
      source: `[${CURRENT_MASTER_MARKER}] old.xlsx`,
      notice: "Excel was not modified.",
    },
    summary: { scheduled: 24, confirmed: 24, manual: 0, simulation: 24 },
    results: structuredClone(results),
    standings: structuredClone(standings),
  };
}

function setup() {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), "master-promotion-"));
  temporaryDirectories.push(sourceDir);
  const sourceFile = `[${CURRENT_MASTER_MARKER}] old.xlsx`;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Original"], ["preserved"]]),
    "Dashboard",
  );
  const bytes = new Uint8Array(
    XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
  );
  fs.writeFileSync(path.join(sourceDir, sourceFile), Buffer.from(bytes));
  return {
    sourceDir,
    sourceFile,
    bytes,
    baseline: { workbook: bytes, sourceFile, schedule },
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("current master promotion", () => {
  it("refuses when no exportable locked week exists", () => {
    const fixture = setup();
    const pkg = closePackage();
    pkg.validation.exportable = false;
    pkg.validation.confirmed = 0;
    pkg.validation.missing = 24;
    pkg.results = [];

    expect(
      promoteCurrentMaster(fixture.sourceDir, fixture.baseline, pkg),
    ).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(["Close package is not exportable."]),
    });
  });

  it("refuses when more than one current master workbook exists", () => {
    const fixture = setup();
    fs.copyFileSync(
      path.join(fixture.sourceDir, fixture.sourceFile),
      path.join(fixture.sourceDir, `[${CURRENT_MASTER_MARKER}] duplicate.xlsx`),
    );

    expect(
      promoteCurrentMaster(fixture.sourceDir, fixture.baseline, closePackage()),
    ).toEqual({
      ok: false,
      errors: ["Expected exactly one current master workbook, found 2."],
    });
  });

  it("promotes Week 25 using the accepted Closing Split schedule instead of a stale original workbook schedule", () => {
    const fixture = setup();
    const result = promoteCurrentMaster(
      fixture.sourceDir,
      { ...fixture.baseline, schedule },
      closingClosePackage(),
      "2026-06-15T13:00:00.000Z",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const workbook = XLSX.read(fs.readFileSync(path.join(fixture.sourceDir, result.filename)), { type: "buffer" });
    const scheduleRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.App_Accepted_Schedule);
    expect(scheduleRows.filter((row) => row.yearWeek === 25)).toHaveLength(24);
    expect(new Set(scheduleRows.filter((row) => row.yearWeek === 25).map((row) => row.matchId))).toEqual(new Set(closingResults.map((row) => row.matchId)));
  });

  it("still refuses Week 25 promotion without an accepted schedule or with incomplete results", () => {
    const fixture = setup();
    const noSchedule = closingClosePackage();
    delete noSchedule.acceptedSchedule;
    expect(promoteCurrentMaster(fixture.sourceDir, fixture.baseline, noSchedule)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(["Accepted Closing Split schedule could not be written to workbook: no accepted Closing Split schedule snapshot was supplied."]),
    });

    const fixture2 = setup();
    const incomplete = closingClosePackage();
    incomplete.results.pop();
    incomplete.validation.confirmed = 23;
    incomplete.validation.missing = 1;
    expect(promoteCurrentMaster(fixture2.sourceDir, fixture2.baseline, incomplete)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(["Close package must report 24 confirmed matches."]),
    });
  });

  it("promotes one validated workbook and archives the previous master", () => {
    const fixture = setup();
    const pkg = closePackage();
    const baselineBefore = fixture.bytes.slice();
    const scheduleBefore = structuredClone(schedule);
    const packageBefore = structuredClone(pkg);

    const result = promoteCurrentMaster(
      fixture.sourceDir,
      fixture.baseline,
      pkg,
      "2026-06-13T13:00:00.000Z",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filename).toContain("W14_abgeschlossen.xlsx");
    const files = fs.readdirSync(fixture.sourceDir);
    expect(
      files.filter(
        (name) =>
          name.includes(CURRENT_MASTER_MARKER) &&
          name.toLowerCase().endsWith(".xlsx"),
      ),
    ).toEqual([result.filename]);
    expect(result.backupFilename).not.toMatch(/\.xlsx$/i);
    expect(result.backupFilename).not.toContain(
      `[${CURRENT_MASTER_MARKER}]`,
    );
    expect(fs.existsSync(path.join(fixture.sourceDir, result.backupFilename))).toBe(true);

    const workbook = XLSX.read(
      fs.readFileSync(path.join(fixture.sourceDir, result.filename)),
      { type: "buffer" },
    );
    expect(workbook.SheetNames).toEqual(
      expect.arrayContaining([
        "App_Confirmed_Results",
        "App_State_Standings",
        "App_Writeback_Log",
      ]),
    );
    expect(fixture.bytes).toEqual(baselineBefore);
    expect(schedule).toEqual(scheduleBefore);
    expect(pkg).toEqual(packageBefore);
  });
});
