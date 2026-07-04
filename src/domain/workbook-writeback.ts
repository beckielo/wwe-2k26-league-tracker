import * as XLSX from "xlsx";
import type { WeeklyClosePackage } from "./weekly-close-exports";
import { acceptedScheduleMatches } from "./schedule-setup";
import type { Match } from "./types";

export const RESULTS_SHEET = "App_Confirmed_Results";
export const STANDINGS_SHEET = "App_State_Standings";
export const LOG_SHEET = "App_Writeback_Log";
export const ACCEPTED_SCHEDULE_SHEET = "App_Accepted_Schedule";

export interface WorkbookWritebackBaseline {
  workbook: Uint8Array;
  sourceFile: string;
  schedule: Match[];
}

export type WorkbookWritebackResult =
  | {
      ok: true;
      filename: string;
      workbook: Uint8Array;
      metadata: {
        week: number;
        resultCount: number;
        standingsCount: number;
        sheets: string[];
      };
    }
  | { ok: false; errors: string[] };

const RESULT_HEADERS = [
  "league",
  "week",
  "matchNumber",
  "matchId",
  "wrestlerA",
  "wrestlerB",
  "resultType",
  "winner",
  "source",
  "confirmedAt",
];

const ACCEPTED_SCHEDULE_HEADERS = [
  "matchId",
  "leagueYear",
  "split",
  "splitWeek",
  "yearWeek",
  "roundType",
  "league",
  "showDay",
  "matchNumber",
  "wrestlerA",
  "wrestlerB",
  "matchupKey",
  "scheduleSource",
  "acceptedAt",
  "writtenAt",
];

const STANDINGS_HEADERS = [
  "league",
  "rank",
  "wrestler",
  "seed",
  "matches",
  "wins",
  "draws",
  "losses",
  "points",
  "status",
];

const LEGACY_SCHEDULE_HEADERS = [
  "League Year",
  "Split",
  "Week",
  "Round Type",
  "League",
  "Show Day",
  "Match #",
  "Wrestler A",
  "Wrestler B",
  "Winner",
  "Result Type",
  "Notes",
];

const LEGACY_STANDINGS_HEADERS = [
  "League",
  "Rank",
  "Wrestler",
  "Seed",
  "Matches",
  "Wins",
  "Draws",
  "Losses",
  "Points",
  "Status / Zone",
];

function validTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function validateWorkbookWriteback(
  baseline: Pick<WorkbookWritebackBaseline, "sourceFile" | "schedule">,
  closePackage: WeeklyClosePackage,
): string[] {
  const errors: string[] = [];
  const week = closePackage.week;
  const acceptedMatches = closePackage.acceptedSchedule?.validation.valid
    ? acceptedScheduleMatches(closePackage.acceptedSchedule)
    : [];
  const authoritySchedule = acceptedMatches.length > 0
    ? [...baseline.schedule.filter((match) => !acceptedMatches.some((accepted) => accepted.id === match.id)), ...acceptedMatches]
    : baseline.schedule;
  const weekSchedule = authoritySchedule.filter((match) => match.week === week);
  const matchById = new Map(weekSchedule.map((match) => [match.id, match]));
  const seen = new Set<string>();

  if (closePackage.validation.exportable !== true) errors.push("Close package is not exportable.");
  if (closePackage.validation.scheduled !== 24) errors.push("Close package must report 24 scheduled matches.");
  if (closePackage.validation.confirmed !== 24) errors.push("Close package must report 24 confirmed matches.");
  if (closePackage.validation.missing !== 0) errors.push("Close package must report zero missing matches.");
  if (closePackage.validation.errors.length > 0) errors.push("Close package contains validation errors.");
  if (closePackage.safety.excelModified !== false) errors.push("Close package indicates that Excel was modified.");
  if (closePackage.safety.source !== baseline.sourceFile) {
    errors.push("Close package source does not match the workbook baseline.");
  }
  if (closePackage.latestLockedWeek !== week || closePackage.latestLockedCompletedAt !== closePackage.completedAt) {
    errors.push(`Week ${week} is not the latest locked week in the close package.`);
  }
  if (!validTimestamp(closePackage.completedAt)) errors.push("Close package completedAt is invalid.");
  if (week >= 25 && acceptedMatches.length === 0) errors.push("Accepted Closing Split schedule could not be written to workbook: no accepted Closing Split schedule snapshot was supplied.");
  if (weekSchedule.length !== 24) {
    errors.push(acceptedMatches.length > 0
      ? `Accepted Closing Split schedule has ${weekSchedule.length} matches for Week ${week}; expected 24. Schedule writeback is required before promotion.`
      : `Workbook schedule has ${weekSchedule.length} matches for Week ${week}; expected 24.`);
  }
  if (closePackage.results.length !== 24) errors.push("Close package must contain exactly 24 results.");
  if (closePackage.standings.length !== 48) errors.push("Close package must contain exactly 48 standings rows.");

  for (const result of closePackage.results) {
    if (seen.has(result.matchId)) errors.push(`${result.matchId}: duplicate match ID.`);
    seen.add(result.matchId);
    const match = matchById.get(result.matchId);
    if (!match) {
      errors.push(`${result.matchId}: match is not in the authoritative Week ${week} schedule.`);
      continue;
    }
    if (
      result.week !== week ||
      result.league !== match.league ||
      result.wrestlerA !== match.wrestlerA ||
      result.wrestlerB !== match.wrestlerB
    ) {
      errors.push(`${result.matchId}: result matchup identity does not match the workbook schedule.`);
    }
    if (result.resultType === "Winner") {
      if (result.winner !== match.wrestlerA && result.winner !== match.wrestlerB) {
        errors.push(`${result.matchId}: winner must be one of the scheduled wrestlers.`);
      }
    } else if (result.winner !== null) {
      errors.push(`${result.matchId}: Draw or No Contest cannot have a winner.`);
    }
  }

  for (const match of weekSchedule) {
    if (!seen.has(match.id)) errors.push(`${match.id}: scheduled match is missing from the close package.`);
  }

  return [...new Set(errors)];
}

function replaceSheet(workbook: XLSX.WorkBook, name: string, rows: unknown[][]): void {
  workbook.Sheets[name] = XLSX.utils.aoa_to_sheet(rows);
  if (!workbook.SheetNames.includes(name)) workbook.SheetNames.push(name);
}

function overwriteExistingSheetValues(
  workbook: XLSX.WorkBook,
  name: string,
  rows: Array<Array<string | number | boolean>>,
): boolean {
  const sheet = workbook.Sheets[name];
  if (!sheet) return false;
  rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
    const cell = {
      ...(sheet[address] ?? {}),
      t: typeof value === "number" ? "n" : typeof value === "boolean" ? "b" : "s",
      v: value,
    };
    delete cell.f;
    delete cell.w;
    sheet[address] = cell;
  }));
  sheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rows.length - 1, c: rows[0].length - 1 },
  });
  return true;
}

function legacyScheduleKey(values: {
  leagueYear: number;
  split: string;
  week: number;
  league: string;
  matchNumber: number;
  wrestlerA: string;
  wrestlerB: string;
}): string {
  return [
    values.leagueYear,
    values.split,
    values.week,
    values.league,
    values.matchNumber,
    values.wrestlerA,
    values.wrestlerB,
  ].join("|");
}

function parseLegacyLeagueYear(value: unknown): number {
  const parsed = String(value ?? "").match(/(\d+)/);
  return parsed ? Number(parsed[1]) : 0;
}

