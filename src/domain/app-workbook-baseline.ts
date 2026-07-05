import * as XLSX from "xlsx";
import { calculatePoints } from "./scoring";
import type { ConfirmedResult } from "./tracker-state";
import { LEAGUE_NAMES, type Match, type StandingRow, type ValidationIssue } from "./types";
import { LOG_SHEET, RESULTS_SHEET, STANDINGS_SHEET } from "./workbook-writeback";

type CellValue = string | number | boolean | null | undefined;
type SheetRow = Record<string, CellValue>;

export interface AppWorkbookBaseline {
  hasWritebackSheets: boolean;
  latestAppWritebackWeek: number | null;
  latestAppWritebackCompletedAt: string | null;
  latestWriteback: { week: number; completedAt: string } | null;
  standings: StandingRow[] | null;
  confirmedResults: ConfirmedResult[];
  validationIssues: ValidationIssue[];
}

function text(value: CellValue): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function finiteNumber(value: CellValue): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rows(workbook: XLSX.WorkBook, sheetName: string): SheetRow[] | null {
  const sheet = workbook.Sheets[sheetName];
  return sheet ? XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: null, raw: true }) : null;
}

function warning(code: string, message: string, sheet: string): ValidationIssue {
  return { code, severity: "warning", message, source: { file: "loaded workbook", sheet } };
}

function parseLog(workbook: XLSX.WorkBook): Pick<AppWorkbookBaseline, "latestAppWritebackWeek" | "latestAppWritebackCompletedAt" | "latestWriteback" | "validationIssues"> {
  const sheetRows = rows(workbook, LOG_SHEET);
  if (!sheetRows) {
    return { latestAppWritebackWeek: null, latestAppWritebackCompletedAt: null, latestWriteback: null, validationIssues: [] };
  }
  const valid = sheetRows.flatMap((row, index) => {
    const week = finiteNumber(row.week);
    const completedAt = text(row.completedAt);
    return week !== null && Number.isInteger(week) && week > 0 && Number.isFinite(Date.parse(completedAt))
      ? [{ week, completedAt, index }]
      : [];
  }).sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt) || a.index - b.index);
  const latest = valid.at(-1);
  return {
    latestAppWritebackWeek: latest?.week ?? null,
    latestAppWritebackCompletedAt: latest?.completedAt ?? null,
    latestWriteback: latest ? { week: latest.week, completedAt: latest.completedAt } : null,
    validationIssues: sheetRows.length > 0 && !latest
      ? [warning("APP_WRITEBACK_LOG_INVALID", "App_Writeback_Log has no valid week/completedAt entry; the original workbook week remains authoritative.", LOG_SHEET)]
      : [],
  };
}

function parseStandings(workbook: XLSX.WorkBook, schedule: Match[]): { standings: StandingRow[] | null; issues: ValidationIssue[] } {
  const sheetRows = rows(workbook, STANDINGS_SHEET);
  if (!sheetRows) return { standings: null, issues: [] };
  const parsed: StandingRow[] = [];
  const errors: string[] = [];
  for (const [index, row] of sheetRows.entries()) {
    const numeric = ["rank", "seed", "matches", "wins", "draws", "losses", "points"] as const;
    const values = Object.fromEntries(numeric.map((field) => [field, finiteNumber(row[field])])) as Record<(typeof numeric)[number], number | null>;
    const league = text(row.league);
    const wrestler = text(row.wrestler);
    if (!LEAGUE_NAMES.includes(league as (typeof LEAGUE_NAMES)[number]) || !wrestler || numeric.some((field) => values[field] === null)) {
      errors.push(`row ${index + 2} has invalid required values`);
      continue;
    }
    const standing = {
      league: league as StandingRow["league"],
      rank: values.rank!,
      wrestler,
      seed: values.seed!,
      matches: values.matches!,
      wins: values.wins!,
      draws: values.draws!,
      losses: values.losses!,
      points: values.points!,
      status: text(row.status),
    };
    if (
      numeric.some((field) => !Number.isInteger(standing[field]) || standing[field] < 0) ||
      standing.matches !== standing.wins + standing.draws + standing.losses ||
      standing.points !== calculatePoints(standing.wins, standing.draws)
    ) errors.push(`${standing.wrestler || `row ${index + 2}`} has an invalid record or points total`);
    parsed.push(standing);
  }
  if (parsed.length !== 48) errors.push(`expected exactly 48 rows, found ${parsed.length}`);
  const rosterWrestlers = new Set(schedule.flatMap((match) => [match.wrestlerA, match.wrestlerB]).map((wrestler) => wrestler.trim().toLocaleLowerCase()));
  const parsedWrestlers = parsed.map((row) => row.wrestler.trim().toLocaleLowerCase());
  if (new Set(parsedWrestlers).size !== parsedWrestlers.length || parsedWrestlers.some((wrestler) => !rosterWrestlers.has(wrestler))) {
    errors.push("wrestlers must uniquely match an authoritative schedule roster");
  }
  for (const league of LEAGUE_NAMES) {
    const leagueRows = parsed.filter((row) => row.league === league);
    const ranks = leagueRows.map((row) => row.rank).sort((a, b) => a - b);
    if (leagueRows.length !== 12 || ranks.some((rank, index) => rank !== index + 1)) {
      errors.push(`${league} must contain exactly ranks 1–12`);
    }
  }
  return errors.length
    ? { standings: null, issues: [warning("APP_STATE_STANDINGS_INVALID", `App_State_Standings was rejected: ${[...new Set(errors)].join("; ")}. Existing workbook standings remain in use.`, STANDINGS_SHEET)] }
    : { standings: parsed, issues: [] };
}

