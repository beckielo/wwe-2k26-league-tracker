import {
  calculateStandingsWithConfirmedResults,
  validateConfirmedResult,
  type CompletedWeek,
  type ConfirmedResult,
} from "./tracker-state";
import type { LeagueName, Match, StandingRow } from "./types";

export type WeeklyCloseValidationStatus = "valid" | "incomplete" | "invalid" | "unlocked";

export interface WeeklyClosePackage {
  week: number;
  generatedAt: string;
  workbookCompletedThroughWeek: number;
  latestLockedLocalWeek: number | null;
  lockedAt: string | null;
  userLeague: LeagueName;
  scheduledMatches: Match[];
  confirmedResults: ConfirmedResult[];
  validationStatus: WeeklyCloseValidationStatus;
  validationErrors: string[];
  exportable: boolean;
  missingResultCount: number;
  manualResultCount: number;
  simulationResultCount: number;
  appStateStandings: StandingRow[];
  safetyNote: "Exports are generated from workbook baseline + browser-local tracker state. Excel is not modified.";
}

export interface BuildWeeklyCloseInput {
  week: number;
  generatedAt?: string;
  scheduledMatches: Match[];
  confirmedResults: ConfirmedResult[];
  workbookCurrentWeek: number;
  userLeague: LeagueName;
  baselineStandings: StandingRow[];
  completedWeeks: CompletedWeek[];
}

export function buildWeeklyClosePackage(input: BuildWeeklyCloseInput): WeeklyClosePackage {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const matches = input.scheduledMatches
    .filter((match) => match.week === input.week && match.status === "scheduled")
    .sort((a, b) => a.league.localeCompare(b.league) || a.matchNumber - b.matchNumber)
    .map((match) => ({ ...match, source: { ...match.source } }));
  const scheduledIds = new Set(matches.map((match) => match.id));
  const results = input.confirmedResults
    .filter((result) => result.week === input.week)
    .map((result) => ({ ...result }));
  const resultCounts = new Map<string, number>();
  for (const result of results) {
    resultCounts.set(result.matchId, (resultCounts.get(result.matchId) ?? 0) + 1);
  }

  const validationErrors: string[] = [];
  if (matches.length !== 24) {
    validationErrors.push(`Week ${input.week} has ${matches.length} authoritative scheduled matches; expected 24.`);
  }

  const validResults = new Map<string, ConfirmedResult>();
  for (const result of results) {
    if (!scheduledIds.has(result.matchId)) {
      validationErrors.push(`${result.matchId}: confirmed result is not part of authoritative Week ${input.week}.`);
      continue;
    }
    if ((resultCounts.get(result.matchId) ?? 0) > 1) {
      validationErrors.push(`${result.matchId}: duplicate confirmed results are not allowed.`);
      continue;
    }
    const errors = validateConfirmedResult(result, input.scheduledMatches, input.userLeague);
    if (errors.length > 0) validationErrors.push(...errors);
    else validResults.set(result.matchId, result);
  }

  const missingResultCount = matches.filter((match) => !validResults.has(match.id)).length;
  if (missingResultCount > 0) {
    validationErrors.push(`Week ${input.week} has ${missingResultCount} missing valid confirmed results.`);
  }

  const lock = input.completedWeeks.find((entry) => entry.week === input.week) ?? null;
  const latestLockedLocalWeek = input.completedWeeks.length
    ? Math.max(...input.completedWeeks.map((entry) => entry.week))
    : null;
  const lockedResultsThroughWeek = input.confirmedResults.filter((result) =>
    result.week <= input.week && input.completedWeeks.some((entry) => entry.week === result.week),
  );
  const appStateStandings = calculateStandingsWithConfirmedResults(
    input.baselineStandings,
    input.scheduledMatches,
    lockedResultsThroughWeek,
  );
  const uniqueErrors = [...new Set(validationErrors)];
  const structurallyComplete = matches.length === 24 && missingResultCount === 0;
  const validationStatus: WeeklyCloseValidationStatus = !lock
    ? "unlocked"
    : !structurallyComplete
      ? "incomplete"
      : uniqueErrors.length > 0
        ? "invalid"
        : "valid";

  return {
    week: input.week,
    generatedAt,
    workbookCompletedThroughWeek: input.workbookCurrentWeek,
    latestLockedLocalWeek,
    lockedAt: lock?.completedAt ?? null,
    userLeague: input.userLeague,
    scheduledMatches: matches,
    confirmedResults: results,
    validationStatus,
    validationErrors: uniqueErrors,
    exportable: validationStatus === "valid",
    missingResultCount,
    manualResultCount: results.filter((result) => result.source === "Manual").length,
    simulationResultCount: results.filter((result) => result.source === "Simulation").length,
    appStateStandings,
    safetyNote: "Exports are generated from workbook baseline + browser-local tracker state. Excel is not modified.",
  };
}

export function weeklyResultsToCsv(closePackage: WeeklyClosePackage): string {
  const resultByMatch = new Map(closePackage.confirmedResults.map((result) => [result.matchId, result]));
  const header = [
    "week",
    "league",
    "matchNumber",
    "matchId",
    "wrestlerA",
    "wrestlerB",
    "resultType",
    "winner",
    "source",
    "confirmedAt",
  ];
  const rows = closePackage.scheduledMatches.map((match) => {
    const result = resultByMatch.get(match.id);
    return [
      closePackage.week,
      match.league,
      match.matchNumber,
      match.id,
      match.wrestlerA,
      match.wrestlerB,
      result?.resultType ?? "",
      result?.winner ?? "",
      result?.source ?? "",
      result?.confirmedAt ?? "",
    ];
  });
  return toCsv([header, ...rows]);
}

export function standingsToCsv(closePackage: WeeklyClosePackage): string {
  const header = ["week", "league", "rank", "wrestler", "matches", "wins", "draws", "losses", "points", "status"];
  const rows = closePackage.appStateStandings.map((row) => [
    closePackage.week,
    row.league,
    row.rank,
    row.wrestler,
    row.matches,
    row.wins,
    row.draws,
    row.losses,
    row.points,
    row.status,
  ]);
  return toCsv([header, ...rows]);
}

function toCsv(rows: Array<Array<string | number>>): string {
  return rows
    .map((row) => row.map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(","))
    .join("\r\n");
}