function synchronizeLegacyFallbackSheets(
  workbook: XLSX.WorkBook,
  acceptedMatches: Match[],
  closePackage: WeeklyClosePackage,
): void {
  const scheduleSheet = workbook.Sheets.Schedule_22W;
  if (scheduleSheet) {
    const existingRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(scheduleSheet, {
      defval: "",
      raw: true,
    });
    const existingByKey = new Map(existingRows.map((row) => [
      legacyScheduleKey({
        leagueYear: parseLegacyLeagueYear(row["League Year"]),
        split: String(row.Split ?? ""),
        week: Number(row.Week),
        league: String(row.League ?? ""),
        matchNumber: Number(row["Match #"]),
        wrestlerA: String(row["Wrestler A"] ?? ""),
        wrestlerB: String(row["Wrestler B"] ?? ""),
      }),
      row,
    ]));
    const closeResultById = new Map(closePackage.results.map((result) => [result.matchId, result]));
    const leagueOrder = new Map([
      ["Regional League", 0],
      ["National League", 1],
      ["Continental League", 2],
      ["Global League", 3],
    ]);
    const scheduleRows = acceptedMatches
      .slice()
      .sort((a, b) => (
        a.week - b.week
        || (leagueOrder.get(a.league) ?? 99) - (leagueOrder.get(b.league) ?? 99)
        || a.matchNumber - b.matchNumber
      ))
      .map((match) => {
        const existing = existingByKey.get(legacyScheduleKey(match));
        const result = closeResultById.get(match.id);
        const splitWeek = match.split === "Closing Split" ? match.week - 24 : match.week;
        const resultSource = result
          ? result.source === "Manual" ? "User" : "Simulation"
          : String(existing?.["Result Type"] ?? "");
        const outcomePrefix = result?.resultType === "Draw"
          ? "Draw · "
          : result?.resultType === "No Contest"
            ? "No Contest · "
            : "";
        const notes = result
          ? `${outcomePrefix}${match.split} Week ${splitWeek} completed · validated App checkpoint fallback`
          : String(existing?.Notes ?? "");
        return [
          `League Year ${match.leagueYear}`,
          match.split,
          match.week,
          match.roundType,
          match.league,
          match.showDay,
          match.matchNumber,
          match.wrestlerA,
          match.wrestlerB,
          result ? result.winner ?? "" : String(existing?.Winner ?? ""),
          resultSource,
          notes,
        ];
      });
    overwriteExistingSheetValues(workbook, "Schedule_22W", [
      LEGACY_SCHEDULE_HEADERS,
      ...scheduleRows,
    ]);
  }

  overwriteExistingSheetValues(workbook, "Standings_Current", [
    LEGACY_STANDINGS_HEADERS,
    ...closePackage.standings.map((row) => [
      row.league,
      row.rank,
      row.wrestler,
      row.seed,
      row.matches,
      row.wins,
      row.draws,
      row.losses,
      row.points,
      row.status,
    ]),
  ]);
}

function synchronizeDashboardContext(workbook: XLSX.WorkBook, context: Pick<Match, "leagueYear" | "split" | "week">): void {
  const dashboard = workbook.Sheets.Dashboard;
  if (!dashboard) return;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(dashboard, { header: 1, defval: "", raw: true });
  const splitWeek = context.split === "Closing Split" ? context.week - 24 : context.week;
  const replacements = new Map<string, string>([
    ["WWE 2K26 Liga-System", `League Year ${context.leagueYear} – ${context.split}`],
    ["Aktueller Stand", `Woche ${context.week} abgeschlossen`],
    ["Ligaphase", `${context.split} Woche ${splitWeek} abgeschlossen`],
    ["Dateistand", `LY${context.leagueYear} ${context.split} Week ${splitWeek} abgeschlossen`],
    ["Authoritative next-match source", `National League \u2013 ${context.split} Woche ${splitWeek + 1}`],
  ]);
  for (const [index, row] of rows.entries()) {
    const key = String(row[0] ?? "").trim();
    const replacement = replacements.get(key)
      ?? (key.endsWith("User-Show") ? `National League \u2013 ${context.split} Woche ${splitWeek + 1}` : undefined);
    if (!replacement) continue;
    const address = XLSX.utils.encode_cell({ r: index, c: 1 });
    dashboard[address] = { ...dashboard[address], t: "s", v: replacement, w: replacement };
  }
}

function contextFilename(context: Pick<Match, "leagueYear" | "split" | "week">): string {
  const splitLabel = context.split.replace(" Split", "");
  return `WWE_2K26_Liga_System_LY${context.leagueYear}_${splitLabel}_W${context.week}_abgeschlossen.xlsx`;
}

