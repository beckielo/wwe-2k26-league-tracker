import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { afterEach, describe, expect, it } from "vitest";
import {
  CURRENT_MASTER_MARKER,
  promoteCurrentMaster,
} from "../current-master-promotion";
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