function parseResults(workbook: XLSX.WorkBook, schedule: Match[]): { results: ConfirmedResult[]; issues: ValidationIssue[] } {
  const sheetRows = rows(workbook, RESULTS_SHEET);
  if (!sheetRows) return { results: [], issues: [] };
  const matchById = new Map(schedule.map((match) => [match.id, match]));
  const seen = new Set<string>();
  const parsed: ConfirmedResult[] = [];
  const errors: string[] = [];
  for (const [index, row] of sheetRows.entries()) {
    const matchId = text(row.matchId);
    const match = matchById.get(matchId);
    if (seen.has(matchId)) errors.push(`${matchId || `row ${index + 2}`}: duplicate match ID`);
    seen.add(matchId);
    if (
      !match ||
      finiteNumber(row.week) !== match.week ||
      text(row.league) !== match.league ||
      text(row.wrestlerA) !== match.wrestlerA ||
      text(row.wrestlerB) !== match.wrestlerB
    ) {
      errors.push(`${matchId || `row ${index + 2}`}: matchup identity does not match the authoritative schedule`);
      continue;
    }
    const resultType = text(row.resultType);
    const source = text(row.source);
    const winner = text(row.winner) || null;
    const confirmedAt = text(row.confirmedAt);
    if (
      !["Winner", "Draw", "No Contest"].includes(resultType) ||
      !["Manual", "Simulation"].includes(source) ||
      !Number.isFinite(Date.parse(confirmedAt)) ||
      (resultType === "Winner" ? winner !== match.wrestlerA && winner !== match.wrestlerB : winner !== null)
    ) {
      errors.push(`${matchId}: invalid result, source, winner, or confirmedAt`);
      continue;
    }
    parsed.push({
      league: match.league,
      week: match.week,
      matchId,
      wrestlerA: match.wrestlerA,
      wrestlerB: match.wrestlerB,
      resultType: resultType as ConfirmedResult["resultType"],
      winner,
      source: source as ConfirmedResult["source"],
      confirmedAt,
    });
  }
  return errors.length
    ? { results: [], issues: [warning("APP_CONFIRMED_RESULTS_INVALID", `App_Confirmed_Results was rejected: ${[...new Set(errors)].join("; ")}. No app writeback results were loaded.`, RESULTS_SHEET)] }
    : { results: parsed, issues: [] };
}

export function parseAppWorkbookBaseline(
  workbook: XLSX.WorkBook,
  schedule: Match[],
): AppWorkbookBaseline {
  const log = parseLog(workbook);
  const standings = parseStandings(workbook, schedule);
  const results = parseResults(workbook, schedule);
  return {
    hasWritebackSheets: [LOG_SHEET, RESULTS_SHEET, STANDINGS_SHEET].some((name) => Boolean(workbook.Sheets[name])),
    latestAppWritebackWeek: log.latestAppWritebackWeek,
    latestAppWritebackCompletedAt: log.latestAppWritebackCompletedAt,
    latestWriteback: log.latestWriteback,
    standings: standings.standings,
    confirmedResults: results.results,
    validationIssues: [...log.validationIssues, ...standings.issues, ...results.issues],
  };
}