export function createWorkbookWriteback(
  baseline: WorkbookWritebackBaseline,
  closePackage: WeeklyClosePackage,
  generatedAt = new Date().toISOString(),
): WorkbookWritebackResult {
  const errors = validateWorkbookWriteback(baseline, closePackage);
  if (!validTimestamp(generatedAt)) errors.push("generatedAt is invalid.");
  if (errors.length) return { ok: false, errors };

  const workbook = XLSX.read(baseline.workbook, { type: "array", cellDates: false, cellStyles: true });
  const acceptedMatches = closePackage.acceptedSchedule?.validation.valid ? acceptedScheduleMatches(closePackage.acceptedSchedule) : [];
  const authoritySchedule = acceptedMatches.length > 0
    ? [...baseline.schedule.filter((match) => !acceptedMatches.some((accepted) => accepted.id === match.id)), ...acceptedMatches]
    : baseline.schedule;
  const matchById = new Map(authoritySchedule.map((match) => [match.id, match]));
  const contextMatch = authoritySchedule.find((match) => match.week === closePackage.week);
  if (!contextMatch) return { ok: false, errors: [`Week ${closePackage.week} has no authoritative context match.`] };
  synchronizeDashboardContext(workbook, contextMatch);
  if (acceptedMatches.length === 528) {
    synchronizeLegacyFallbackSheets(workbook, acceptedMatches, closePackage);
  }
  replaceSheet(workbook, RESULTS_SHEET, [
    RESULT_HEADERS,
    ...closePackage.results.map((result) => [
      result.league,
      result.week,
      matchById.get(result.matchId)?.matchNumber ?? "",
      result.matchId,
      result.wrestlerA,
      result.wrestlerB,
      result.resultType,
      result.winner ?? "",
      result.source,
      result.confirmedAt,
    ]),
  ]);
  replaceSheet(workbook, STANDINGS_SHEET, [
    STANDINGS_HEADERS,
    ...closePackage.standings.map((row) => [
      row.league,
      row.rank,
      row.wrestler,
      row.seed,
      row.matches,
      row.wins,
      row.draws,
      row.losses,
      row.points,
      row.status,
    ]),
  ]);

  if (acceptedMatches.length > 0) {
    replaceSheet(workbook, ACCEPTED_SCHEDULE_SHEET, [
      ACCEPTED_SCHEDULE_HEADERS,
      ...acceptedMatches.map((match) => [
        match.id,
        match.leagueYear,
        match.split,
        match.week - 24,
        match.week,
        match.roundType,
        match.league,
        match.showDay,
        match.matchNumber,
        match.wrestlerA,
        match.wrestlerB,
        match.matchupKey,
        closePackage.acceptedSchedule?.source === "Imported" ? "accepted imported snapshot" : "accepted generated snapshot",
        closePackage.acceptedSchedule?.acceptedAt ?? "",
        generatedAt,
      ]),
    ]);
  }

  const existingLog = workbook.Sheets[LOG_SHEET]
    ? XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[LOG_SHEET], { header: 1, defval: "" })
    : [[
        "week",
        "generatedAt",
        "completedAt",
        "manualCount",
        "simulationCount",
        "sourceClosePackage",
        "excelModified",
        "originalWorkbookSource",
        "scheduleSource",
        "closingSplitScheduleAccepted",
        "closingSplitScheduleWrittenToWorkbook",
      ]];
  existingLog.push([
    closePackage.week,
    generatedAt,
    closePackage.completedAt,
    closePackage.validation.manual,
    closePackage.validation.simulation,
    `weekly-close-package-v${closePackage.version}-week-${closePackage.week}`,
    false,
    baseline.sourceFile,
    acceptedMatches.length > 0 ? "updated workbook" : "original workbook",
    Boolean(closePackage.acceptedSchedule?.split === "Closing Split"),
    acceptedMatches.length > 0,
  ]);
  replaceSheet(workbook, LOG_SHEET, existingLog);

  const output = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return {
    ok: true,
    filename: contextFilename(contextMatch),
    workbook: output,
    metadata: {
      week: closePackage.week,
      resultCount: closePackage.results.length,
      standingsCount: closePackage.standings.length,
      sheets: acceptedMatches.length > 0 ? [RESULTS_SHEET, STANDINGS_SHEET, LOG_SHEET, ACCEPTED_SCHEDULE_SHEET] : [RESULTS_SHEET, STANDINGS_SHEET, LOG_SHEET],
    },
  };
}
