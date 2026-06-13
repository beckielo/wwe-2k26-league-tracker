import { calculateStandingsWithConfirmedResults, type ConfirmedResult, type TrackerState } from "./tracker-state";
import { getWeekProgress } from "./week-progression";
import type { LeagueName, Match, StandingRow } from "./types";

export interface WeeklyCloseValidation {
  exportable: boolean;
  status: "unavailable" | "incomplete" | "complete-unlocked" | "locked";
  scheduled: number;
  confirmed: number;
  missing: number;
  manual: number;
  simulation: number;
  errors: string[];
}

export interface WeeklyClosePackage {
  version: 1;
  exportedAt: string;
  week: number;
  completedAt: string;
  workbookCompletedThroughWeek: number;
  latestLockedWeek: number;
  latestLockedCompletedAt?: string;
  validation: WeeklyCloseValidation;
  safety: {
    excelModified: false;
    source: "workbook baseline + browser-local tracker state";
    notice: "Excel workbook was not modified by this export.";
  };
  summary: {
    scheduled: number;
    confirmed: number;
    manual: number;
    simulation: number;
  };
  results: ConfirmedResult[];
  standings: StandingRow[];
}

export type WeeklyCloseExportResult =
  | {
      ok: true;
      week: number;
      package: WeeklyClosePackage;
      packageJson: string;
      resultsCsv: string;
      standingsCsv: string;
    }
  | { ok: false; reason: string; validation: WeeklyCloseValidation };

const RESULTS_HEADERS = [
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

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function createWeeklyCloseExports(
  state: TrackerState,
  matches: Match[],
  baselineStandings: StandingRow[],
  userLeague: LeagueName,
  workbookCompletedThroughWeek: number,
  exportedAt = new Date().toISOString(),
): WeeklyCloseExportResult {
  const completedWeek = [...state.completedWeeks].sort((a, b) => b.week - a.week)[0];

  if (!completedWeek) {
    const latestResultWeek = state.confirmedResults.reduce(
      (latest, result) => Math.max(latest, result.week),
      0,
    );
    const progress = latestResultWeek
      ? getWeekProgress(state, latestResultWeek, matches, userLeague)
      : null;
    const validation: WeeklyCloseValidation = progress
      ? {
          exportable: false,
          status: progress.status,
          scheduled: progress.total,
          confirmed: progress.confirmed,
          missing: progress.missing,
          manual: progress.manual,
          simulation: progress.simulation,
          errors: [
            `Week ${latestResultWeek} is not locked.`,
            ...progress.validationErrors,
            ...progress.missingMatches.map(
              (match) => `${match.id}: confirmed result is missing.`,
            ),
          ],
        }
      : {
          exportable: false,
          status: "unavailable",
          scheduled: 0,
          confirmed: 0,
          missing: 0,
          manual: 0,
          simulation: 0,
          errors: ["No locked week is available for export."],
        };

    return {
      ok: false,
      reason: "Complete and lock a week before downloading the weekly close exports.",
      validation,
    };
  }

  const progress = getWeekProgress(state, completedWeek.week, matches, userLeague);
  const validationErrors = [
    ...progress.validationErrors,
    ...progress.missingMatches.map(
      (match) => `${match.id}: confirmed result is missing.`,
    ),
  ];
  const exportable =
    progress.status === "locked" &&
    progress.total === 24 &&
    progress.confirmed === progress.total &&
    progress.missing === 0 &&
    progress.invalid === 0;
  const validation: WeeklyCloseValidation = {
    exportable,
    status: progress.status,
    scheduled: progress.total,
    confirmed: progress.confirmed,
    missing: progress.missing,
    manual: progress.manual,
    simulation: progress.simulation,
    errors: validationErrors,
  };

  if (!exportable) {
    return {
      ok: false,
      reason: `Locked Week ${completedWeek.week} is not complete and valid, so safe exports are unavailable.`,
      validation,
    };
  }

  const matchById = new Map(matches.map((match) => [match.id, match]));
  const results = progress.confirmedResults
    .map((result) => ({ ...result }))
    .sort((a, b) => {
      const matchA = matchById.get(a.matchId);
      const matchB = matchById.get(b.matchId);
      return (
        a.league.localeCompare(b.league) ||
        (matchA?.matchNumber ?? 0) - (matchB?.matchNumber ?? 0)
      );
    });
  const standings = calculateStandingsWithConfirmedResults(
    baselineStandings,
    matches,
    state.confirmedResults.filter((result) => result.week <= completedWeek.week),
  );
  const closePackage: WeeklyClosePackage = {
    version: 1,
    exportedAt,
    week: completedWeek.week,
    completedAt: completedWeek.completedAt,
    workbookCompletedThroughWeek,
    latestLockedWeek: completedWeek.week,
    latestLockedCompletedAt: completedWeek.completedAt,
    validation,
    safety: {
      excelModified: false,
      source: "workbook baseline + browser-local tracker state",
      notice: "Excel workbook was not modified by this export.",
    },
    summary: {
      scheduled: progress.total,
      confirmed: progress.confirmed,
      manual: progress.manual,
      simulation: progress.simulation,
    },
    results,
    standings,
  };

  const resultsCsv = toCsv(
    RESULTS_HEADERS,
    results.map((result) => {
      const match = matchById.get(result.matchId);
      return [
        result.week,
        result.league,
        match?.matchNumber ?? "",
        result.matchId,
        result.wrestlerA,
        result.wrestlerB,
        result.resultType,
        result.winner,
        result.source,
        result.confirmedAt,
      ];
    }),
  );
  const standingsCsv = toCsv(
    STANDINGS_HEADERS,
    standings.map((row) => [
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
  );

  return {
    ok: true,
    week: completedWeek.week,
    package: closePackage,
    packageJson: JSON.stringify(closePackage, null, 2),
    resultsCsv,
    standingsCsv,
  };
}
